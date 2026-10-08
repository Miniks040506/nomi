import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser, findBrowser } from './browser.mjs';
import { evaluate } from './cdp.mjs';
import { serve } from './serve.mjs';
import { compose } from './compose.mjs';
import { createRun, saveRun, readRun } from './runs.mjs';
import { findDna } from './dna.mjs';
import { splitFrontmatter } from './frontmatter.mjs';
import { captureMotion, parseScript } from './motion.mjs';
import { captureFlows, parseFlows, isLocal } from './flow.mjs';

export function parseViewports(values = ['1440x900','390x844']) {
  if (!values.length || values.length>4) throw new Error('use 1–4 viewports');
  return values.map(value=>{
    if (!/^\d+x\d+$/.test(value)) throw new Error(`invalid viewport: ${value}`);
    const [width,height]=value.split('x').map(Number);
    if (width<100 || height<100 || width>4096 || height>4096) throw new Error('viewport dimensions must be 100–4096');
    return {width,height};
  });
}
export async function settle(page, wait, navigate=async()=>{}) {
  const start=Date.now(); let quiet=Date.now(), inflight=new Set(), loaded=false;
  const listener=m=>{
    if(m.sessionId!==page.sessionId) return;
    if(m.method==='Network.requestWillBeSent' && !['WebSocket','EventSource'].includes(m.params.type)) { inflight.add(m.params.requestId); quiet=Date.now(); }
    if(['Network.loadingFinished','Network.loadingFailed'].includes(m.method)) { inflight.delete(m.params.requestId); quiet=Date.now(); }
  };
  page.cdp.listeners.add(listener);
  try {
    await navigate();
    while(Date.now()-start<wait) {
      loaded=await evaluate(page,'document.readyState === "complete" && document.fonts.status === "loaded"');
      if(loaded && !inflight.size && Date.now()-quiet>=200) return [];
      await delay(40);
    }
    return [`Settle budget ${wait} ms reached; captured current state (load/fonts ready: ${loaded}).`];
  } finally { page.cdp.listeners.delete(listener); }
}
async function blankPage(browser) {
  const {targetId}=await browser.cdp.send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await browser.cdp.send('Target.attachToTarget',{targetId,flatten:true});
  return {send:(method,params)=>browser.cdp.send(method,params,sessionId)};
}
async function platformFonts(page,census) {
  try {
    await page.send('DOM.enable'); await page.send('CSS.enable');
    const {root}=await page.send('DOM.getDocument');
    const {nodeIds}=await page.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'body *'});
    const families=new Set();
    for(let i=0;i<Math.min(nodeIds.length,200);i+=25) await Promise.all(nodeIds.slice(i,i+25).map(async nodeId=>{
      const {fonts}=await page.send('CSS.getPlatformFontsForNode',{nodeId});
      for(const font of fonts) if(font.glyphCount>0) families.add(font.familyName);
    }));
    census.type.renderedFamilies=[...families].sort();
    if(nodeIds.length>200) census.notes.push('Platform-font sampling limited to first 200 elements.');
  } catch(error) { census.notes.push(`Platform fonts unavailable: ${error.message}`); }
}
async function keyboardFocus(page,census) {
  const saved=await page.send('Runtime.evaluate',{expression:'document.activeElement'});
  const scroll=await evaluate(page,'[scrollX,scrollY]');
  const missing=[], visited=new Set();
  const start=Date.now();
  try {
    await evaluate(page,'document.activeElement?.blur()');
    for(let i=0;i<Math.min(census.focus.tested+1,201) && Date.now()-start<1200;i++) {
      await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
      await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
      const hit=await evaluate(page,`(() => {const e=document.activeElement;if(!e||e===document.body)return null;const s=getComputedStyle(e);const nodes=${JSON.stringify(census.focus.nodes)};const node=nodes.find(n=>document.querySelector(n)===e);return {node,ring:s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0&&!/rgba\\([^)]*,\\s*0\\s*\\)$/.test(s.outlineColor)};})()`);
      if(!hit)continue;
      if(!hit.node)continue;
      if(visited.has(hit.node))break;
      visited.add(hit.node);
      if(census.focus.missing.some(c=>c.node===hit.node)&&!hit.ring)missing.push({node:hit.node});
    }
    census.focus={method:'keyboard Tab',tested:visited.size,nodes:[...visited],missing,truncated:visited.size<census.focus.tested};
    if(census.focus.truncated)census.notes.push('Keyboard pass bounded at 200 controls / 1200 ms; unvisited controls remain unverified.');
  } finally {
    if(saved.result.objectId) {
      await page.send('Runtime.callFunctionOn',{objectId:saved.result.objectId,functionDeclaration:'function(){ if(this!==document.body)this.focus({preventScroll:true});else document.activeElement?.blur(); }'}).catch(()=>{});
      await page.send('Runtime.releaseObject',{objectId:saved.result.objectId});
    }
    await evaluate(page,`scrollTo(${scroll[0]},${scroll[1]})`);
  }
}
function findings(census) {
  return [
    ...census.contrast.filter(x=>x.status==='fail').map(x=>({code:'web.contrast',severity:'S1',node:x.node,message:`contrast ${x.ratio}:1 < ${x.required}:1`,value:x.ratio})),
    ...census.overflow.map(x=>({code:'web.overflow',severity:'S1',node:x.node,message:`extends outside viewport (${x.width}px)`,value:x.width})),
    ...census.focus.missing.map(x=>({code:'web.focus',severity:'S1',node:x.node,message:'no detected focus indicator; inspect keyboard state'})),
    ...census.tapTargets.map(x=>({code:'web.tap-target',severity:'S2',node:x.node,message:`${x.width}x${x.height}px; inspect spacing exception`})),
  ];
}
export function tokenDrift(census, design='') {
  const color = value => {
    const hex=/^#([a-f\d]{6}|[a-f\d]{3})$/i.exec(value.trim());
    if(hex) {const h=hex[1].length===3?[...hex[1]].map(c=>c+c).join(''):hex[1];return `rgb(${[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)).join(', ')})`;}
    return /^rgb\([\d, ]+\)$/.test(value)?value:null;
  };
  const palette=new Set(Object.values(census.customProperties).map(color).filter(Boolean));
  const sections = title => new RegExp(`^##\\s+${title}[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`,'im').exec(design)?.[1]||'';
  const colors=sections('colors');
  for(const m of colors.matchAll(/#[\da-f]{6}\b|#[\da-f]{3}\b/gi))palette.add(color(m[0]));
  const result=[];
  if(palette.size)for(const value of new Set(Object.values(census.colors).flat()))if(color(value)&&!palette.has(color(value)))result.push({code:'web.token-color',severity:'S2',value,message:`${value} is outside declared tokens; intentional semantic color or drift?`});
  const type=sections('typography');
  const families=[...type.matchAll(/(?:body|heading|display|font(?:-family)?)\s*[:|]\s*[`"']?([^\n|`"';]+)/gi)].map(m=>m[1].trim().toLowerCase());
  if(families.length)for(const value of census.type.families)if(!families.some(f=>value.toLowerCase().includes(f)))result.push({code:'web.token-font',severity:'S2',value,message:`${value} differs from DESIGN.md typography; check role before changing`});
  return result;
}
function designSource(cwd) {
  const dna=findDna(cwd), root=dna?path.dirname(path.dirname(dna)):cwd;
  const source=dna?splitFrontmatter(fs.readFileSync(dna,'utf8')).data?.sources?.design:null;
  const file=path.resolve(root,source||'DESIGN.md');
  return fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
}
export function fingerprintFlags(census) {
  const {entries}=JSON.parse(fs.readFileSync(new URL('../data/fingerprints.json',import.meta.url),'utf8'));
  return entries.filter(entry=>new RegExp(entry.pattern,'i').test(census.copy)).map(entry=>({code:`web.fingerprint.${entry.id}`,severity:'S2',message:entry.question}));
}
export async function observe(target, opts={}) {
  if(!target) throw new Error('observe needs a URL, file or directory');
  const viewports=parseViewports(opts.viewport ?? (opts.motion || opts.flow ? ['1440x900'] : undefined));
  if(opts.motion && viewports.length>1) throw new Error('--motion captures one viewport; pass a single --viewport');
  if(opts.interact && !opts.motion) throw new Error('--interact needs --motion');
  if(opts.flow && (opts.motion || viewports.length>1)) throw new Error('--flow is its own run with one viewport; run --motion separately');
  const flows=opts.flow ? parseFlows(fs.readFileSync(path.resolve(opts.cwd || process.cwd(),opts.flow),'utf8')) : null;
  // A flow clicks, types and submits for real. It never runs on a site unless the user named that URL and asked for it.
  if(flows && !isLocal(target) && !opts.live) throw new Error('--flow acts on the page for real, so it only runs on a local target (a file, a folder or a localhost URL). For another URL add --live, and only when the user named that URL and asked for it');
  const steps=opts.interact ? parseScript(fs.readFileSync(path.resolve(opts.cwd || process.cwd(),opts.interact),'utf8')) : [];
  const wait=opts.wait===undefined ? (opts.motion ? 4000 : 1800) : Number(opts.wait);
  if(!Number.isFinite(wait) || wait<200 || wait>5000) throw new Error('--wait must be 200–5000 ms');
  // The opt-in sandbox switch is for the project's own pages only: files, folders and loopback dev servers.
  if(process.env.NOMI_BROWSER_NO_SANDBOX==='1' && !isLocal(target)) throw new Error('NOMI_BROWSER_NO_SANDBOX=1 only captures local pages (a file, a folder or a localhost URL); unset it for other URLs');
  const executable=findBrowser();
  let server,browser,run;
  try {
    let url;
    if(/^https?:\/\//i.test(target)) { url=new URL(target); if(url.username || url.password) throw new Error('URLs with credentials are not supported'); url=url.href; }
    else { server=await serve(path.resolve(opts.cwd || process.cwd(),target)); url=server.url; }
    browser=await launchBrowser({executable});
    run=createRun(opts.cwd);
    const report={nomi:1,id:run.id,kind:'web',target,label:opts.label || '',created:new Date().toISOString(),browser:browser.version,transport:browser.transport,viewports:[],images:[],findings:[],notes:[]};
    if(process.env.NOMI_BROWSER_NO_SANDBOX==='1')report.notes.push('Browser sandbox was off (NOMI_BROWSER_NO_SANDBOX=1).');
    const page=browser.page;
    const design=designSource(opts.cwd||process.cwd());
    await page.send('Page.enable'); await page.send('Network.enable');
    if(opts.motion) {
      report.kind='motion';
      await captureMotion({page,url,viewport:viewports[0],wait,steps,run,report,dark:opts.dark,settle,cwd:opts.cwd||process.cwd(),blank:()=>blankPage(browser)});
      saveRun(run,report); return {...run,report};
    }
    if(flows) {
      report.kind='flow';
      await captureFlows({page,url,viewport:viewports[0],wait,flows,run,report,settle,blank:()=>blankPage(browser)});
      saveRun(run,report); return {...run,report};
    }
    for(const viewport of viewports) {
      // Narrow viewports are phones: overlay scrollbars and <meta viewport> handling, not a desktop window with a 15 px scrollbar.
      await page.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:viewport.width<768});
      await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:opts.dark?'dark':'light'},{name:'prefers-reduced-motion',value:opts['reduced-motion']?'reduce':'no-preference'}]});
      const notes=await settle(page,wait,async()=>{
        const navigation=await page.send('Page.navigate',{url});
        if(navigation.errorText) throw new Error(`navigate: ${navigation.errorText}`);
      });
      const census=await evaluate(page,fs.readFileSync(new URL('../probes/web-census.js',import.meta.url),'utf8'));
      await platformFonts(page,census);
      await keyboardFocus(page,census);
      const measured=[...findings(census),...tokenDrift(census,design),...fingerprintFlags(census)].map(f=>({...f,viewport:`${viewport.width}x${viewport.height}`}));
      const image=path.join(run.dir,`${viewport.width}x${viewport.height}.png`);
      const params={format:'png',captureBeyondViewport:Boolean(opts.full)};
      if(opts.full) {
        const {cssContentSize}=await page.send('Page.getLayoutMetrics');
        params.clip={x:0,y:0,width:Math.min(cssContentSize.width,4096),height:Math.min(cssContentSize.height,8192),scale:1};
        if(cssContentSize.height>8192 || cssContentSize.width>4096) notes.push('Full screenshot capped at 4096x8192 pixels.');
      }
      const shot=await page.send('Page.captureScreenshot',params);
      fs.writeFileSync(image,Buffer.from(shot.data,'base64'));
      report.images.push(image); report.viewports.push({...viewport,census,findings:measured,image,notes}); report.findings.push(...measured); report.notes.push(...notes);
    }
    if(report.images.length>1) {
      const sheet=path.join(run.dir,'contact.png');
      fs.writeFileSync(sheet,Buffer.from(await compose(await blankPage(browser),report.images,viewports.map(v=>`${v.width}x${v.height}`)),'base64'));
      report.images=[sheet,...report.images].slice(0,4);
    }
    report.notes.push('Measurements are evidence, not a taste score. Inspect the images before making visual claims.');
    saveRun(run,report); return {...run,report};
  } catch(error) {
    if(run) fs.rmSync(run.dir,{recursive:true,force:true,maxRetries:3});
    throw error;
  } finally { try { await browser?.close(); } finally { await server?.close(); } }
}
export async function diffRuns(a,b,opts={}) {
  const before=readRun(a,opts.cwd).report, after=readRun(b,opts.cwd).report;
  if(before.kind!==after.kind||!['web','motion','flow'].includes(after.kind)) throw new Error('diff needs two observation runs of the same kind');
  let browser,run;
  try {
    browser=await launchBrowser(); run=createRun(opts.cwd);
    const deltas=[];
    if(after.kind==='motion') {
      const viewport=after.motion.viewport, count=(r,code)=>r.findings.filter(f=>f.code===code).length;
      const metric=(name,x,y)=>deltas.push({viewport,metric:name,before:x,after:y,delta:y-x});
      metric('motion.animations',before.motion.animations.length,after.motion.animations.length);
      if(before.motion.load.settleMs!==null&&after.motion.load.settleMs!==null) metric('motion.settle-ms',before.motion.load.settleMs,after.motion.load.settleMs);
      for(const code of new Set([...before.findings,...after.findings].map(f=>f.code))) metric(code,count(before,code),count(after,code));
    }
    if(after.kind==='flow') {
      const viewport=after.viewport, done=r=>r.flows.filter(f=>f.status==='completed').length, count=(r,code)=>r.findings.filter(f=>f.code===code).length;
      deltas.push({viewport,metric:'flows.completed',before:done(before),after:done(after),delta:done(after)-done(before)});
      for(const flow of after.flows) { const was=before.flows.find(f=>f.name===flow.name)?.status??'absent'; if(was!==flow.status) deltas.push({viewport,metric:`flow "${flow.name}"`,before:was,after:flow.status}); }
      for(const code of new Set([...before.findings,...after.findings].map(f=>f.code))) deltas.push({viewport,metric:code,before:count(before,code),after:count(after,code),delta:count(after,code)-count(before,code)});
    }
    for(const current of after.viewports) {
      const previous=before.viewports.find(v=>v.width===current.width&&v.height===current.height);
      if(!previous) { deltas.push({viewport:`${current.width}x${current.height}`,unmatched:true}); continue; }
      for(const key of ['families','sizes']) deltas.push({viewport:`${current.width}x${current.height}`,metric:`type.${key}`,before:previous.census.type[key].length,after:current.census.type[key].length,delta:current.census.type[key].length-previous.census.type[key].length});
      for(const code of new Set([...previous.findings,...current.findings].map(f=>f.code))) {
        const count=v=>v.findings.filter(f=>f.code===code).length;
        deltas.push({viewport:`${current.width}x${current.height}`,metric:code,before:count(previous),after:count(current),delta:count(current)-count(previous)});
      }
    }
    const image=path.join(run.dir,'before-after.png');
    fs.writeFileSync(image,Buffer.from(await compose(browser.page,[before.images[0],after.images[0]],['Before','After']),'base64'));
    const report={nomi:1,id:run.id,kind:'diff',before:a,after:b,deltas,viewports:[],images:[image],findings:[],notes:deltas.map(d=>`${d.viewport} ${d.metric||'viewport'}: ${d.unmatched?'no matching before viewport':`${d.before} → ${d.after}${d.delta===undefined?'':` (${d.delta>=0?'+':''}${d.delta})`}`}`)};
    saveRun(run,report); return {...run,report};
  } catch(error) { if(run) fs.rmSync(run.dir,{recursive:true,force:true}); throw error; }
  finally { await browser?.close(); }
}
