// Nomi CLI. Run as: node <skill-dir>/scripts/nomi.mjs <command>   (Node 22+, no dependencies)
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { splitFrontmatter } from './lib/frontmatter.mjs';
import { findDna, checkDna, sliceDna, DOMAINS } from './lib/dna.mjs';
import { observe, diffRuns } from './lib/capture.mjs';
import { launchBrowser } from './lib/browser.mjs';
import { readRun, summary, stateDir } from './lib/runs.mjs';
import { checkPlan, findPlan, productTypes } from './lib/plan.mjs';
import { review, reviewText, writeProof } from './lib/review.mjs';
import { record, compose, checkVideo, videoText } from './lib/record.mjs';
import { checkReadme, runCommand } from './lib/readme.mjs';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HELP = `usage: node <skill-dir>/scripts/nomi.mjs <command> [--json]

  plan init --type <id>           create .nomi/plan.md: the product read, its jobs as flows, screens, done
  plan check                      lint the plan; prints what the product type cannot ship without
  dna init                        create .nomi/dna.md from the template
  dna check [file]                lint the nearest .nomi/dna.md (exit 1 on findings)
  dna show [--for <domain>]       print DNA sections; domains: ${Object.keys(DOMAINS).join(', ')}
  critique pack --task "<text>" [--evidence <file>]... [--domain <domain>] [--out <file>]
                                  write a self-contained brief for an independent critic
  doctor                          check Node, the skill folder and project DNA
  observe <url|file|dir>           capture and measure (default: desktop and mobile)
    --viewport 1440x900            repeat up to 4; --full --dark --reduced-motion
    --wait 1800 --label "<text>"    bounded settling in ms (200–5000)
    --motion [--interact <file>]   animation inventory, load timeline and reduced-motion comparison;
                                   the file is a JSON list of hover, press, click, focus, scroll, wait steps
    --flow <flows.json|plan.md>    run the jobs as steps: completed or the failing step, dead clicks,
                                   console errors, a sheet per flow. Local targets only (--live: a URL the user named)
  diff <runA> <runB>               metric deltas and a before/after sheet
  review [<url|file|dir>]         measured verdict from the latest runs and the plan; writes .nomi/proof.md.
                                  With a target it first captures it and runs the flows of the plan or .nomi/flows.json
  brandvid <url|file|dir>         the demo video, filmed from the product's flows as .nomi/storyboard.json orders them:
    [--out <dir>]                  demo.mp4, poster.png, preview.webp and sheet.png in .nomi/video/ (exit 1 when its check fails)
  brandvid compose <file.html>    render a trailer written as one 1920x1080 page (<html data-duration="22">), frame by frame, with sound
  brandvid check [<dir>]          measure an existing video again: length, black or frozen stretches, flows, captions
  readme check [file]             lint a README: media and local links that do not exist, commands nobody ran, claims
  readme run "<command>"          run a quick-start command and record the result (--seconds 20: a server still up counts)
  probe print <web|motion>        runnable probe for a host browser tool
  critique pack --task "…" --run <id>  include measured evidence
  version

exit codes: 0 ok, 1 findings, 2 error`;

class UsageError extends Error {}
const fail = (message) => { throw new UsageError(message); };
const rel = (p) => path.relative(process.cwd(), p) || '.';
const read = (...parts) => fs.readFileSync(path.join(SKILL_DIR, ...parts), 'utf8');
// A domain is a module file inside the skill: modules/<domain>.md.
const domainSkill = (domain) => [path.join(SKILL_DIR, 'modules', `${domain}.md`)].find((f) => fs.existsSync(f));

function print(opts, json, text, code = 0) {
  console.log(opts.json ? JSON.stringify(json, null, 2) : text);
  return code;
}

function version() {
  return splitFrontmatter(read('SKILL.md')).data.metadata.version;
}

function dnaFile(file) {
  const found = file ? path.resolve(file) : findDna(process.cwd());
  if (!found || !fs.existsSync(found)) fail(`no .nomi/dna.md found from ${process.cwd()} upward; create one with: nomi dna init`);
  return found;
}

