import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSkill, checkRepo } from '../tools/check.mjs';

const roots = [];
after(() => roots.forEach((r) => fs.rmSync(r, { recursive: true, force: true })));

const GOOD_FRONTMATTER = [
  '---',
  'name: nomi',
  'description: Use when designing or reviewing things people see.',
  'metadata:',
  '  version: "0.1.0"',
  '---',
].join('\n');

function makeSkill(files, dirName = 'nomi') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-check-'));
  roots.push(root);
  const dir = path.join(root, dirName);
  const all = { 'SKILL.md': `${GOOD_FRONTMATTER}\n# Nomi\nSee [direction](references/direction.md).\n`, 'references/direction.md': '# Direction\n', ...files };
  for (const [rel, content] of Object.entries(all)) {
    if (content === null) continue;
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

const codes = (findings) => findings.map((f) => f.code).sort();

test('a clean skill has no findings', () => {
  assert.deepEqual(checkSkill(makeSkill({})), []);
});

test('name must match the folder and the spec pattern', () => {
  assert.deepEqual(codes(checkSkill(makeSkill({}, 'other'))), ['spec.name']);
  const bad = GOOD_FRONTMATTER.replace('name: nomi', 'name: Nomi--x');
  assert.ok(codes(checkSkill(makeSkill({ 'SKILL.md': `${bad}\n# x\n` }, 'Nomi--x'))).includes('spec.name'));
});

test('only spec-pure frontmatter keys are allowed', () => {
  const fm = GOOD_FRONTMATTER.replace('---\nname', '---\ncontext: fork\nname');
  assert.deepEqual(codes(checkSkill(makeSkill({ 'SKILL.md': `${fm}\n# x\n` }))), ['spec.keys']);
});

test('description is limited by the spec and by the project budget', () => {
  const long = (n) => GOOD_FRONTMATTER.replace(/description: .*/, `description: ${'a'.repeat(n)}`);
  assert.deepEqual(codes(checkSkill(makeSkill({ 'SKILL.md': `${long(401)}\n# x\n` }))), ['budget.description']);
  assert.deepEqual(codes(checkSkill(makeSkill({ 'SKILL.md': `${long(1025)}\n# x\n` }))), ['budget.description', 'spec.description']);
});

test('metadata values must be strings', () => {
  const fm = GOOD_FRONTMATTER.replace('version: "0.1.0"', 'version: 1');
  assert.deepEqual(codes(checkSkill(makeSkill({ 'SKILL.md': `${fm}\n# x\n` }))), ['spec.metadata']);
});

test('unparseable frontmatter is reported instead of crashing', () => {
  const fm = GOOD_FRONTMATTER.replace(/description: .*/, 'description: Use when: anything');
  assert.deepEqual(codes(checkSkill(makeSkill({ 'SKILL.md': `${fm}\n# x\n` }))), ['spec.frontmatter']);
});

test('line budgets apply to SKILL.md, references and assets', () => {
  const lines = (n) => Array.from({ length: n }, (_, i) => `line ${i}`).join('\n');
  const found = codes(checkSkill(makeSkill({
    'SKILL.md': `${GOOD_FRONTMATTER}\n${lines(150)}\nSee [d](references/direction.md).\n`,
    'references/direction.md': lines(201),
    'assets/dna.md': lines(121),
  })));
  assert.deepEqual(found, ['budget.lines', 'budget.lines', 'budget.lines']);
});

test('skill-relative paths must exist', () => {
  const findings = checkSkill(makeSkill({
    'SKILL.md': `${GOOD_FRONTMATTER}\n# x\nRead \`references/missing.md\` and [d](references/direction.md); run \`scripts/nomi.mjs\`.\nProject files like \`.nomi/dna.md\` are not checked.\nRun \`node <skill-dir>/scripts/other.mjs dna init\`.\n`,
  }));
  assert.deepEqual(findings.map((f) => `${f.code} ${f.message}`), [
    'links.missing references/missing.md does not exist',
    'links.missing scripts/nomi.mjs does not exist',
    'links.missing scripts/other.mjs does not exist',
  ]);
});

test('host-specific syntax and host names are rejected inside the skill', () => {
  const findings = checkSkill(makeSkill({
    'SKILL.md': `${GOOD_FRONTMATTER}\n# x\nRun \${CLAUDE_SKILL_DIR}/x\n[d](references/direction.md)\n`,
    'references/direction.md': '# D\nIn Claude Code, use the Task tool.\n',
    'scripts/x.mjs': 'const dir = process.env.CLAUDE_PLUGIN_ROOT;\n',
  }));
  assert.deepEqual(findings.map((f) => `${path.basename(f.file)}:${f.line} ${f.code}`).sort(), [
    'SKILL.md:8 neutral.token',
    'direction.md:2 neutral.token',
    'direction.md:2 neutral.token',
    'x.mjs:1 neutral.token',
  ]);
});

test('repo check flags a plugin manifest that disagrees with the skill', () => {
  const skill = makeSkill({});
  const root = path.dirname(skill);
  fs.mkdirSync(path.join(root, 'skills'));
  fs.renameSync(skill, path.join(root, 'skills', 'nomi'));
  fs.mkdirSync(path.join(root, '.claude-plugin'));
  fs.writeFileSync(path.join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'nomi', version: '0.2.0' }));
  assert.deepEqual(codes(checkRepo(root)), ['manifest.mismatch']);
});

