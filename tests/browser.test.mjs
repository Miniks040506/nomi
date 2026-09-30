import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, findBrowser } from '../skills/nomi/scripts/lib/browser.mjs';
import { evaluate } from '../skills/nomi/scripts/lib/cdp.mjs';
import { serve } from '../skills/nomi/scripts/lib/serve.mjs';

const fixture = fileURLToPath(new URL('../evals/fixtures/web-census', import.meta.url));
let executable;
try { executable = findBrowser(); } catch { /* explicit skip below */ }
test('real browser census, captures and cleanup on success and navigation failure', { skip: !executable && 'No Chromium installed; set NOMI_BROWSER' }, async t => {
  const probeFile = new URL('../skills/nomi/scripts/probes/web-census.js', import.meta.url);
  assert.ok(fs.existsSync(probeFile), 'web census probe is missing');
  const browser = await launchBrowser({ executable });
  t.after(() => browser.close());
  const server = await serve(fixture); t.after(() => server.close());
  await browser.page.send('Page.enable');
  await browser.page.send('Page.navigate', { url: server.url });
  await evaluate(browser.page, 'new Promise(r => document.readyState === "complete" ? r() : window.addEventListener("load",r,{once:true}))');
  const probe = fs.readFileSync(probeFile, 'utf8');
  await evaluate(browser.page, `(() => {const p=document.createElement('p');p.textContent='station a7';p.style.textTransform='uppercase';document.body.append(p);})()`);
  const census = await evaluate(browser.page, probe);
  assert.match(census.copy,/STATION A7/);
  assert.deepEqual(census.type.sizes, [16, 32]);
  assert.equal(census.type.families.length, 1);
  assert.deepEqual(census.colors.text, ['rgb(0, 0, 0)', 'rgb(170, 170, 170)']);
  assert.deepEqual(census.contrast.filter(c => c.status === 'fail').map(c => c.node), ['#low']);
  assert.equal(census.contrast.find(c => c.node === '#unknown').status, 'unknown');
  assert.ok(census.overflow.some(c => c.node === '#wide'));
  assert.ok(census.focus.missing.some(c => c.node === '#bad'));
  assert.ok(!census.focus.missing.some(c => c.node === '#focus'));
  assert.equal(await evaluate(browser.page, 'document.activeElement.tagName'), 'BODY');
  await evaluate(browser.page, `(() => {
    const fixture=document.createElement('section');
    fixture.innerHTML='<div style="opacity:0"><p style="color:lime;font-size:77px">invisible ancestor</p></div><div style="opacity:.5"><p id="opacity" style="background:white">opacity remains unknown</p></div><div style="width:200px;overflow-x:auto"><div id="scroller" style="width:2000px">intentional inner scrolling</div></div><button id="transparent" style="outline:3px solid transparent">Transparent ring</button><p id="stroke" style="color:transparent;-webkit-text-stroke:1px black">Outlined</p>';
    document.body.append(fixture);
  })()`);
  const edgeCensus=await evaluate(browser.page,probe);
  assert.ok(!edgeCensus.type.sizes.includes(77),'opacity-zero descendants are not rendered text');
  assert.equal(edgeCensus.contrast.find(c=>c.node==='#opacity').status,'unknown');
  assert.equal(edgeCensus.contrast.find(c=>c.node==='#stroke').status,'unknown','stroked text with a transparent fill is not measurable from its colour');
  assert.ok(!edgeCensus.overflow.some(c=>c.node==='#scroller'),'local scroll containers must not become document-overflow findings');
  assert.ok(edgeCensus.focus.missing.some(c=>c.node==='#transparent'),'transparent outlines are not visible indicators');
  await evaluate(browser.page, `(() => {const a=document.createElement('a');a.id='skip';a.href='#good';a.textContent='Skip to content';a.style.cssText='position:absolute;left:-9999px';document.body.append(a);})()`);
  assert.ok(!(await evaluate(browser.page,probe)).overflow.some(c=>c.node==='#skip'),'offscreen skip links do not cause document overflow');
  const { observe, diffRuns } = await import('../skills/nomi/scripts/lib/capture.mjs');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-observe-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true, maxRetries: 5 }));
  const start = Date.now();
  const first = await observe(fixture, { cwd });
  assert.ok(Date.now() - start < 15000, 'two viewports must finish within 15 seconds');
  assert.equal(first.report.nomi, 1);
  assert.equal(first.report.viewports.length, 2);
  assert.equal(first.report.viewports[0].census.focus.method, 'keyboard Tab');
  assert.ok(first.report.viewports[0].census.type.renderedFamilies.length > 0);
  assert.ok(first.report.images.length <= 4);
  assert.ok(first.report.images.every(p => fs.existsSync(p)));
  assert.ok(fs.readFileSync(path.join(first.dir, 'summary.md'), 'utf8').trim().split('\n').length <= 60);
  assert.deepEqual(Object.keys(first.report.viewports[0].census).sort(), Object.keys(census).sort());
  const second = await observe(path.join(fixture, 'index.html'), { cwd, viewport: ['800x600'], dark: true, 'reduced-motion': true });
  const diff = await diffRuns(first.id, second.id, { cwd });
  assert.ok(fs.existsSync(diff.report.images[0]));
  assert.ok(Array.isArray(diff.report.deltas));
  await assert.rejects(observe('http://127.0.0.1:1', { cwd }), /navigate|ERR_|unreachable/i);
  await browser.close();
  assert.equal(fs.existsSync(browser.profile), false);
  assert.throws(() => process.kill(browser.pid, 0));
});

