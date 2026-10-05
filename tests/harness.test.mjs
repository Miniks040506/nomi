import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const url = new URL('../evals/harness/runner.mjs', import.meta.url);
async function harness() { assert.ok(fs.existsSync(url), 'isolated eval harness is missing'); return import(url); }
test('harness rejects error runs before grading and charges reported usage', async () => {
  const { parseTranscript } = await harness();
  const r = parseTranscript(JSON.stringify({type:'result',is_error:true,subtype:'error_max_budget_usd',total_cost_usd:.2,result:'limit'})+'\n');
  assert.equal(r.cost,.2); assert.match(r.error,/error_max_budget/);
  assert.match(parseTranscript('').error,/result/);
});
test('regex graders distinguish compliant zero radius from a real violation', async () => {
  const { gradeRegex } = await harness();
  const rule={pattern:'border-radius:\\s*(?!0(?:px)?\\s*[;}])\\d+',flags:'i',expect:false};
  assert.equal(gradeRegex('border-radius: 0;',rule),true);
  assert.equal(gradeRegex('border-radius: 12px;',rule),false);
});
test('budget reservation prevents starting a run that could exceed the phase ceiling', async () => {
  const { reserveBudget } = await harness();
  assert.equal(reserveBudget([{cost:24}],1,25),1);
  assert.throws(()=>reserveBudget([{cost:24.5}],1,25),/budget/);
  assert.throws(()=>reserveBudget([{cost:null}],1,25),/unknown/);
});

test('isolated hosts get only an unexpired access token, never a copied refresh credential', async () => {
  const { isolatedAuth }=await harness();
  assert.equal(typeof isolatedAuth,'function','isolated auth helper missing');
  assert.deepEqual(isolatedAuth({claudeAiOauth:{accessToken:'test-access',refreshToken:'never-copy',expiresAt:Date.now()+3600000}}),{CLAUDE_CODE_OAUTH_TOKEN:'test-access'});
  assert.throws(()=>isolatedAuth({claudeAiOauth:{accessToken:'expired',expiresAt:1}}),/sign in/);
  assert.throws(()=>isolatedAuth({claudeAiOauth:{accessToken:'undated'}}),/sign in/);
});

test('auth preflight failure reserves no model budget and leaves no unknown charge', async t => {
  const {spawnSync}=await import('node:child_process');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-eval-preflight-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const env={...process.env,CLAUDE_CONFIG_DIR:dir};delete env.CLAUDE_CODE_OAUTH_TOKEN;
  const result=spawnSync(process.execPath,[new URL('../evals/harness/runner.mjs',import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/,''),'--suite','web-seeded','--arm','without','--runs','1','--out',dir],{env,encoding:'utf8'});
  assert.equal(result.status,2);assert.equal(fs.existsSync(path.join(dir,'ledger.json')),false,'auth failure must occur before a paid reservation');
});

test('transcript graders reject a fabricated observation command and unopened image', async t => {
  const { transcriptGrade }=await harness();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-grader-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const events=[{type:'assistant',message:{content:[{type:'tool_use',id:'failed',name:'Bash',input:{command:'node nomi.mjs observe .'}}]}},{type:'user',message:{content:[{type:'tool_result',tool_use_id:'failed',is_error:true,content:'launch failed'}]}},{type:'assistant',message:{content:[{type:'text',text:'I opened the 1440x900 screenshot and it looks good.'}]}}];
  const result=transcriptGrade(events,root);
  assert.equal(result.observed,false);assert.equal(result.claims,1);assert.equal(result.validClaims,0);
});

