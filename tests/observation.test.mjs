import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const lib = new URL('../skills/nomi/scripts/lib/', import.meta.url);
async function module(name) {
  const url = new URL(`${name}.mjs`, lib);
  assert.ok(fs.existsSync(url), `${name} capability is missing`);
  return import(url);
}
function workspace(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi test tiếng Việt '));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return dir;
}

test('static serving confines decoded paths and symlinks to the target, supports file and directory', async t => {
  const { serve } = await module('serve');
  const dir = workspace(t);
  fs.mkdirSync(path.join(dir, 'site'));
  fs.writeFileSync(path.join(dir, 'secret.txt'), 'private');
  fs.writeFileSync(path.join(dir, 'site', 'index.html'), '<h1>hello</h1>');
  fs.writeFileSync(path.join(dir, 'site', 'space ü.css'), 'body{color:red}');
  const server = await serve(path.join(dir, 'site'));
  t.after(() => server.close());
  assert.match(await (await fetch(server.url)).text(), /hello/);
  assert.equal((await fetch(`${server.url}space%20%C3%BC.css`)).headers.get('content-type'), 'text/css; charset=utf-8');
  assert.equal((await fetch(`${server.url}%2e%2e%2fsecret.txt`)).status, 403);
  assert.equal((await fetch(server.url, { method: 'POST' })).status, 405);
  fs.symlinkSync(dir,path.join(dir,'site','outside'),process.platform==='win32'?'junction':'dir');
  assert.equal((await fetch(`${server.url}outside/secret.txt`)).status,403);
  fs.unlinkSync(path.join(dir,'site','outside'));
  const single = await serve(path.join(dir, 'site', 'index.html'));
  t.after(() => single.close());
  assert.match(await (await fetch(single.url)).text(), /hello/);
});

test('run storage uses nearest state, prunes only owned complete runs and rejects traversal', async t => {
  const { createRun, saveRun, readRun } = await module('runs');
  const dir = workspace(t);
  fs.mkdirSync(path.join(dir, '.nomi'));
  fs.mkdirSync(path.join(dir, 'nested'));
  let last;
  for (let i = 0; i < 12; i++) {
    last = createRun(path.join(dir, 'nested'));
    saveRun(last, { nomi: 1, id: last.id, kind: 'web', viewports: [], images: [], findings: [], notes: [] });
  }
  assert.equal(fs.readdirSync(path.join(dir, '.nomi', 'runs')).length, 10);
  assert.equal(readRun(last.id, dir).report.id, last.id);
  assert.throws(() => readRun('../dna.md', dir), /run id/);
  assert.ok(fs.readFileSync(path.join(dir, '.nomi', '.gitignore'), 'utf8').includes('runs/'));
});

test('missing browser fails actionably before ten seconds, without artifacts', async t => {
  const { findBrowser } = await module('browser');
  assert.throws(() => findBrowser({ NOMI_BROWSER: path.join(workspace(t), 'missing.exe') }), /NOMI_BROWSER|browser/);
  const started = Date.now();
  const r = spawnSync(process.execPath, [new URL('../skills/nomi/scripts/nomi.mjs', import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/, ''), 'observe', '.'], {
    cwd: workspace(t), encoding: 'utf8', env: { ...process.env, NOMI_BROWSER: 'not-a-browser' }, timeout: 10000,
  });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /probe print web/);
  assert.ok(Date.now() - started < 10000);
});

test('capture validates viewports and wait bounds before launching a browser', async () => {
  const { parseViewports } = await module('capture');
  assert.deepEqual(parseViewports(), [{ width: 1440, height: 900 }, { width: 390, height: 844 }]);
  assert.deepEqual(parseViewports(['800x600']), [{ width: 800, height: 600 }]);
  for (const bad of ['0x600', '800xNaN', '20000x100', '800x600garbage']) assert.throws(() => parseViewports([bad]), /viewport/);
});

test('CDP rejects a request when the transport closes rather than hanging', async () => {
  const { CDP } = await module('cdp');
  const { PassThrough } = await import('node:stream');
  const input = new PassThrough(), output = new PassThrough();
  const client = CDP.pipe(input, output);
  const pending = client.send('Browser.getVersion');
  input.end();
  await assert.rejects(pending, /closed/);
  client.close();
});

test('CDP parses fragmented pipe responses and rejects timed-out methods', async () => {
  const {CDP}=await module('cdp');const {PassThrough}=await import('node:stream');
  const input=new PassThrough(),output=new PassThrough(),client=CDP.pipe(input,output);
  const first=client.send('Browser.getVersion');
  input.write('{"id":1,"res');input.write('ult":{"product":"fixture"}}\0');
  assert.deepEqual(await first,{product:'fixture'});
  await assert.rejects(client.send('never',{},undefined,10),/timeout/);
  client.close();
});

