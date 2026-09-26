// Nomi CLI. Run as: node <skill-dir>/scripts/nomi.mjs <command>   (Node 22+, no dependencies)
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { splitFrontmatter } from './lib/frontmatter.mjs';
import { findDna, checkDna, sliceDna, DOMAINS } from './lib/dna.mjs';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HELP = `usage: node <skill-dir>/scripts/nomi.mjs <command> [--json]

  dna init                        create .nomi/dna.md from the template
  dna check [file]                lint the nearest .nomi/dna.md (exit 1 on findings)
  dna show [--for <domain>]       print DNA sections; domains: ${Object.keys(DOMAINS).join(', ')}
  critique pack --task "<text>" [--evidence <file>]... [--domain <domain>] [--out <file>]
                                  write a self-contained brief for an independent critic
  doctor                          check Node, the skill folder and project DNA
  version

exit codes: 0 ok, 1 findings, 2 error`;

class UsageError extends Error {}
const fail = (message) => { throw new UsageError(message); };
const rel = (p) => path.relative(process.cwd(), p) || '.';
const read = (...parts) => fs.readFileSync(path.join(SKILL_DIR, ...parts), 'utf8');

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
  console.log(`created ${rel(target)}: fill Intent, Character, Signature and Never, then run: nomi dna check`);
  return 0;
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
  const missing = evidence.filter((e) => !fs.existsSync(path.resolve(e)));
  if (missing.length) fail(`evidence not found: ${missing.join(', ')}`);

  const dnaPath = findDna(process.cwd());
  const dna = dnaPath ? sliceDna(fs.readFileSync(dnaPath, 'utf8'), opts.domain) : 'No project DNA exists. Judge against the task and the existing product.';
  const module = opts.domain && path.join(SKILL_DIR, 'references', `${opts.domain}.md`);
  const lens = module && fs.existsSync(module) ? `Also apply the "Critique lenses" section of ${module}.` : 'No domain module applies; use the rules below.';
  const brief = read('assets', 'critic-brief.md')
    .replace('{{task}}', () => opts.task)
    .replace('{{dna}}', () => dna.trim())
    .replace('{{evidence}}', () => (evidence.length ? evidence.map((e) => `- ${e}`).join('\n') : '- None supplied: report what could not be verified.'))
    .replace('{{lens}}', () => lens);

  if (!opts.out) {
    process.stdout.write(brief);
    return 0;
  }
  fs.writeFileSync(opts.out, brief);
  console.log(`wrote ${opts.out}`);
  return 0;
}

function doctor(opts) {
  const nodeOk = Number(process.versions.node.split('.')[0]) >= 22;
  const dna = findDna(process.cwd());
  let writable = true;
  try { fs.accessSync(process.cwd(), fs.constants.W_OK); } catch { writable = false; }
  const report = { node: { version: process.versions.node, ok: nodeOk }, skillDir: SKILL_DIR, dna, writable };
  const text = [
    `node   ${process.versions.node} ${nodeOk ? 'ok' : 'too old: need 22 or newer'}`,
    `skill  ${SKILL_DIR}`,
    `dna    ${dna ? rel(dna) : 'none yet (Create-tier work starts with: nomi dna init)'}`,
    `write  ${writable ? 'ok' : `cannot write to ${process.cwd()}`}`,
  ].join('\n');
  return print(opts, report, text, nodeOk ? 0 : 1);
}

function run(argv) {
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
    },
  });
  if (!cmd || cmd === 'help' || opts.help) return print({}, null, HELP);
  if (cmd === 'version') return print(opts, { version: version() }, `nomi ${version()}`);
  if (cmd === 'doctor') return doctor(opts);
  if (cmd === 'dna' && sub === 'init') return dnaInit();
  if (cmd === 'dna' && sub === 'check') return dnaCheck(opts, file);
  if (cmd === 'dna' && sub === 'show') return dnaShow(opts, file);
  if (cmd === 'critique' && sub === 'pack') return critiquePack(opts);
  return fail(`unknown command "${[cmd, sub].filter(Boolean).join(' ')}"; run: nomi help`);
}

try {
  process.exitCode = run(process.argv.slice(2));
} catch (err) {
  if (!(err instanceof UsageError) && err.code !== 'ERR_PARSE_ARGS_UNKNOWN_OPTION' && err.code !== 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') throw err;
  console.error(`nomi: ${err.message}`);
  process.exitCode = 2;
}