test('observations count wherever the agent ran the CLI, and claims must match what was produced and opened', async t => {
  const { transcriptGrade }=await harness();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-grader-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const id='1790585771830-51650ea5-37fb-4c9c-9944-81202b454a89', dir=path.join(root,'plugin','skills','nomi','.nomi','runs',id);
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({nomi:1,id,kind:'web',findings:[],viewports:[{findings:[]}]}));fs.writeFileSync(path.join(dir,'390x844.png'),'');
  const say=text=>[{type:'assistant',message:{content:[{type:'tool_use',id:'o',name:'Bash',input:{command:'cd plugin/skills/nomi && node scripts/nomi.mjs observe ../../../project/index.html'}},{type:'tool_use',id:'r',name:'Read',input:{file_path:path.join(dir,'390x844.png')}}]}},{type:'user',message:{content:[{type:'tool_result',tool_use_id:'o',content:`Run ${id} · web`},{type:'tool_result',tool_use_id:'r',content:'image'}]}},{type:'assistant',message:{content:[{type:'text',text}]}}];
  const good=transcriptGrade(say('I opened the 390×844 screenshot. The tool reported 0 findings. I did not open the desktop capture.'),root);
  assert.equal(good.observed,true);assert.equal(good.looked,true);assert.deepEqual([good.claims,good.validClaims],[2,2]);
  const bad=transcriptGrade(say('The 1440×900 screenshot shows a clean layout, with 3 findings left.'),root);
  assert.deepEqual([bad.claims,bad.validClaims],[2,0]);
});

test('findings exit 1 still counts as observation only when its reported run exists', async t => {
  const {transcriptGrade}=await harness();
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-grader-'));t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  const id='1790585771830-51650ea5-37fb-4c9c-9944-81202b454a89';
  const dir=path.join(cwd,'.nomi','runs',id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({nomi:1,id,kind:'web'}));
  const events=[{type:'assistant',message:{content:[{type:'tool_use',id:'measured',name:'Bash',input:{command:'node nomi.mjs observe .'}}]}},{type:'user',message:{content:[{type:'tool_result',tool_use_id:'measured',is_error:true,content:`Exit code 1\nRun ${id} · web`}]}}];
  assert.equal(transcriptGrade(events,cwd).observed,true);
  fs.unlinkSync(path.join(dir,'report.json'));assert.equal(transcriptGrade(events,cwd).observed,false);
});

test('pairwise judging parses only explicit votes and averages position-swapped outcomes', async () => {
  const {pairwiseScore}=await harness();assert.equal(typeof pairwiseScore,'function','pairwise scoring missing');
  assert.equal(pairwiseScore('A','B'),1);assert.equal(pairwiseScore('B','A'),0);assert.equal(pairwiseScore('tie','tie'),.5);
  assert.throws(()=>pairwiseScore('looks good','A'),/vote/);
});

test('eval model selection is pinned and part of result identity', async () => {
  const { evalIdentity }=await harness();
  assert.equal(typeof evalIdentity,'function','model-aware eval identity missing');
  assert.equal(evalIdentity('web-seeded/a','without',1,'claude-sonnet-5-5'),'claude-sonnet-5-5/web-seeded/a/without/1');
  assert.throws(()=>evalIdentity('web-seeded/a','without',1,'sonnet'),/pinned/);
});

test('seeded grading cannot reward deleting required content or hiding the failed element',async()=>{
  const {gradeDefects}=await harness();assert.equal(typeof gradeDefects,'function','content-preserving defect grader missing');
  const defects=[{id:'caption',code:'web.contrast',node:'#caption',content:'Meet beside the east seawall'}];
  const report={findings:[],viewports:[{census:{copy:'Meet beside the east seawall',contrast:[{node:'#caption',status:'pass'}],focus:{nodes:[]}}}]};
  assert.equal(gradeDefects(report,defects)[0].fixed,true);
  report.viewports[0].census.contrast=[];assert.equal(gradeDefects(report,defects)[0].fixed,false);
  report.viewports[0].census.copy='';assert.equal(gradeDefects(report,defects)[0].fixed,false);
});

test('judge rejects failed turns and invalid votes and reports conservative token cost',async()=>{
  const {parseJudge}=await harness();assert.equal(typeof parseJudge,'function','judge parser missing');
  const events=[{type:'turn.completed',usage:{input_tokens:10000,cached_input_tokens:1000,output_tokens:1000}}];
  assert.deepEqual(parseJudge(events,'{"winner":"A","reason":"fits brief"}'),{winner:'A',reason:'fits brief',cost:.035,usage:events[0].usage,error:null});
  assert.ok(parseJudge([{type:'turn.failed',error:{message:'limit'}}],'').error);
  assert.ok(parseJudge(events,'{"winner":"with"}').error);
});