test('composition rejects empty or excessive image sets before touching the browser', async () => {
  const { compose } = await module('compose');
  await assert.rejects(compose(null, []), /images/);
  await assert.rejects(compose(null, Array(5).fill('x')), /images/);
});

test('probe CLI prints runnable expression; critique accepts a measured run', async t => {
  const { createRun, saveRun } = await module('runs');
  const cwd = workspace(t), run = createRun(cwd);
  const image = path.join(run.dir, 'desktop.png'); fs.writeFileSync(image, 'image');
  saveRun(run, { nomi:1, id:run.id, kind:'web', viewports:[], images:[image], findings:[], notes:['Measured fixture'] });
  const cli = new URL('../skills/nomi/scripts/nomi.mjs', import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/, '');
  const invoke = args => spawnSync(process.execPath, [cli,...args], {cwd,encoding:'utf8'});
  const probe = invoke(['probe','print','web']);
  assert.equal(probe.status,0,probe.stderr); assert.match(probe.stdout,/getComputedStyle/);
  const packet = invoke(['critique','pack','--task','Review','--domain','web','--run',run.id]);
  assert.equal(packet.status,0,packet.stderr); assert.match(packet.stdout,/Measured fixture/); assert.ok(packet.stdout.includes(image));
  assert.match(packet.stdout,/Hierarchy: which element wins attention/,'the packet must contain the lenses, not a pointer requiring the builder context');
});

test('drift compares declared palette and fonts without treating transparent colors as deviations', async () => {
  const { tokenDrift } = await module('capture');
  assert.equal(typeof tokenDrift,'function','token drift is missing');
  const census={colors:{text:['rgb(255, 0, 0)'],background:['rgba(0, 0, 0, 0)'],border:[]},type:{families:['Arial, sans-serif']},customProperties:{'--ink':'#000000'}};
  const result=tokenDrift(census,'## Colors\n- ink: #000000\n## Typography\n- body: Georgia\n');
  assert.ok(result.some(f=>f.code==='web.token-color'&&f.value==='rgb(255, 0, 0)'));
  assert.ok(result.some(f=>f.code==='web.token-font'));
  assert.ok(!result.some(f=>f.value==='rgba(0, 0, 0, 0)'));
});

test('fingerprints raise questions, never declare a chosen style a defect', async () => {
  const {fingerprintFlags}=await module('capture');
  assert.equal(typeof fingerprintFlags,'function','fingerprint detector is missing');
  const flags=fingerprintFlags({copy:'Unlock possibilities with a seamless experience.',type:{families:['Arial']},radii:['0px'],shadows:['none']});
  assert.ok(flags.length>0);assert.ok(flags.every(f=>f.severity==='S2'&&f.message.endsWith('?')));
  assert.deepEqual(fingerprintFlags({copy:'Bring boots. Low tide at 06:20.',type:{families:['Arial']},radii:['0px'],shadows:['none']}),[]);
});

test('DESIGN.md drift reads every line in a section',async()=>{
  const {tokenDrift}=await module('capture');
  const census={colors:{text:['rgb(255, 0, 0)'],background:['rgb(0, 0, 0)'],border:[]},type:{families:['Arial, sans-serif']},customProperties:{}};
  assert.deepEqual(tokenDrift(census,'## Colors\n- ink: #000000\n- accent: #ff0000\n## Typography\n- heading: Georgia\n- body: Arial\n'),[]);
});

test('pruning preserves malformed and foreign run folders',async t=>{
  const {createRun,saveRun}=await module('runs');const cwd=workspace(t);
  const run=createRun(cwd);const foreign=path.join(run.root,'1000000000000-00000000-0000-0000-0000-000000000000');fs.mkdirSync(foreign);fs.writeFileSync(path.join(foreign,'report.json'),'{}');fs.writeFileSync(path.join(foreign,'keep.txt'),'user data');
  for(let i=0;i<11;i++){const r=createRun(cwd);saveRun(r,{nomi:1,id:r.id,kind:'web',viewports:[],images:[],findings:[],notes:[]});}
  assert.ok(fs.existsSync(path.join(foreign,'keep.txt')),'a folder name is not ownership proof');
});

test('settling tracks requests emitted during navigation, before waiting begins',async()=>{
  const {settle}=await module('capture');assert.equal(typeof settle,'function');
  const listeners=new Set();const page={sessionId:'page',cdp:{listeners},send:async()=>({result:{value:true}})};
  const notes=await settle(page,300,async()=>{for(const listener of listeners)listener({sessionId:'page',method:'Network.requestWillBeSent',params:{type:'Fetch',requestId:'slow'}});});
  assert.match(notes.join(' '),/Settle budget/);
  assert.equal(listeners.size,0);
});