test('phone viewports have no desktop scrollbar, and optical bleed is not overflow while clipped content is', {skip: !executable && 'No Chromium installed'}, async t => {
  const {observe}=await import('../skills/nomi/scripts/lib/capture.mjs');
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-overflow-'));t.after(()=>fs.rmSync(cwd,{recursive:true,force:true,maxRetries:5}));
  fs.writeFileSync(path.join(cwd,'index.html'),'<meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;overflow-x:hidden"><h1 id="optical" style="margin:0 0 0 -4px;font:80px Arial">STATIC</h1><div id="fits" style="width:385px">Fits a 390 px phone</div><p id="clipped" style="margin-left:-40px">Clipped by the edge</p><div style="height:2000px"></div>');
  const overflow=(await observe(cwd,{cwd,viewport:['390x844']})).report.viewports[0].census.overflow.map(o=>o.node);
  assert.deepEqual(overflow,['#clipped']);
});

test('keyboard pass distinguishes identical controls and rejects transparent rings', {skip: !executable && 'No Chromium installed'}, async t => {
  const {observe}=await import('../skills/nomi/scripts/lib/capture.mjs');
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-keyboard-'));t.after(()=>fs.rmSync(cwd,{recursive:true,force:true,maxRetries:5}));
  fs.writeFileSync(path.join(cwd,'index.html'),'<style>button{outline:3px solid transparent}</style><button>Same</button><button>Same</button><button>Same</button>');
  const run=await observe(cwd,{cwd,viewport:['800x600']});
  assert.equal(run.report.viewports[0].census.focus.tested,3);
  assert.equal(run.report.viewports[0].census.focus.missing.length,3);
});