test('both host arms retain the same native skills and differ only by Nomi plugin loading',async()=>{
  const {hostArgs}=await harness();assert.equal(typeof hostArgs,'function');
  const base=hostArgs('Build','claude-sonnet-5-5',1);
  const withNomi=hostArgs('Build','claude-sonnet-5-5',1,'plugin');
  assert.deepEqual(withNomi,[...base,'--plugin-dir','plugin']);
  assert.ok(!base.includes('--disable-slash-commands'));
});

test('judge resolves the ledger-selected successful retry instead of the first failed run',async t=>{
  const {evaluationResult}=await harness();assert.equal(typeof evaluationResult,'function');
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-retry-'));t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  const key='claude-sonnet-5-5/web-golden/a/with/1', output=path.join(cwd,'retry');fs.mkdirSync(output);
  fs.writeFileSync(path.join(output,'result.json'),'{"error":null,"sentinel":"retry"}');
  assert.equal(evaluationResult(cwd,[{key,output}],key).sentinel,'retry');
});

test('eval timeout kills descendants and returns even when they inherit output pipes',async()=>{
  const {invoke}=await harness();assert.equal(typeof invoke,'function');
  const code=`const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});console.log(child.pid);setInterval(()=>{},1000);`;
  const result=await invoke(process.execPath,['-e',code],{cwd:process.cwd(),env:process.env,timeout:500});
  assert.equal(result.timedOut,true);assert.throws(()=>process.kill(Number(result.stdout.trim()),0));
});

test('Codex transcripts grade like Claude ones: a SKILL.md read is activation, observe and opened captures count', async t => {
  const { codexEvents, transcriptGrade, codexArgs }=await harness();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-grader-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const cwd=path.join(root,'project'), id='1790585771830-51650ea5-37fb-4c9c-9944-81202b454a89', dir=path.join(cwd,'.nomi','runs',id);
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({nomi:1,id,kind:'web',findings:[],viewports:[{findings:[]}]}));
  const item=(type,rest)=>JSON.stringify({type:'item.completed',item:{id:'i',type,...rest}});
  const lines=[item('command_execution',{command:'pwsh -Command "Get-Content .agents/skills/nomi-web/SKILL.md; Get-Content .nomi/dna.md"',aggregated_output:'…',exit_code:0}),
    item('command_execution',{command:'pwsh -Command "node .agents/skills/nomi/scripts/nomi.mjs observe index.html"',aggregated_output:`Run ${id} · web`,exit_code:1}),
    item('agent_message',{text:'I opened the 390×844 screenshot. 0 findings.'}),
    item('view_image',{path:path.join(dir,'390x844.png')}),
    JSON.stringify({type:'turn.completed',usage:{input_tokens:10,output_tokens:2}})].join('\n');
  const parsed=codexEvents(lines,cwd), b=transcriptGrade(parsed.events,root);
  assert.deepEqual([parsed.error,parsed.cost,b.activation,b.skills,b.firstAction,b.dnaRead,b.observed,b.looked,b.claims,b.validClaims],[null,0,true,['nomi-web'],'Skill',true,true,true,2,2]);
  assert.equal(transcriptGrade(codexEvents(item('command_execution',{command:'ls .agents/skills',aggregated_output:'nomi-web/SKILL.md',exit_code:0}),cwd).events,root).activation,false,'a listing that mentions the skill is not activation');
  assert.match(codexEvents(lines.replace('turn.completed','turn.failed'),cwd).error,/turn failed/);
  assert.match(codexEvents('',cwd).error,/missing result/);
  const args=codexArgs('Build','gpt-6-sol');assert.equal(args.at(-1),'Build');assert.ok(args.includes('--ignore-rules')&&args.includes('workspace-write'));
});