function checkDomain(domain) {
  if (domain !== undefined && !Object.hasOwn(DOMAINS, domain)) fail(`unknown domain "${domain}"; use one of: ${Object.keys(DOMAINS).join(', ')}`);
}

function dnaInit() {
  const dir = path.join(process.cwd(), '.nomi');
  const target = path.join(dir, 'dna.md');
  if (fs.existsSync(target)) fail(`${rel(target)} already exists; edit it instead`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(target, read('assets', 'dna.md').replace('{{project}}', () => path.basename(process.cwd())));
  const ignore = path.join(dir, '.gitignore');
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, 'runs/\n');
  const pointed = pointAgentsAtDna();
  const note = pointed.length ? `; ${pointed.join(' and ')} now point to it` : '';
  console.log(`created ${rel(target)}${note}. Fill Intent, Character, Signature and Never, then run: nomi dna check`);
  return 0;
}

// Skills load only when a host decides they are relevant; the project's always-read
// instruction files make every agent, with or without Nomi, see the DNA.
function pointAgentsAtDna() {
  const pointer = 'Creative direction for this project lives in `.nomi/dna.md`: read it before changing anything people see, and follow its Never list.';
  const files = ['AGENTS.md', 'CLAUDE.md'].map((f) => path.join(process.cwd(), f)).filter((f) => fs.existsSync(f));
  if (!files.length) files.push(path.join(process.cwd(), 'AGENTS.md'));
  const touched = [];
  for (const file of files) {
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (text.includes('.nomi/dna.md')) continue;
    fs.writeFileSync(file, text ? `${text.replace(/\n*$/, '\n')}\n${pointer}\n` : `${pointer}\n`);
    touched.push(path.basename(file));
  }
  return touched;
}

function dnaCheck(opts, file) {
  const target = dnaFile(file);
  const words = JSON.parse(read('scripts', 'data', 'vague-words.json')).words;
  const findings = checkDna(fs.readFileSync(target, 'utf8'), words);
  const lines = findings.slice(0, 50).map((f) => `${f.line ? `L${f.line}` : '--'}  ${f.code}  ${f.message}`);
  if (findings.length > 50) lines.push(`... ${findings.length - 50} more`);
  lines.push(findings.length ? `${rel(target)}: ${findings.length} finding(s)` : `${rel(target)}: ok`);
  return print(opts, { file: target, findings }, lines.join('\n'), findings.length ? 1 : 0);
}

function dnaShow(opts, file) {
  checkDomain(opts.for);
  process.stdout.write(sliceDna(fs.readFileSync(dnaFile(file), 'utf8'), opts.for));
  return 0;
}

function critiquePack(opts) {
  if (!opts.task) fail('critique pack needs --task "<what was made, and for whom>"');
  checkDomain(opts.domain);
  const evidence = opts.evidence || [];
  const observation = opts.run ? readRun(opts.run) : null;
  if (observation) evidence.push(...observation.report.images);
  const missing = evidence.filter((e) => !fs.existsSync(path.resolve(e)));
  if (missing.length) fail(`evidence not found: ${missing.join(', ')}`);

  const dnaPath = findDna(process.cwd());
  const dna = dnaPath ? sliceDna(fs.readFileSync(dnaPath, 'utf8'), opts.domain) : 'No project DNA exists. Judge against the task and the existing product.';
  const module = opts.domain && domainSkill(opts.domain);
  const lens = module ? /^## Critique lenses\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(fs.readFileSync(module,'utf8'))?.[1].trim() : 'No domain module applies; use the rules below.';
  const brief = read('assets', 'critic-brief.md')
    .replace('{{task}}', () => opts.task)
    .replace('{{dna}}', () => dna.trim())
    .replace('{{evidence}}', () => (evidence.length ? evidence.map((e) => `- ${e}`).join('\n') : '- None supplied: report what could not be verified.') + (observation ? `\n\n${summary(observation.report)}` : ''))
    .replace('{{lens}}', () => lens);

  if (!opts.out) {
    process.stdout.write(brief);
    return 0;
  }
  fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
  fs.writeFileSync(opts.out, brief);
  console.log(`wrote ${opts.out}`);
  return 0;
}

