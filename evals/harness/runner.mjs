// Development harness only. Host-specific behavior must never enter skills/nomi/.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { splitFrontmatter } from '../../skills/nomi/scripts/lib/frontmatter.mjs';
import { observe } from '../../skills/nomi/scripts/lib/capture.mjs';
import { readRun } from '../../skills/nomi/scripts/lib/runs.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export function evalIdentity(caseName,arm,run,model) {
  if(!/^(?:claude-sonnet-5(?:-5)?|gpt-\d[\w.-]*)$/.test(model))throw new Error("use a pinned model id");
  return `${model}/${caseName}/${arm}/${run}`;
}
export function parseTranscript(text) {
  let events;
  try { events=text.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)); }
  catch { return {error:'invalid transcript JSON',cost:null,events:[]}; }
  const result=events.findLast(e=>e.type==='result');
  return {events,cost:typeof result?.total_cost_usd==='number'?result.total_cost_usd:null,error:!result?'missing result':result.is_error || result.subtype!=='success' ? `${result.subtype}: ${result.result || result.errors?.join('; ') || ''}`:null,result:result?.result || '',usage:result?.usage,turns:result?.num_turns};
}
export function gradeRegex(text,rule) { return new RegExp(rule.pattern,rule.flags||'').test(text)===(rule.expect ?? true); }
export function reserveBudget(results,cap,limit=25) {
  if(results.some(r=>typeof r.cost!=='number')) throw new Error('unknown cost: reconcile interrupted runs before spending again');
  const spent=results.reduce((sum,r)=>sum+r.cost,0);
  if(!(cap>0) || spent+cap>limit) throw new Error(`phase budget: $${spent.toFixed(2)} spent; cannot reserve $${cap}`);
  return cap;
}
export function isolatedAuth(credentials) {
  const oauth=credentials?.claudeAiOauth;
  if(!oauth?.accessToken || !Number.isFinite(oauth.expiresAt) || oauth.expiresAt<Date.now()+600000) throw new Error('Claude authentication expires too soon; sign in before running evals');
  return {CLAUDE_CODE_OAUTH_TOKEN:oauth.accessToken};
}
export function loadAuth() {
  if(process.env.CLAUDE_CODE_OAUTH_TOKEN)return {CLAUDE_CODE_OAUTH_TOKEN:process.env.CLAUDE_CODE_OAUTH_TOKEN};
  const source=path.join(process.env.CLAUDE_CONFIG_DIR||path.join(os.homedir(),'.claude'),'.credentials.json');
  return isolatedAuth(JSON.parse(fs.readFileSync(source,'utf8')));
}
function readCase(dir) {
  const prompt=splitFrontmatter(fs.readFileSync(path.join(dir,'prompt.md'),'utf8'));
  const config=JSON.parse(fs.readFileSync(path.join(dir,'nomi.json'),'utf8'));
  for(const rule of config.regex || []) {
    if(!rule.compliant || !rule.violating) throw new Error('every regex needs compliant and violating snippets');
    if(!gradeRegex(rule.compliant,rule) || gradeRegex(rule.violating,rule)) throw new Error(`invalid grader examples: ${rule.id}`);
  }
  return {prompt:prompt.body.trim(),config};
}
// A suite is a folder of case folders, or one prompts.json of {id,prompt,fixture,expect} for prompt-only suites (trigger).
export function loadCases(suite,only) {
  const dir=path.join(ROOT,'evals','cases',suite), list=path.join(dir,'prompts.json');
  const cases=fs.existsSync(list)
    ? JSON.parse(fs.readFileSync(list,'utf8')).map(c=>({suite,name:c.id,prompt:c.prompt,config:{fixture:c.fixture,expect:c.expect,render:false,maxTurns:3}}))
    : fs.readdirSync(dir).map(name=>({suite,name,...readCase(path.join(dir,name))}));
  return cases.filter(c=>!only||only.includes(c.name));
}
// Codex exec --json events in the shape the Claude graders read: commands become Bash calls, a read of a Nomi
// SKILL.md becomes a Skill call (Codex activates a skill by reading it), and .md/.png paths become Read calls.
export function codexEvents(stdout,cwd) {
  let lines;
  try { lines=stdout.trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)); }
  catch { return {error:'invalid transcript JSON',cost:null,events:[]}; }
  const events=[]; let n=0;
  const call=(name,input,content,is_error=false)=>{const id=`c${n++}`;events.push({type:'assistant',message:{content:[{type:'tool_use',id,name,input}]}},{type:'user',message:{content:[{type:'tool_result',tool_use_id:id,is_error,content}]}});};
  for(const {type,item} of lines) {
    if(type!=='item.completed'||!item)continue;
    if(item.type==='agent_message')events.push({type:'assistant',message:{content:[{type:'text',text:item.text||''}]}});
    else if(item.type==='command_execution') {
      for(const skill of new Set([...item.command.matchAll(/[\\/](nomi(?:-[a-z0-9]+)?)[\\/]+SKILL\.md/g)].map(m=>m[1])))call('Skill',{skill},'');
      call('Bash',{command:item.command},item.aggregated_output||'',item.exit_code!==0);
      if(item.exit_code===0)for(const m of item.command.matchAll(/[^\s'"`;|()=]+\.(?:md|png)\b/gi))call('Read',{file_path:path.resolve(cwd,m[0])},'');
    } else { // image views and other tools: any item that names a .png counts as opening it
      const file=[item.path,item.file_path,item.arguments?.path].find(p=>typeof p==='string'&&/\.png$/i.test(p));
      if(file)call('Read',{file_path:path.resolve(cwd,file)},'');
    }
  }
  const done=lines.findLast(e=>e.type==='turn.completed'), failed=lines.find(e=>['turn.failed','error'].includes(e.type));
  const final=events.findLast(e=>e.type==='assistant'&&e.message.content[0].type==='text');
  if(final){events.splice(events.indexOf(final),1);events.push(final);} // the graders read the last assistant event as the final report
  // Plan-billed: no dollar cost is reported, so the ledger records 0 and the report gives tokens.
  return {events,cost:0,usage:done?.usage,turns:n,result:final?.message.content[0].text||'',error:failed?(failed.error?.message||failed.message||'turn failed'):done?null:'missing result'};
}
export function codexArgs(prompt,model,effort='low') {
  return ['exec','--json','--ignore-rules','--ephemeral','--disable','memories','--skip-git-repo-check','--sandbox','workspace-write','--model',model,'-c',`model_reasoning_effort="${effort}"`,'--',prompt];
}
// Trigger suite: recall over prompts that should load a Nomi skill, false-trigger rate over those that should not.
export function triggerSummary(results) {
  const should=results.filter(r=>r.expect), not=results.filter(r=>!r.expect);
  const hit=should.filter(r=>r.activation), routed=hit.filter(r=>r.skills.some(s=>s.replace(/^nomi:/,'')===r.expect));
  const falses=not.filter(r=>r.activation);
  return {recall:should.length?hit.length/should.length:null,falseTrigger:not.length?falses.length/not.length:null,routed:hit.length?routed.length/hit.length:null,missed:should.filter(r=>!r.activation).map(r=>r.case),falses:falses.map(r=>r.case),misrouted:hit.filter(r=>!routed.includes(r)).map(r=>r.case)};
}
const RUN_ID=/\d{13}-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g;
// Agents run the CLI from the project, its parent or the skill folder, so search the whole eval root.
export function findReports(root) {
  const reports=new Map();
  for(const file of fs.readdirSync(root,{recursive:true})) {
    if(!/(?:^|[\\/])\.nomi[\\/]runs[\\/][^\\/]+[\\/]report\.json$/.test(file))continue;
    try {const r=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));if(r.nomi===1&&r.kind==='web'&&path.basename(path.dirname(file))===r.id)reports.set(r.id,{...r,dir:path.dirname(path.join(root,file))});}catch{/* not a report */}
  }
  return reports;
}
// Deterministic check of the final report's evidence claims: a sentence that says a capture was
// looked at needs an opened capture of that viewport; "N findings" needs a produced report with N.
export function evidenceClaims(final,opened,reports) {
  const claims=[];
  for(const sentence of final.split(/(?<=[.!?])\s+|\n+/)) {
    if(/\b(?:did not|didn't|not (?:open|view|look|check|re-?open)|never|haven't|without (?:opening|looking))\b/i.test(sentence))continue;
    if(/\b(?:opened|looked at|viewed|checked|saw|inspected)\b[^.]*\b(?:screenshots?|captures?|images?|contact sheet)\b|\b(?:screenshots?|captures?|contact sheet)\b[^.]*\b(?:shows?|showed|looks?|looked|confirm(?:s|ed)?)\b/i.test(sentence)) {
      const widths=[...sentence.matchAll(/\b(\d{3,4})\s*(?:[×x]\s*\d{3,4}|px)\b/g)].map(m=>m[1]);
      claims.push({kind:'image',text:sentence.slice(0,160),valid:opened.length>0&&widths.every(w=>opened.some(p=>/contact\.png$/i.test(p)||path.basename(p).includes(w)))});
    }
    for(const m of sentence.matchAll(/\b(\d+)\s+findings?\b/gi)) claims.push({kind:'metric',text:sentence.slice(0,160),valid:reports.some(r=>r.findings.length===Number(m[1])||r.viewports.some(v=>v.findings.length===Number(m[1])))});
  }
  return claims;
}
export function transcriptGrade(events,root) {
  const calls=events.flatMap(e=>e.type==='assistant' ? (e.message?.content||[]).filter(c=>c.type==='tool_use'):[]);
  const results=events.flatMap(e=>e.type==='user' ? (e.message?.content||[]).filter(c=>c.type==='tool_result'):[]);
  const successes=new Set(results.filter(r=>!r.is_error).map(r=>r.tool_use_id));
  const written=findReports(root);
  const reports=calls.flatMap(c=>{
    if(!['Bash','PowerShell'].includes(c.name)||!/nomi\.mjs["']?\s+(?:--json\s+)?observe\b/.test(c.input?.command||''))return [];
    const output=results.find(r=>r.tool_use_id===c.id);
    const text=typeof output?.content==='string'?output.content:JSON.stringify(output?.content||'');
    return [...new Set(text.match(RUN_ID)||[])].filter(id=>written.has(id)).map(id=>written.get(id));
  });
  const opened=calls.filter(c=>c.name==='Read' && /\.png$/i.test(c.input?.file_path||'') && successes.has(c.id)).map(c=>path.resolve(root,c.input.file_path));
  const looked=opened.filter(p=>reports.some(r=>p.startsWith(r.dir+path.sep)));
  const final=events.filter(e=>e.type==='assistant').at(-1)?.message?.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n')||'';
  const claims=evidenceClaims(final,opened,reports);
  return {activation:calls.some(c=>c.name==='Skill' && /nomi/.test(c.input?.skill||'')),skills:calls.filter(c=>c.name==='Skill').map(c=>c.input?.skill),firstAction:calls[0]?.name||null,coreRead:calls.some(c=>c.name==='Read'&&/[\\/]nomi[\\/]SKILL\.md$/.test(c.input?.file_path||'')&&successes.has(c.id)),dnaRead:calls.some(c=>c.name==='Read'&&/[\\/]\.nomi[\\/]dna\.md$/.test(c.input?.file_path||'')),observed:reports.length>0,looked:looked.length>0,opened:opened.length,claims:claims.length,validClaims:claims.filter(c=>c.valid).length,invalidClaims:claims.filter(c=>!c.valid).map(c=>c.text)};
}
export function pairwiseScore(first,swapped) {
  if([first,swapped].some(v=>!['A','B','tie'].includes(v)))throw new Error('judge vote must be A, B or tie');
  return ((first==='A'?1:first==='tie'?.5:0)+(swapped==='B'?1:swapped==='tie'?.5:0))/2;
}
export function gradeDefects(report,defects) {
  return defects.map(d=>({id:d.id,fixed:report.viewports.length>0&&report.viewports.every(v=>{
    const seen=d.code==='web.contrast'?v.census.contrast.some(c=>c.node===d.node&&c.status==='pass'):d.code==='web.focus'?v.census.focus.nodes?.includes(d.node):v.census.nodes?.includes(d.node);
    return seen && (!d.content||v.census.copy.toLowerCase().includes(d.content.toLowerCase())) && !report.findings.some(f=>f.code===d.code&&f.node===d.node);
  })}));
}
export function parseJudge(events,text) {
  const complete=events.findLast(e=>e.type==='turn.completed');
  const usage=complete?.usage;
  // Upper estimate: charge every input at cache-write price, no cache discount.
  const cost=usage?(usage.input_tokens*2.5+usage.output_tokens*10)/1e6:null;
  const failure=events.find(e=>['turn.failed','error'].includes(e.type));
  if(failure||!complete)return {cost,usage,error:failure?.error?.message||failure?.message||'judge missing completed turn'};
  try {const vote=JSON.parse(text);if(!['A','B','tie'].includes(vote.winner)||typeof vote.reason!=='string')throw new Error('invalid judge vote');return {...vote,cost,usage,error:null};}
  catch(error){return {cost,usage,error:error.message};}
}
// npm installs codex on Windows as a .cmd shim, which spawn cannot run without a shell; run its script with Node instead.
export function codexCommand(env=process.env) {
  if(env.NOMI_CODEX)return [env.NOMI_CODEX];
  const script=env.APPDATA&&path.join(env.APPDATA,'npm','node_modules','@openai','codex','bin','codex.js');
  return process.platform==='win32'&&script&&fs.existsSync(script)?[process.execPath,script]:['codex'];
}
async function judgePairs(output,ledgerFile,ledger,model,versus='without') {
  const base=path.join(output,model,'web-golden');
  for(const name of fs.readdirSync(base))for(let run=1;run<=3;run++) {
    const results=['with',versus].map(arm=>evaluationResult(output,ledger,evalIdentity(`web-golden/${name}`,arm,run,model)));
    if(results.some(r=>r.error))throw new Error('cannot judge errored runs');
    // Full-page desktop and phone renders: briefs ask for content that sits below the first screen.
    const target=readCase(path.join(ROOT,'evals','cases','web-golden',name)).config.target||'index.html';
    const renders=[];
    for(const r of results) {
      const dir=path.join(output,'judge-renders',model,name,String(run),r.arm);fs.mkdirSync(path.join(dir,'.nomi'),{recursive:true}); // own state: runs resolve to the nearest .nomi upward
      const done=fs.existsSync(path.join(dir,'.nomi','runs'))&&fs.readdirSync(path.join(dir,'.nomi','runs'))[0];
      renders.push(done?readRun(done,dir).report.viewports.map(v=>v.image):(await observe(path.join(r.workspace,target),{cwd:dir,full:true})).report.viewports.map(v=>v.image));
    }
    const votes=[];
    for(let swap=0;swap<2;swap++) {
      const key=`judge/gpt-6-sol/${model}/${versus==='without'?'':`vs-${versus}/`}${name}/${run}/${swap}`;
      const prior=ledger.find(r=>r.key===key);
      const out=path.join(output,key);
      if(prior&&!prior.error){votes.push(JSON.parse(fs.readFileSync(path.join(out,'result.json'),'utf8')).winner);continue;}
      if(prior)throw new Error(`inspect failed judge ${key} before retrying`);
      reserveBudget(ledger,2);
      const pending={key,cost:null,error:'judge interrupted'};ledger.push(pending);fs.writeFileSync(ledgerFile,JSON.stringify(ledger,null,2));
      const temp=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-judge-'));
      const workspace=path.join(temp,'project');fs.mkdirSync(workspace);
      try {
        // The judge uses the normal Codex login so Codex refreshes it itself; copied access tokens were rejected (401).
        // User config, rules and session history stay out: --ignore-user-config --ignore-rules --ephemeral, read-only sandbox.
        const order=swap?[results[1],results[0]]:results;
        const images=(swap?[renders[1],renders[0]]:renders).flatMap((pair,i)=>pair.map((file,j)=>{const copy=path.join(workspace,`${i?'B':'A'}-${j?'phone':'desktop'}.png`);fs.copyFileSync(file,copy);return copy;}));
        const schema=path.join(workspace,'schema.json');fs.writeFileSync(schema,JSON.stringify({type:'object',properties:{winner:{type:'string',enum:['A','B','tie']},reason:{type:'string'}},required:['winner','reason'],additionalProperties:false}));
        const prompt=readCase(path.join(ROOT,'evals','cases','web-golden',name)).prompt;
        const instruction=`Judge these two rendered web pages against the brief below. Images 1 and 2 are page A (full-page desktop at 1440 px wide, then phone at 390 px); images 3 and 4 are page B in the same order. You know nothing about the builders. Consider fit to brief, visual distinctiveness, craft (including readable type and broken layout), and coherence. A default-looking template with relevant copy is not automatically distinctive. Ties allowed. Use only attached screenshots. Do not run commands, inspect files, or use tools. Return the schema with a short reason.\nBrief:\n${prompt}`;
        fs.mkdirSync(out,{recursive:true});const answer=path.join(out,'vote.json');
        const [codex,...prefix]=codexCommand();
        const execution=await invoke(codex,[...prefix,'exec','--ignore-user-config','--ignore-rules','--ephemeral','--skip-git-repo-check','--sandbox','read-only','--model','gpt-6-sol','-c','model_reasoning_effort="low"','--json','--output-schema',schema,'--output-last-message',answer,...images.flatMap(i=>['--image',i]),'--',instruction] /* --image takes several values; -- keeps the brief a prompt */,{cwd:workspace,env:process.env,output:out,timeout:120000});
        let events=[];try{events=execution.stdout.trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));}catch{/* reported by parseJudge */}
        const result=parseJudge(events,fs.existsSync(answer)?fs.readFileSync(answer,'utf8'):'');
        result.model='gpt-6-sol';result.swap=Boolean(swap);result.date=new Date().toISOString();
        if(execution.code!==0)result.error=`judge exited ${execution.code}: ${execution.stderr.trim().slice(-300)}`;
        fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));
        Object.assign(pending,{cost:result.cost,error:result.error});fs.writeFileSync(ledgerFile,JSON.stringify(ledger,null,2));
        console.log(JSON.stringify({key,...result}));if(result.error)throw new Error(result.error);votes.push(result.winner);
      } finally {fs.rmSync(temp,{recursive:true,force:true,maxRetries:5});}
    }
    console.log(JSON.stringify({case:name,run,preference:pairwiseScore(...votes)}));
  }
}
export function evaluationResult(output,ledger,key) {
  const entry=ledger.find(r=>r.key===key);
  if(!entry)throw new Error(`missing run: ${key}`);
  return JSON.parse(fs.readFileSync(path.join(entry.output||path.join(output,key),'result.json'),'utf8'));
}
export function invoke(command,args,{cwd,env,timeout=300000,output,until}) {
  return new Promise(resolve=>{
    const child=spawn(command,args,{cwd,env,windowsHide:true,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='',timedOut=false;
    const stop=()=>{if(!child.pid)return;if(process.platform==='win32')spawnSync(path.join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:2000});else {try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}}};
    const timer=setTimeout(()=>{timedOut=true;stop();},timeout);
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
    const finish=result=>{clearTimeout(timer);process.off('SIGINT',stop);process.off('SIGTERM',stop);resolve(result);};
    child.stdout.on('data',s=>{stdout+=s;if(output)fs.appendFileSync(path.join(output,'transcript.jsonl'),s);if(until?.(stdout))stop();}); child.stderr.on('data',s=>{stderr+=s;if(output)fs.appendFileSync(path.join(output,'stderr.txt'),s);});
    child.on('error',e=>finish({stdout,stderr:e.message,code:2}));
    child.on('close',code=>finish({stdout,stderr,code,timedOut}));
  });
}
export function hostArgs(prompt,model,cap,plugin,effort='low',settingSources='',maxTurns=32) {
  const args=['-p',prompt,'--model',model,'--effort',effort,'--output-format','stream-json','--verbose','--no-session-persistence','--setting-sources',settingSources,'--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--allowedTools','Read,Write,Edit,Glob,Grep,Bash,PowerShell,Skill','--max-budget-usd',String(cap),'--max-turns',String(maxTurns)];
  if(plugin)args.push('--plugin-dir',plugin);
  return args;
}
const ORIGINAL=new Map();
// S1 findings the untouched fixture already has: "new S1" means introduced by the agent, not merely left alone.
async function originalS1(config) {
  if(!config.fixture)return new Set();
  if(!ORIGINAL.has(config.fixture)) {
    const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-original-'));fs.mkdirSync(path.join(scratch,'.nomi'));
    try {const r=await observe(path.join(ROOT,'evals','fixtures',config.fixture,config.target||'index.html'),{cwd:scratch});ORIGINAL.set(config.fixture,new Set(r.report.findings.filter(f=>f.severity==='S1').map(f=>`${f.viewport}:${f.code}:${f.node}`)));}
    finally {fs.rmSync(scratch,{recursive:true,force:true,maxRetries:3});}
  }
  return ORIGINAL.get(config.fixture);
}
async function runOne({suite,name,prompt,config},arm,cap,output,model,{pluginRoot=ROOT,effort='low',install='plugin',host='claude'}={}) {
  const codex=host==='codex';
  const authentication=codex?{}:loadAuth();
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-eval-'));
  const workspace=path.join(temp,'project'), auth=path.join(temp,'config');
  fs.mkdirSync(workspace);fs.mkdirSync(auth);
  // Pass only a short-lived access token. Copying refresh tokens can rotate the
  // user's original session out of validity; never persist either token in artifacts.
  fs.writeFileSync(path.join(auth,'.claude.json'),JSON.stringify({hasCompletedOnboarding:true}));
  if(config.fixture) fs.cpSync(path.join(ROOT,'evals','fixtures',config.fixture),workspace,{recursive:true});
  const plugin=path.join(temp,'plugin');
  if(arm==='with') {
    fs.mkdirSync(plugin);fs.cpSync(path.join(pluginRoot,'skills'),path.join(plugin,'skills'),{recursive:true});
    fs.cpSync(path.join(pluginRoot,'.claude-plugin'),path.join(plugin,'.claude-plugin'),{recursive:true});
  }
  // Competitor arm (reported, never gated): Anthropic's frontend-design plugin instead of Nomi.
  if(arm==='competitor') fs.cpSync(process.env.NOMI_COMPETITOR_PLUGIN||path.join(os.homedir(),'.claude','plugins','marketplaces','claude-plugins-official','plugins','frontend-design'),plugin,{recursive:true});
  const env={...process.env,...authentication,CLAUDE_CONFIG_DIR:auth}; delete env.CLAUDECODE;
  // Project install: skill folders side by side in the workspace, as a user would copy them (no plugin).
  // Codex reads project skills from .agents/skills; it has no plugin flag, so its with arm is always a project install.
  const project=arm==='with'&&(install==='project'||codex);
  if(project) fs.cpSync(path.join(pluginRoot,'skills'),path.join(workspace,codex?'.agents':'.claude','skills'),{recursive:true});
  const [command,...prefix]=codex?codexCommand():[process.env.NOMI_CLAUDE || 'claude'];
  const args=codex?codexArgs(prompt,model,effort):hostArgs(prompt,model,cap,arm==='without'||project?null:plugin,effort,project?'project':'',config.maxTurns);
  // A trigger run only needs the first actions: stop Codex once a Nomi skill is read or four commands have run.
  const until=codex&&config.maxTurns?text=>{const calls=codexEvents(text.slice(0,text.lastIndexOf('\n')+1),workspace).events.flatMap(e=>e.type==='assistant'?e.message.content:[]);return calls.some(c=>c.name==='Skill')||calls.filter(c=>c.name==='Bash').length>=4;}:undefined;
  const start=Date.now();
  fs.mkdirSync(output,{recursive:true});
  const execution=await invoke(command,[...prefix,...args],{cwd:workspace,env:codex?process.env:env,output,until});
  fs.mkdirSync(output,{recursive:true}); fs.writeFileSync(path.join(output,'transcript.jsonl'),execution.stdout);fs.writeFileSync(path.join(output,'stderr.txt'),execution.stderr);
  const parsed=codex?codexEvents(execution.stdout,workspace):parseTranscript(execution.stdout);
  // Trigger runs are cut short on purpose (turn limit, or the early stop above); that is not a failed run.
  const cut=config.maxTurns&&(/error_max_turns/.test(parsed.error||'')||(codex&&until(execution.stdout)));
  if(cut){parsed.error=null;execution.code=0;execution.timedOut=false;}
  const init=parsed.events.find(e=>e.type==='system'&&e.subtype==='init');
  const result={case:name,suite,arm,host,workspace,pluginRoot,effort,install:codex?'project':install,expect:config.expect,browserSandbox:process.env.NOMI_BROWSER_NO_SANDBOX==='1'?'off':'on',hostVersion:spawnSync(command,[...prefix,'--version'],{encoding:'utf8',windowsHide:true}).stdout?.trim(),model,date:new Date().toISOString(),cost:parsed.cost,error:parsed.error,ms:Date.now()-start,turns:parsed.turns,usage:parsed.usage,skills:init?.skills,plugins:init?.plugins,tools:init?.tools};
  if(execution.code!==0 || execution.timedOut) result.error ||= execution.timedOut?'host timed out':`host exited ${execution.code}: ${execution.stderr.slice(-500)}`;
  if(!result.error && codex && arm!=='with' && parsed.events.some(e=>e.message?.content?.some(c=>c.name==='Skill')))result.error='baseline contaminated by Nomi';
  // Match names, not paths: every copied plugin lives in a nomi-eval-* temp folder.
  if(!result.error && arm!=='with' && (init?.skills||[]).some(n=>/(?:^|:)nomi$/.test(n))||(!result.error && arm!=='with' && (init?.plugins||[]).some(p=>p.name==='nomi')))result.error='baseline contaminated by Nomi';
  if(!result.error) {
    result.behavior=transcriptGrade(parsed.events,temp);
    result.regex=(config.regex||[]).filter(rule=>!rule.source).map(rule=>({id:rule.id,pass:fs.existsSync(path.join(workspace,rule.file))&&gradeRegex(fs.readFileSync(path.join(workspace,rule.file),'utf8'),rule)}));
    if(config.render!==false) try { // routing cases produce no page: "render": false skips the neutral render
      const render=await observe(path.join(workspace,config.target||'index.html'),{cwd:workspace});
      result.render=render.report;
      result.regex.push(...(config.regex||[]).filter(rule=>rule.source==='renderedCopy').map(rule=>({id:rule.id,pass:render.report.viewports.every(v=>gradeRegex(v.census.copy,rule))})));
      result.defects=gradeDefects(render.report,config.defects||[]);
      const original=await originalS1(config);
      result.newS1=render.report.findings.filter(f=>f.severity==='S1'&&!(config.defects||[]).some(d=>d.code===f.code&&d.node===f.node)).map(f=>`${f.viewport}:${f.code}:${f.node}`).filter(key=>!original.has(key));
    } catch(error) {result.error=`neutral render: ${error.message}`;}
  }
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));
  // Preserve outputs for review, but never retain the copied credentials.
  fs.rmSync(auth,{recursive:true,force:true,maxRetries:3});
  return result;
}
async function main() {
  const {values:opts}=parseArgs({options:{suite:{type:'string'},model:{type:'string',default:'claude-sonnet-5-5'},arm:{type:'string',default:'both'},versus:{type:'string',default:'without'},'plugin-root':{type:'string'},install:{type:'string',default:'plugin'},label:{type:'string'},effort:{type:'string',default:'low'},ceiling:{type:'string',default:'25'},runs:{type:'string',default:'3'},cap:{type:'string',default:'0.5'},out:{type:'string',default:'evals/results/phase-2'},case:{type:'string'},host:{type:'string',default:'claude'},'retry-errors':{type:'boolean'}}});
  if(!['claude','codex'].includes(opts.host))throw new Error('--host must be claude or codex');
  if(!opts.suite)throw new Error('--suite required (or judge)');
  const output=path.resolve(opts.out);fs.mkdirSync(output,{recursive:true});
  const ledgerFile=path.join(output,'ledger.json');
  const ledger=fs.existsSync(ledgerFile)?JSON.parse(fs.readFileSync(ledgerFile,'utf8')):[];
  if(opts.suite==='judge')return judgePairs(output,ledgerFile,ledger,opts.model,opts.versus);
  if(opts.suite==='regrade') { // re-score saved transcripts and workspaces after a grader fix; no model calls
    for(const entry of ledger.filter(e=>!e.error&&e.key.startsWith(`${opts.model}/`))) {
      const dir=entry.output||path.join(output,entry.key), file=path.join(dir,'result.json'), result=JSON.parse(fs.readFileSync(file,'utf8'));
      const text=fs.readFileSync(path.join(dir,'transcript.jsonl'),'utf8');
      result.behavior=transcriptGrade((result.host==='codex'?codexEvents(text,result.workspace):parseTranscript(text)).events,path.dirname(result.workspace));
      fs.writeFileSync(file,JSON.stringify(result,null,2));console.log(JSON.stringify({key:entry.key,...result.behavior}));
    }
    return;
  }
  if(opts.suite==='trigger-report') { // recall and false-trigger rate from saved trigger runs; no model calls
    const results=ledger.filter(e=>!e.error&&e.key.startsWith(`${opts.model}/`)&&e.key.includes('trigger/')).map(e=>JSON.parse(fs.readFileSync(path.join(e.output,'result.json'),'utf8'))).map(r=>({case:r.case,expect:r.expect,...r.behavior}));
    console.log(JSON.stringify({model:opts.model,runs:results.length,...triggerSummary(results)},null,2));return;
  }
  const cases=opts.suite.split(',').flatMap(name=>loadCases(name,opts.case?.split(',')));
  const arms=opts.arm==='both'?['without','with']:[opts.arm];
  if(arms.some(a=>!['with','without','competitor'].includes(a)))throw new Error('arm must be with, without, competitor or both');
  const runs=Number(opts.runs);if(!Number.isInteger(runs)||runs<1||runs>3)throw new Error('runs must be 1–3');
  // loadCases has already checked every regex, before any paid call
  if(opts.host==='claude')loadAuth(); // no cost reservation or workspace if authentication is unavailable
  for(const dir of cases)for(let run=1;run<=runs;run++)for(const arm of arms) {
    const scope=`${opts.label?`${opts.label}/`:''}${dir.suite}/${dir.name}`; // a label keeps variants of one case apart
    const key=evalIdentity(scope,arm,run,opts.model);
    const prior=ledger.find(r=>r.key===key);
    if(prior && !prior.error)continue;
    if(prior && !opts['retry-errors'])throw new Error(`prior error in ${key}; inspect it, then pass --retry-errors`);
    if(prior)prior.key+=`/failed-${Date.now()}`;
    const cap=reserveBudget(ledger,Number(opts.cap),Number(opts.ceiling));
    const runOutput=path.join(output,opts.model,...scope.split('/'),arm,prior?`${run}-retry-${Date.now()}`:String(run));
    const pending={key,output:runOutput,cost:null,error:'run interrupted before result'};
    ledger.push(pending);fs.writeFileSync(ledgerFile,JSON.stringify(ledger,null,2));
    console.log(`START ${key} (cap $${cap})`);
    const result=await runOne(dir,arm,cap,runOutput,opts.model,{pluginRoot:path.resolve(opts['plugin-root']||ROOT),effort:opts.effort,install:opts.install,host:opts.host});
    Object.assign(pending,{cost:result.cost,error:result.error});fs.writeFileSync(ledgerFile,JSON.stringify(ledger,null,2));
    console.log(JSON.stringify({key,cost:result.cost,error:result.error,behavior:result.behavior,defects:result.defects}));
    if(result.error)throw new Error(`eval failed: ${result.error}; inspect error before resuming`);
  }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=2;});