test('trigger suite: prompts load from one list, and recall, false triggers and routing are computed', async () => {
  const { loadCases, triggerSummary }=await harness();
  const cases=loadCases('trigger');
  assert.deepEqual([cases.filter(c=>c.config.expect).length,cases.filter(c=>!c.config.expect).length],[15,15]);
  assert.ok(cases.every(c=>c.config.render===false&&c.config.maxTurns===3&&(!c.config.fixture||fs.existsSync(new URL(`../evals/fixtures/${c.config.fixture}`,import.meta.url)))));
  assert.equal(new Set(cases.map(c=>c.name)).size,30);
  assert.deepEqual(loadCases('routing').map(c=>c.name),['world-lore']);
  const r=(c,expect,skills)=>({case:c,expect,activation:skills.length>0,skills});
  assert.deepEqual(triggerSummary([r('a','nomi-web',['nomi:nomi-web']),r('b','nomi',['nomi-web']),r('c','nomi-web',[]),r('d',null,[]),r('e',null,['nomi'])]),
    {recall:2/3,falseTrigger:.5,routed:.5,missed:['c'],falses:['e'],misrouted:['b']});
});

test('host smoke grading reads activation, the doctor line, a real run and the proof number from raw host output', async t => {
  const { gradeSmoke }=await import('../tools/verify-hosts.mjs');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-smoke-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const id='1790585771830-51650ea5-37fb-4c9c-9944-81202b454a89', dir=path.join(root,'project','.nomi','runs',id);
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({nomi:1,id,kind:'web'}));
  const host={activation:'nomi(?:-web)?[\\\\/]+SKILL\\.md'};
  const text=`{"command":"cat .agents\\\\skills\\\\nomi-web\\\\SKILL.md"}\ndomains web\nRun ${id}\n{"text":"RUN: ${id}\\nDOMAINS: web\\nPROOF: **48213**\\nSUBAGENTS: yes"}`;
  assert.deepEqual(gradeSmoke(text,host,root,'48213'),{activated:true,doctor:true,observed:true,inProject:true,image:true,subagents:'yes'});
  assert.deepEqual(gradeSmoke('PROOF: 11111\nRun 1790585771830-00000000-37fb-4c9c-9944-81202b454a89',host,root,'48213'),{activated:false,doctor:false,observed:false,inProject:false,image:false,subagents:null});
});

test('behaviour signals name the skills used and whether the DNA and the core were opened', async t => {
  const { transcriptGrade, hostArgs }=await harness();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-grader-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const read=(id,file)=>({type:'tool_use',id,name:'Read',input:{file_path:file}});
  const events=[{type:'assistant',message:{content:[{type:'tool_use',id:'s',name:'Skill',input:{skill:'nomi:nomi-web'}},read('d',path.join(root,'project','.nomi','dna.md')),read('c',path.join(root,'plugin','skills','nomi','SKILL.md')),read('w',path.join(root,'plugin','skills','nomi-web','SKILL.md'))]}},
    {type:'user',message:{content:['s','d','c','w'].map(id=>({type:'tool_result',tool_use_id:id,content:'ok'}))}}];
  const b=transcriptGrade(events,root);
  assert.deepEqual([b.activation,b.skills,b.firstAction,b.dnaRead,b.coreRead],[true,['nomi:nomi-web'],'Skill',true,true]);
  assert.equal(transcriptGrade([{type:'assistant',message:{content:[read('w',path.join(root,'skills','nomi-web','SKILL.md'))]}}],root).coreRead,false,'the web skill file is not the core');
  const args=hostArgs('Build','claude-sonnet-5-5',1,null,'medium','project');
  assert.equal(args[args.indexOf('--effort')+1],'medium');assert.equal(args[args.indexOf('--setting-sources')+1],'project');
});