function planInit(opts) {
  const types = productTypes(), type = types.find((t) => t.id === opts.type);
  if (!type && opts.type !== 'other') fail(`plan init needs --type <id>, the kind of product this is: ${types.map((t) => `${t.id} (${t.name})`).join(', ')}, or other`);
  const dir = stateDir(process.cwd()), target = path.join(dir, 'plan.md');
  if (fs.existsSync(target)) fail(`${rel(target)} already exists; edit it instead`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(target, read('assets', 'plan.md').replace('{{project}}', () => path.basename(path.dirname(dir))).replace('{{type}}', () => opts.type));
  const lines = [`created ${rel(target)} (type ${opts.type}).`];
  if (type) lines.push(`A ${type.name.toLowerCase()} product cannot ship without (set "covers" on the flow that does each):`, ...type.flows.map((f) => `  ${f.id}: ${f.job}`), 'Its reviewer asks:', ...type.questions.map((q) => `  - ${q}`));
  lines.push('Write Read, Flows, Screens and Done before any interface file, then run: nomi plan check');
  console.log(lines.join('\n'));
  return 0;
}

function planCheck(opts, file) {
  const target = file ? path.resolve(file) : findPlan();
  if (!target || !fs.existsSync(target)) fail(`no .nomi/plan.md found from ${process.cwd()} upward; create one with: nomi plan init --type <id>`);
  const result = checkPlan(fs.readFileSync(target, 'utf8'));
  const lines = result.findings.map((f) => `${f.line ? `L${f.line}` : '--'}  ${f.code}  ${f.message}`);
  if (result.uncovered.length) lines.push(`No flow covers, for a ${result.type} product: ${result.uncovered.map((f) => `${f.id} (${f.job})`).join('; ')}. Add the flow with "covers", or say under Done why it is out of scope.`);
  if (result.questions.length) lines.push('The review will ask:', ...result.questions.map((q) => `  - ${q}`));
  lines.push(result.findings.length ? `${rel(target)}: ${result.findings.length} finding(s)` : `${rel(target)}: ok, ${result.flows.length} flow(s). After building, run them: nomi observe <target> --flow ${rel(target)}`);
  return print(opts, { file: target, ...result }, lines.join('\n'), result.findings.length ? 1 : 0);
}

// With a target, review first measures it: a fresh capture, then the flows of the plan or of .nomi/flows.json.
async function runReview(opts, target) {
  if (target) {
    await observe(target, { live: opts.live });
    const dir = stateDir(process.cwd()), flows = [findPlan(), path.join(dir, 'flows.json')].find((f) => f && fs.existsSync(f) && (path.basename(f) !== 'plan.md' || /^```json/m.test(fs.readFileSync(f, 'utf8'))));
    if (flows) await observe(target, { flow: flows, live: opts.live });
  }
  const result = review(process.cwd());
  const proof = Object.values(result.runs).some(Boolean) ? await writeProof(result) : null;
  const lines = reviewText(result);
  if (proof) lines.push(`Proof card: ${rel(proof.card)}${proof.image ? ` and ${rel(proof.image)} (open it)` : ''}`);
  return print(opts, { verdict: result.verdict, blockers: result.blockers, judge: result.judge, notVerified: result.notVerified, runs: Object.fromEntries(Object.entries(result.runs).map(([k, r]) => [k, r?.id ?? null])), proof }, lines.join('\n'), result.blockers.length ? 1 : 0);
}

// The stage the work is in, for anything that wants to show it. Written only inside an existing .nomi/; nothing reads it yet.
const STAGES = { plan: 'plan', dna: 'design', observe: 'measure', diff: 'measure', critique: 'review', review: 'review', brandvid: 'present', readme: 'present' };
function stage(cmd, sub) {
  const dir = stateDir(process.cwd());
  if (!STAGES[cmd] || !fs.existsSync(dir)) return;
  try { fs.writeFileSync(path.join(dir, 'stage.json'), `${JSON.stringify({ nomi: 1, stage: STAGES[cmd], command: [cmd, sub].filter((s) => s && !/[\\/.:]/.test(s)).join(' '), at: new Date().toISOString() })}\n`); } catch { /* a read-only project still gets its command */ }
}

async function brandvid(opts, sub, file) {
  if (sub === 'check') {
    const dir = path.resolve(file || path.join(stateDir(process.cwd()), 'video')), { report, findings } = await checkVideo(dir);
    const lines = [...findings.map((f) => `${f.severity} ${f.code}: ${f.message}`), findings.some((f) => f.severity === 'S1') ? `${rel(dir)}: check FAILED` : `${rel(dir)}: check passed (${report.duration.toFixed(1)} s, ${report.scenes.filter((s) => s.status === 'completed').length} flow(s))`];
    return print(opts, { dir, findings }, lines.join('\n'), findings.some((f) => f.severity === 'S1') ? 1 : 0);
  }
  const { report, outDir } = sub === 'compose' ? await compose(file, opts) : await record(sub, opts);
  return print(opts, report, videoText(report, outDir || process.cwd()).join('\n'), report.findings.some((f) => f.severity === 'S1') ? 1 : 0);
}

async function readme(opts, sub, arg) {
  const root = path.dirname(stateDir(process.cwd()));
  if (sub === 'run') {
    if (!arg) fail('readme run needs the command in quotes: nomi readme run "npm start"');
    const seconds = opts.seconds === undefined ? 20 : Number(opts.seconds);
    if (!(seconds >= 1 && seconds <= 200)) fail('--seconds must be 1–200');
    const r = await runCommand(arg, { cwd: process.cwd(), seconds });
    const how = r.alive ? `still running after ${seconds} s (counts as started; it was stopped)` : r.ok ? `exit 0 in ${r.seconds} s` : `FAILED with exit ${r.exit}`;
    return print(opts, r, [`${r.command}: ${how}`, ...(r.output ? [r.output] : []), r.ok ? 'Recorded in .nomi/commands.json.' : 'Recorded as failed. A README must not tell a reader to run it as it is.'].join('\n'), r.ok ? 0 : 1);
  }
  if (sub !== 'check') fail('use: nomi readme check [file], or: nomi readme run "<command>"');
  const target = path.resolve(arg || path.join(root, 'README.md'));
  if (!fs.existsSync(target)) fail(`no README at ${rel(target)}`);
  const findings = checkReadme(fs.readFileSync(target, 'utf8'), { root: path.dirname(target), cwd: process.cwd() });
  const blocking = findings.filter((f) => f.severity === 'S1').length;
  const lines = findings.slice(0, 50).map((f) => `L${f.line}  ${f.severity} ${f.code}  ${f.message}`);
  if (findings.length > 50) lines.push(`... ${findings.length - 50} more`);
  lines.push(blocking ? `${rel(target)}: ${blocking} to fix, ${findings.length - blocking} to judge` : `${rel(target)}: nothing to fix${findings.length ? `, ${findings.length} to judge` : ''}`);
  return print(opts, { file: target, findings }, lines.join('\n'), blocking ? 1 : 0);
}

async function doctor(opts) {
  const nodeOk = Number(process.versions.node.split('.')[0]) >= 22;
  const dna = findDna(process.cwd());
  let writable = true;
  try { fs.accessSync(process.cwd(), fs.constants.W_OK); } catch { writable = false; }
  let browser;
  try { const launched = await launchBrowser(); browser = { ok: true, version: launched.version.product, transport: launched.transport }; await launched.close(); }
  catch (error) { browser = { ok: false, error: error.message }; }
  const domains = Object.keys(DOMAINS).filter((d) => domainSkill(d));
  const report = { node: { version: process.versions.node, ok: nodeOk }, skillDir: SKILL_DIR, domains, dna, writable, browser };
  const text = [
    `node   ${process.versions.node} ${nodeOk ? 'ok' : 'too old: need 22 or newer'}`,
    `skill  ${SKILL_DIR}`,
    `domains ${domains.length ? domains.join(', ') : 'no module files found'}`,
    `dna    ${dna ? rel(dna) : 'none yet (Create-tier work starts with: nomi dna init)'}`,
    `write  ${writable ? 'ok' : `cannot write to ${process.cwd()}`}`,
    `browser ${browser.ok ? browser.version : browser.error}`,
  ].join('\n');
  return print(opts, report, text, nodeOk ? 0 : 1);
}

async function run(argv) {
  const { values: opts, positionals: [cmd, sub, file] } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      for: { type: 'string' },
      task: { type: 'string' },
      evidence: { type: 'string', multiple: true },
      domain: { type: 'string' },
      out: { type: 'string' },
      run: { type: 'string' },
      viewport: { type: 'string', multiple: true },
      full: { type: 'boolean' },
      dark: { type: 'boolean' },
      'reduced-motion': { type: 'boolean' },
      wait: { type: 'string' },
      label: { type: 'string' },
      motion: { type: 'boolean' },
      interact: { type: 'string' },
      flow: { type: 'string' },
      live: { type: 'boolean' },
      type: { type: 'string' },
      storyboard: { type: 'string' },
      seconds: { type: 'string' },
      'no-sound': { type: 'boolean' },
    },
  });
  if (!cmd || cmd === 'help' || opts.help) return print({}, null, HELP);
  if (cmd === 'version') return print(opts, { version: version() }, `nomi ${version()}`);
  if (cmd === 'doctor') return doctor(opts);
  stage(cmd, sub);
  if (cmd === 'observe' || cmd === 'diff') {
    const result = cmd === 'observe' ? await observe(sub, opts) : await diffRuns(sub, file, opts);
    stage(cmd, sub); // the first run creates .nomi/
    return print(opts, result.report, summary(result.report).trim(), result.report.findings.length ? 1 : 0);
  }
  if (cmd === 'probe' && sub === 'print') {
    const probes = { web: 'web-census.js', motion: 'motion.js' };
    if (!Object.hasOwn(probes, file ?? '')) fail('unknown probe; use: nomi probe print web, or: nomi probe print motion');
    process.stdout.write(read('scripts', 'probes', probes[file]));
    return 0;
  }
  if (cmd === 'plan' && sub === 'init') return planInit(opts);
  if (cmd === 'plan' && sub === 'check') return planCheck(opts, file);
  if (cmd === 'review') return runReview(opts, sub);
  if (cmd === 'brandvid') return brandvid(opts, sub, file);
  if (cmd === 'readme') return readme(opts, sub, file);
  if (cmd === 'dna' && sub === 'init') return dnaInit();
  if (cmd === 'dna' && sub === 'check') return dnaCheck(opts, file);
  if (cmd === 'dna' && sub === 'show') return dnaShow(opts, file);
  if (cmd === 'critique' && sub === 'pack') return critiquePack(opts);
  return fail(`unknown command "${[cmd, sub].filter(Boolean).join(' ')}"; run: nomi help`);
}

// No command may hang: every wait inside is bounded, and this is the bound on whatever was not foreseen (a browser that
// neither answers nor dies inside a host sandbox). A finished command exits at once instead of waiting on leftover handles.
const LIMIT = 240000;
setTimeout(() => {
  console.error(`nomi: the command did not finish in ${LIMIT / 1000} s and was stopped. Runs already written are in .nomi/runs/; what was not captured is not verified.`);
  process.exit(2);
}, LIMIT).unref();
try {
  process.exitCode = await run(process.argv.slice(2));
} catch (err) {
  console.error(`nomi: ${err.message.replace(/\r?\n/g, ' ')}`);
  process.exitCode = 2;
}
process.stdout.write('', () => process.stderr.write('', () => process.exit()));
