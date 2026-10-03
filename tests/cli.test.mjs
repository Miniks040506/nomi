import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../skills/nomi/scripts/nomi.mjs', import.meta.url));
const FIXTURE_DNA = fileURLToPath(new URL('../evals/fixtures/tidepool/.nomi/dna.md', import.meta.url));
const roots = [];
after(() => roots.forEach((r) => fs.rmSync(r, { recursive: true, force: true })));

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-cli-'));
  roots.push(dir);
  return dir;
}

function nomi(cwd, ...args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function withDna(content) {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, '.nomi'));
  fs.writeFileSync(path.join(dir, '.nomi', 'dna.md'), content);
  return dir;
}

const VALID = fs.readFileSync(FIXTURE_DNA, 'utf8');

test('dna init creates DNA from the template and ignores runs/', () => {
  const dir = tmp();
  const r = nomi(dir, 'dna', 'init');
  assert.equal(r.code, 0, r.err);
  const dna = fs.readFileSync(path.join(dir, '.nomi', 'dna.md'), 'utf8');
  assert.match(dna, /^---\nnomi: 1\n/);
  for (const s of ['Intent', 'Character', 'Signature', 'Never', 'Decisions']) assert.match(dna, new RegExp(`^## ${s}$`, 'm'));
  assert.match(dna, new RegExp(`# ${path.basename(dir)} `));
  assert.equal(fs.readFileSync(path.join(dir, '.nomi', '.gitignore'), 'utf8'), 'runs/\n');
  assert.match(r.out, /dna check/);
});

test('dna init points existing AGENTS.md and CLAUDE.md at the DNA, keeping their content', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Rules\nUse tabs.\n');
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'Be brief.');
  assert.equal(nomi(dir, 'dna', 'init').code, 0);
  for (const f of ['AGENTS.md', 'CLAUDE.md']) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.match(text, /^(# Rules\nUse tabs\.|Be brief\.)/);
    assert.equal(text.match(/\.nomi\/dna\.md/g).length, 1);
  }
});

test('dna init creates AGENTS.md when the project has no agent instructions, and never duplicates the pointer', () => {
  const dir = tmp();
  nomi(dir, 'dna', 'init');
  assert.match(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), /\.nomi\/dna\.md/);
  assert.equal(fs.existsSync(path.join(dir, 'CLAUDE.md')), false);
  fs.rmSync(path.join(dir, '.nomi'), { recursive: true });
  nomi(dir, 'dna', 'init');
  assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8').match(/\.nomi\/dna\.md/g).length, 1);
});

test('dna init refuses to overwrite existing DNA', () => {
  const dir = withDna(VALID);
  const r = nomi(dir, 'dna', 'init');
  assert.equal(r.code, 2);
  assert.match(r.err, /already exists/);
  assert.equal(fs.readFileSync(path.join(dir, '.nomi', 'dna.md'), 'utf8'), VALID);
});

test('a freshly initialised DNA fails check until the required sections are filled', () => {
  const dir = tmp();
  nomi(dir, 'dna', 'init');
  const r = nomi(dir, 'dna', 'check');
  assert.equal(r.code, 1);
  for (const s of ['Intent', 'Character', 'Signature', 'Never']) assert.match(r.out, new RegExp(`dna\\.section-empty.*${s}`));
});

test('a complete DNA passes check, found by walking up from a subfolder', () => {
  const dir = withDna(VALID);
  fs.mkdirSync(path.join(dir, 'src', 'pages'), { recursive: true });
  const r = nomi(path.join(dir, 'src', 'pages'), 'dna', 'check');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /ok/);
});

test('check reports a missing version and missing sections', () => {
  const r = nomi(withDna('# DNA\n\n## Intent\nPeople booking walks.\n'), 'dna', 'check', '--json');
  assert.equal(r.code, 1);
  const codes = JSON.parse(r.out).findings.map((f) => `${f.code}:${f.section || ''}`);
  assert.deepEqual(codes.sort(), ['dna.section-missing:Character', 'dna.section-missing:Never', 'dna.section-missing:Signature', 'dna.version:']);
});

test('check flags vague words without a concrete translation, with line numbers', () => {
  const dna = VALID.replace('## Character\n', [
    '## Character',
    '- Clean and modern.',
    '- Minimal: no borders, no shadows, one typeface.',
    '- Sleek: 4px grid.',
    '- Bold: big type.',
    '',
  ].join('\n'));
  const r = nomi(withDna(dna), 'dna', 'check', '--json');
  const vague = JSON.parse(r.out).findings.filter((f) => f.code === 'dna.vague');
  assert.deepEqual(vague.map((f) => [f.line, f.word]), [[11, 'clean'], [11, 'modern'], [14, 'bold']]);
});

test('vague words are allowed in Never and Decisions', () => {
  const dna = VALID.replace('## Never\n', '## Never\n- No generic "modern, clean" SaaS look.\n').replace('## Decisions\n', '## Decisions\n- 2026-09-21 · web · Rejected a sleek dark theme.\n');
  assert.equal(nomi(withDna(dna), 'dna', 'check').code, 0);
});