test('motion cases: a defect is fixed only while load motion survives, decoys must keep running, and quoted timings must be measured', async t => {
  const { gradeMotion, transcriptGrade, loadCases }=await harness();
  const anim=(name,over={})=>({name,step:0,duration:240,delay:0,iterations:1,...over});
  const report=(animations,codes)=>({motion:{animations,transitions:[{durations:[120]}],load:{settleMs:400}},findings:codes.map(code=>({code,node:'#a'}))});
  const config={minLoad:2,defects:[{id:'reduced',code:'motion.reduced-motion'},{id:'bar',code:'motion.layout-property'}],decoys:[{id:'pulse',match:{name:'pulse',iterations:'infinite'}}]};
  assert.deepEqual(gradeMotion(report([anim('settle'),anim('pulse',{iterations:'infinite'})],['motion.layout-property']),config),{defects:[{id:'reduced',fixed:true},{id:'bar',fixed:false}],decoys:[{id:'pulse',intact:true}]});
  assert.deepEqual(gradeMotion(report([],[]),config),{defects:[{id:'reduced',fixed:false},{id:'bar',fixed:false}],decoys:[{id:'pulse',intact:false}]},'deleting every animation fixes nothing');

  // "Everything enters at once" is fixed by a row-by-row entrance, even when one row still holds six elements.
  const rows={motion:{animations:[anim('enter'),anim('enter')],transitions:[],load:{}},findings:[{code:'motion.fingerprint.same-entrance',count:6}]};
  const all={...rows,findings:[{code:'motion.fingerprint.same-entrance',count:12}]};
  const entrance={minLoad:2,defects:[{id:'same-entrance',code:'motion.fingerprint.same-entrance',minCount:7}]};
  assert.deepEqual([gradeMotion(rows,entrance).defects[0].fixed,gradeMotion(all,entrance).defects[0].fixed],[true,false]);

  const seeded=loadCases('motion-seeded'), golden=loadCases('motion-golden');
  assert.deepEqual([seeded.length,golden.length],[3,2]);
  assert.ok([...seeded,...golden].every(c=>c.config.observe==='motion'));
  assert.ok(seeded.every(c=>fs.existsSync(new URL(`../evals/fixtures/${c.config.fixture}/.nomi/dna.md`,import.meta.url))&&c.config.defects.length>=2&&(c.config.decoys||c.config.regex).length>=1));

  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-motion-grade-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const id='1790585771830-51650ea5-37fb-4c9c-9944-81202b454a89', dir=path.join(root,'project','.nomi','runs',id);
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({nomi:1,id,kind:'motion',viewports:[],findings:[],...report([anim('settle',{delay:40})],[])}));
  const events=[{type:'assistant',message:{content:[{type:'tool_use',id:'o',name:'Bash',input:{command:'node skills/nomi/scripts/nomi.mjs observe index.html --motion'}}]}},
    {type:'user',message:{content:[{type:'tool_result',tool_use_id:'o',content:`Run ${id} · motion`}]}},
    {type:'assistant',message:{content:[{type:'text',text:'Rows take 240 ms, 40 ms apart, and the load settles after 400 ms. The banner eases over 350 ms.'}]}}];
  const b=transcriptGrade(events,root);
  assert.deepEqual([b.observed,b.timingsQuoted,b.timingsMeasured],[true,4,3],'350 ms was never measured');
});

test('a Codex observe left running as a background session counts with the runs it wrote before the agent finished', async t => {
  const { codexEvents, transcriptGrade }=await harness();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-codex-bg-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const cwd=path.join(root,'project'), mine='1790585771830-51650ea5-37fb-4c9c-9944-81202b454a89', neutral='1790585779999-51650ea5-37fb-4c9c-9944-81202b454a89';
  for(const id of [mine,neutral]){const dir=path.join(cwd,'.nomi','runs',id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({nomi:1,id,kind:'motion',viewports:[],findings:[],motion:{animations:[],transitions:[],load:{settleMs:null}}}));}
  const command='pwsh -Command \'node .agents/skills/nomi/scripts/nomi.mjs observe index.html --motion\'';
  const lines=[{type:'item.started',item:{id:'i4',type:'command_execution',command}},{type:'item.completed',item:{id:'m',type:'agent_message',text:'done'}},{type:'turn.completed',usage:{}}].map(l=>JSON.stringify(l)).join('\n');
  const before=transcriptGrade(codexEvents(lines,cwd,1790585775000).events,root);
  assert.equal(before.observed,true);
  const bash=codexEvents(lines,cwd,1790585775000).events.flatMap(e=>e.type==='user'?e.message.content:[]);
  assert.ok(!JSON.stringify(bash).includes(neutral),'the harness\'s own later render is not the agent\'s observation');
  assert.equal(transcriptGrade(codexEvents(lines.replace('nomi.mjs observe','nomi.mjs doctor'),cwd,1790585775000).events,root).observed,false);
});