test('capture bounds a page with an unfinished request and reports incomplete settling', {skip: !executable && 'No Chromium installed'}, async t => {
  const {createServer}=await import('node:http');
  const {observe}=await import('../skills/nomi/scripts/lib/capture.mjs');
  const server=createServer((req,res)=>{if(req.url==='/hold')return;res.end('<p>Ready</p><script>fetch("/hold")</script>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-settle-'));t.after(()=>fs.rmSync(cwd,{recursive:true,force:true,maxRetries:5}));
  const start=Date.now();const run=await observe(`http://127.0.0.1:${server.address().port}`,{cwd,viewport:['800x600'],wait:400});
  assert.ok(Date.now()-start<10000);
  assert.ok(run.report.notes.some(n=>n.includes('Settle budget')));
});

test('browser cleanup removes its process and profile after interruption signal', {skip: !executable && 'No Chromium installed'}, async t => {
  const {spawn}=await import('node:child_process');
  const script=`import {launchBrowser} from ${JSON.stringify(new URL('../skills/nomi/scripts/lib/browser.mjs',import.meta.url).href)}; const b=await launchBrowser(); console.log(JSON.stringify({pid:b.pid,profile:b.profile})); process.emit('SIGINT');`;
  const child=spawn(process.execPath,['--input-type=module','-e',script],{env:{...process.env,NOMI_BROWSER:executable},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let text='',err='';child.stdout.on('data',s=>text+=s);child.stderr.on('data',s=>err+=s);
  const code=await new Promise(resolve=>child.on('close',resolve));
  assert.equal(code,130,err);
  const data=JSON.parse(text.trim());
  assert.equal(fs.existsSync(data.profile),false);
  assert.throws(()=>process.kill(data.pid,0));
});

test('Windows cleanup kills the tree while its root still exists', {skip: process.platform!=='win32'||!executable},async()=>{
  const browser=await launchBrowser({executable});
  const send=browser.cdp.send.bind(browser.cdp);let closedRootFirst=false;
  browser.cdp.send=(method,...args)=>{if(method==='Browser.close')closedRootFirst=true;return send(method,...args);};
  await browser.close();
  assert.equal(closedRootFirst,false,'graceful root exit can orphan children before taskkill /T sees them');
  assert.equal(fs.existsSync(browser.profile),false);
});

test('observe CLI exits 1 for advisory findings while preserving JSON evidence', {skip:!executable&&'No Chromium installed'},async t=>{
  const {spawnSync}=await import('node:child_process');
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-advisory-'));t.after(()=>fs.rmSync(cwd,{recursive:true,force:true,maxRetries:5}));
  fs.writeFileSync(path.join(cwd,'index.html'),'<body style="background:white;color:black"><p>Unlock possibilities.</p>');
  const cli=fileURLToPath(new URL('../skills/nomi/scripts/nomi.mjs',import.meta.url));
  const r=spawnSync(process.execPath,[cli,'observe','.','--viewport','800x600','--json'],{cwd,env:{...process.env,NOMI_BROWSER:executable},encoding:'utf8'});
  assert.equal(r.status,1,r.stderr);
  assert.ok(JSON.parse(r.stdout).findings.every(f=>f.severity==='S2'));
});

test('a locked profile after a finished capture warns instead of discarding the run, and the server still closes', {skip:!executable&&'No Chromium installed'},async t=>{
  const http=(await import('node:http')).default;
  const {observe}=await import('../skills/nomi/scripts/lib/capture.mjs');
  const original=http.createServer, remove=fs.promises.rm, warnings=[], onWarning=w=>warnings.push(w.message);let server;
  http.createServer=(...args)=>(server=original(...args));
  fs.promises.rm=async(p,...args)=>{await remove(p,...args);if(path.basename(p).startsWith('nomi-browser-'))throw Object.assign(new Error('simulated lock'),{code:'EBUSY'});};
  process.on('warning',onWarning);
  t.after(()=>{http.createServer=original;fs.promises.rm=remove;process.off('warning',onWarning);server?.closeAllConnections();server?.close();});
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-cleanup-'));t.after(()=>fs.rmSync(cwd,{recursive:true,force:true,maxRetries:5}));
  const run=await observe(fixture,{cwd,viewport:['800x600']});
  assert.ok(fs.existsSync(path.join(run.dir,'report.json')));
  assert.equal(server.listening,false);
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(warnings.some(w=>/profile not removed.*EBUSY/.test(w)),warnings.join('\n'));
});

test('a failed navigation leaves no browser profile behind', {skip:!executable&&'No Chromium installed'},async t=>{
  const {observe}=await import('../skills/nomi/scripts/lib/capture.mjs');
  const profiles=()=>new Set(fs.readdirSync(os.tmpdir()).filter(n=>n.startsWith('nomi-browser-')));
  const before=profiles();
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'nomi-failure-'));t.after(()=>fs.rmSync(cwd,{recursive:true,force:true,maxRetries:5}));
  await assert.rejects(observe('http://127.0.0.1:1',{cwd,viewport:['800x600']}),/navigate|ERR_/i);
  assert.deepEqual([...profiles()].filter(n=>!before.has(n)),[]);
  assert.deepEqual(fs.readdirSync(path.join(cwd,'.nomi','runs')),[],'a failed capture keeps no partial run');
});