test('check enforces the decisions cap and the length budget', () => {
  const decisions = Array.from({ length: 21 }, (_, i) => `- 2026-09-${String(i + 1).padStart(2, '0')} · web · Decision ${i}.`).join('\n');
  const long = `${VALID.replace(/## Decisions\n[\s\S]*$/, `## Decisions\n${decisions}\n`)}${'\n'.repeat(130)}`;
  const codes = JSON.parse(nomi(withDna(long), 'dna', 'check', '--json').out).findings.map((f) => f.code);
  assert.deepEqual(codes.sort(), ['dna.decisions', 'dna.length']);
});

test('check without any DNA exits 2 and says how to create one', () => {
  const r = nomi(tmp(), 'dna', 'check');
  assert.equal(r.code, 2);
  assert.match(r.err, /dna init/);
});

test('malformed DNA frontmatter gives a one-line error, not a stack trace', () => {
  const dir = withDna(VALID.replace('domains: [web]', 'domains: nope: bad'));
  for (const args of [['dna', 'show'], ['critique', 'pack', '--task', 'x']]) {
    const r = nomi(dir, ...args);
    assert.equal(r.code, 2);
    assert.match(r.err, /^nomi: .*frontmatter line 3/);
    assert.doesNotMatch(r.err, /\n\s+at /);
  }
});

test('dna show --for slices the core sections plus the domain section', () => {
  const dna = VALID.replace('## Decisions', '## Motion\n- Snaps in 160ms.\n\n## Space\n- Low camera.\n\n## Decisions');
  const r = nomi(withDna(dna), 'dna', 'show', '--for', 'motion');
  assert.equal(r.code, 0, r.err);
  for (const s of ['Intent', 'Character', 'Signature', 'Never', 'Motion']) assert.match(r.out, new RegExp(`## ${s}`));
  assert.doesNotMatch(r.out, /## Space|## Decisions|nomi: 1/);
  assert.equal(nomi(withDna(dna), 'dna', 'show', '--for', 'sound').code, 2);
});

test('critique pack writes a self-contained brief from task, DNA and evidence', () => {
  const dir = withDna(VALID);
  fs.writeFileSync(path.join(dir, 'home.png'), 'png');
  const r = nomi(dir, 'critique', 'pack', '--task', 'Review the booking form', '--evidence', 'home.png', '--out', 'brief.md');
  assert.equal(r.code, 0, r.err);
  const brief = fs.readFileSync(path.join(dir, 'brief.md'), 'utf8');
  assert.match(brief, /Review the booking form/);
  assert.match(brief, /No free date pickers/);
  assert.match(brief, /home\.png/);
  assert.match(brief, /Verdict: SHIP \| REFINE \| RETHINK/);
  assert.doesNotMatch(brief, /\{\{/);
});

test('critique pack creates the folder for --out', () => {
  const dir = withDna(VALID);
  const r = nomi(dir, 'critique', 'pack', '--task', 'Review the page', '--out', path.join('.nomi', 'runs', 'brief.md'));
  assert.equal(r.code, 0, r.err);
  assert.match(fs.readFileSync(path.join(dir, '.nomi', 'runs', 'brief.md'), 'utf8'), /Review the page/);
});

test('critique pack refuses missing evidence and works without DNA', () => {
  const dir = tmp();
  assert.equal(nomi(dir, 'critique', 'pack', '--task', 'x', '--evidence', 'nope.png').code, 2);
  assert.equal(nomi(dir, 'critique', 'pack').code, 2);
  const r = nomi(dir, 'critique', 'pack', '--task', 'Review the page');
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /No project DNA/);
});

test('doctor reports the runtime, the skill folder and DNA status', () => {
  const r = nomi(withDna(VALID), 'doctor', '--json');
  assert.equal(r.code, 0, r.err);
  const report = JSON.parse(r.out);
  assert.equal(report.node.ok, true);
  assert.equal(fs.existsSync(path.join(report.skillDir, 'SKILL.md')), true);
  assert.deepEqual(report.domains, ['web'], 'domain skills are found as siblings of the core');
  assert.match(report.dna, /dna\.md$/);
});

test('version comes from the skill metadata; unknown commands exit 2', () => {
  const dir = tmp();
  assert.match(nomi(dir, 'version').out, /^nomi \d+\.\d+\.\d+/);
  assert.equal(nomi(dir, 'bogus').code, 2);
});

test('the opt-in browser sandbox switch refuses non-local URLs before any browser starts', () => {
  const run = (target) => spawnSync(process.execPath, [CLI, 'observe', target], { cwd: tmp(), encoding: 'utf8', env: { ...process.env, NOMI_BROWSER_NO_SANDBOX: '1', NOMI_BROWSER: path.join(os.tmpdir(), 'no-such-browser') } });
  const remote = run('https://example.com/');
  assert.equal(remote.status, 2);
  assert.match(remote.stderr, /only captures local pages/);
  assert.match(run('https://localhost.example.com/').stderr, /only captures local pages/);
  // A loopback URL passes this gate and fails later, on the missing browser.
  assert.match(run('http://localhost:5173/').stderr, /NOMI_BROWSER is not a file/);
});