const SECTIONS = ['Decide','Traps','Instrument','Observe','Critique lenses','Moves'].map(s=>`## ${s}\nDo it.\n`).join('');
const webSkill = (body) => ({ 'SKILL.md': `${GOOD_FRONTMATTER.replace('name: nomi','name: nomi-web')}\n# Web\n${body}`, 'references/direction.md': null });

test('a domain skill must carry the six-section contract, so a stub cannot pass as functional', () => {
  const stub = makeSkill(webSkill('Coming soon.\n'), 'nomi-web');
  assert.ok(codes(checkSkill(stub)).includes('module.sections'));
  fs.writeFileSync(path.join(stub, 'SKILL.md'), `${GOOD_FRONTMATTER.replace('name: nomi','name: nomi-web')}\n# Web\n${SECTIONS}`);
  assert.ok(!codes(checkSkill(stub)).includes('module.sections'));
});

test('sibling paths to the shared core must resolve', () => {
  const web = makeSkill(webSkill(`Read \`<core>/SKILL.md\`, then run \`node <core>/scripts/gone.mjs\`; see \`<skill-dir>/../nomi-motion/SKILL.md\`.\n${SECTIONS}`), 'nomi-web');
  fs.mkdirSync(path.join(path.dirname(web), 'nomi'));
  fs.writeFileSync(path.join(path.dirname(web), 'nomi', 'SKILL.md'), 'core');
  assert.deepEqual(checkSkill(web).map((f) => f.message), ['<core>/scripts/gone.mjs does not exist', '<skill-dir>/../nomi-motion/SKILL.md does not exist']);
});

test('repo check accepts only the core and known domain skills, all at the manifest version', () => {
  const core = makeSkill({});
  const root = path.dirname(core);
  fs.mkdirSync(path.join(root, 'skills'));
  fs.renameSync(core, path.join(root, 'skills', 'nomi'));
  const web = makeSkill(webSkill(SECTIONS), 'nomi-web');
  fs.renameSync(web, path.join(root, 'skills', 'nomi-web'));
  fs.mkdirSync(path.join(root, 'skills', 'nomi-extras'));
  fs.mkdirSync(path.join(root, '.claude-plugin'));
  fs.writeFileSync(path.join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'nomi', version: '0.1.0' }));
  assert.deepEqual(codes(checkRepo(root)), ['repo.skills']);
  fs.writeFileSync(path.join(root, 'skills', 'nomi-web', 'SKILL.md'), `${GOOD_FRONTMATTER.replace('name: nomi','name: nomi-web').replace('0.1.0','0.2.0')}\n# Web\n${SECTIONS}`);
  assert.deepEqual(codes(checkRepo(root)), ['manifest.mismatch', 'repo.skills']);
});
