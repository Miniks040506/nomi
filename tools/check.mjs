// Static gate for the Nomi skills (core plus domain skills): Agent Skills spec rules, context budgets,
// skill-relative links and vendor neutrality (docs/ARCHITECTURE.md §4 and §12,
// docs/INTEGRATIONS.md §5). Usage: node tools/check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitFrontmatter } from '../skills/nomi/scripts/lib/frontmatter.mjs';
import { DOMAINS } from '../skills/nomi/scripts/lib/dna.mjs';

const ALLOWED_KEYS = ['name', 'description', 'license', 'compatibility', 'metadata'];
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DESCRIPTION_BUDGET = 400;
const TEXT_FILES = /\.(md|mjs|js|json|txt|ya?ml)$/;
const HOST_SYNTAX = /\$\{CLAUDE_|\$ARGUMENTS|CLAUDE_PLUGIN_/g;
const HOST_WORDS = /Claude Code|Codex|Cursor|OpenCode|Gemini|Antigravity|OpenClaw|Hermes|\b(?:Bash|Read|Write|Edit|Task|Skill|Agent) tool\b|activate_skill|skill_view|skills_list|TodoWrite|AskUserQuestion/g;
const SKILL_PATH = /(?:\]\(|`|<skill-dir>\/)((?:references|assets|scripts)\/[^)`\s#]+)/g;
// Domain skills reach the shared core as a sibling folder: <core> = <skill-dir>/../nomi.
const SIBLING_PATH = /<skill-dir>\/(\.\.\/[^)`\s#]+)|<core>\/([^)`\s#]+)/g;
const DOMAIN_SKILL = new RegExp(`^nomi-(${Object.keys(DOMAINS).join('|')})$`);
const MODULE_SECTIONS = 'Decide|Traps|Instrument|Observe|Critique lenses|Moves';

export function checkSkill(dir) {
  const findings = [];
  const add = (file, line, code, message) => findings.push({ file, line, code, message });
  const skillFile = path.join(dir, 'SKILL.md');

  let data = null;
  try {
    data = splitFrontmatter(fs.readFileSync(skillFile, 'utf8')).data;
    if (!data) add(skillFile, 1, 'spec.frontmatter', 'SKILL.md has no frontmatter');
  } catch (err) {
    add(skillFile, 1, 'spec.frontmatter', err.message);
  }
  if (data) {
    for (const key of Object.keys(data)) {
      if (!ALLOWED_KEYS.includes(key)) add(skillFile, 1, 'spec.keys', `unsupported frontmatter key "${key}"`);
    }
    const folder = path.basename(dir);
    if (typeof data.name !== 'string' || data.name.length > 64 || !NAME.test(data.name) || data.name !== folder) {
      add(skillFile, 1, 'spec.name', `name must match ${NAME} and equal the folder name "${folder}"`);
    }
    const d = data.description;
    if (typeof d !== 'string' || d.length === 0 || d.length > 1024) add(skillFile, 1, 'spec.description', 'description must be 1-1024 characters');
    if (typeof d === 'string' && d.length > DESCRIPTION_BUDGET) add(skillFile, 1, 'budget.description', `description is ${d.length} characters (budget ${DESCRIPTION_BUDGET})`);
    if (data.compatibility !== undefined && (typeof data.compatibility !== 'string' || data.compatibility.length > 500)) {
      add(skillFile, 1, 'spec.compatibility', 'compatibility must be a string of at most 500 characters');
    }
    const meta = data.metadata;
    if (meta !== undefined && (meta === null || typeof meta !== 'object' || Array.isArray(meta) || Object.values(meta).some((v) => typeof v !== 'string'))) {
      add(skillFile, 1, 'spec.metadata', 'metadata must map strings to strings');
    }
  }

  for (const file of walk(dir)) {
    const rel = path.relative(dir, file).split(path.sep).join('/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);
    const count = lines.length - (content.endsWith('\n') ? 1 : 0);
    const budget = rel === 'SKILL.md' ? 150 : /^references\/.*\.md$/.test(rel) ? 200 : /^assets\/.*\.md$/.test(rel) ? 120 : null;
    if (budget && count > budget) add(file, budget + 1, 'budget.lines', `${count} lines (budget ${budget})`);
    // A domain skill is its module: an entry without the full contract would expose an unfinished domain.
    if (rel === 'SKILL.md' && DOMAIN_SKILL.test(path.basename(dir))) {
      const headings = [...content.matchAll(/^## (.+)$/gm)].map(m => m[1].trim());
      if (headings.join('|') !== MODULE_SECTIONS) add(file, 1, 'module.sections', 'domain skill needs exactly Decide, Traps, Instrument, Observe, Critique lenses, Moves in that order');
    }

    const isDoc = rel.endsWith('.md');
    const checksLinks = rel === 'SKILL.md' || /^references\/.*\.md$/.test(rel);
    lines.forEach((line, i) => {
      for (const m of line.matchAll(HOST_SYNTAX)) add(file, i + 1, 'neutral.token', `host-specific syntax "${m[0]}"`);
      if (isDoc) for (const m of line.matchAll(HOST_WORDS)) add(file, i + 1, 'neutral.token', `host-specific name "${m[0]}"`);
      if (checksLinks) {
        for (const m of line.matchAll(SKILL_PATH)) {
          if (!fs.existsSync(path.join(dir, m[1]))) add(file, i + 1, 'links.missing', `${m[1]} does not exist`);
        }
        for (const m of line.matchAll(SIBLING_PATH)) {
          const target = m[1] ? path.join(dir, m[1]) : path.join(dir, '..', 'nomi', m[2]);
          if (!fs.existsSync(target)) add(file, i + 1, 'links.missing', `${m[0]} does not exist`);
        }
      }
    });
  }
  return findings;
}

export function checkRepo(root) {
  const skillsDir = path.join(root, 'skills');
  const findings = [];
  const folders = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const skills = folders.filter((n) => n === 'nomi' || DOMAIN_SKILL.test(n));
  if (!folders.includes('nomi')) findings.push({ file: skillsDir, line: 1, code: 'repo.skills', message: 'the shared core skills/nomi is missing' });
  for (const name of folders.filter((n) => !skills.includes(n))) {
    findings.push({ file: path.join(skillsDir, name), line: 1, code: 'repo.skills', message: `"${name}" is neither the core "nomi" nor nomi-<${Object.keys(DOMAINS).join('|')}>` });
  }
  for (const name of skills) findings.push(...checkSkill(path.join(skillsDir, name)));
  const manifest = path.join(root, '.claude-plugin', 'plugin.json');
  if (fs.existsSync(manifest)) {
    const plugin = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    for (const name of skills) {
      let skill = null;
      try { skill = splitFrontmatter(fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8')).data; } catch { /* reported by checkSkill */ }
      const version = skill && skill.metadata && skill.metadata.version;
      if (plugin.name !== 'nomi' || plugin.version !== version) {
        findings.push({ file: manifest, line: 1, code: 'manifest.mismatch', message: `plugin.json name/version (${plugin.name} ${plugin.version}) must be "nomi" and match ${name}'s metadata.version (${version})` });
      }
    }
    findings.push(...checkPackaging(root, plugin));
  }
  return findings;
}

// The subset of JSON Schema the vendored manifest schemas use.
export function validate(value, schema, at = '$') {
  const errors = [];
  const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  if ('const' in schema && value !== schema.const) errors.push(`${at} must be ${JSON.stringify(schema.const)}`);
  if (schema.type && type !== schema.type) return [...errors, `${at} must be ${schema.type}`];
  if (type === 'string') {
    if (value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity)) errors.push(`${at} has an invalid length`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at} does not match ${schema.pattern}`);
  }
  if (type === 'array' && schema.items) value.forEach((v, i) => errors.push(...validate(v, schema.items, `${at}[${i}]`)));
  if (type === 'object') {
    for (const key of schema.required || []) if (!(key in value)) errors.push(`${at}.${key} is required`);
    for (const [key, v] of Object.entries(value)) {
      const sub = schema.properties?.[key] ?? schema.additionalProperties;
      if (sub === false) errors.push(`${at}.${key} is not allowed`);
      else if (sub && typeof sub === 'object') errors.push(...validate(v, sub, `${at}.${key}`));
    }
  }
  return errors;
}

// Every native package describes the same plugin, and INTEGRATIONS.md states exactly what adapters/hosts.json records.
function checkPackaging(root, plugin) {
  const findings = [];
  const add = (file, code, message) => findings.push({ file: path.join(root, file), line: 1, code, message });
  const json = (file) => { try { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); } catch { return null; } };
  const table = json('adapters/hosts.json');
  if (!table) return findings;
  for (const file of table.manifests) {
    const data = json(file);
    if (!data) { add(file, 'manifest.missing', 'listed in adapters/hosts.json but missing or not JSON'); continue; }
    if (data.name !== 'nomi') add(file, 'manifest.mismatch', `name is "${data.name}", not "nomi"`);
    if (data.plugins) {
      if (!data.plugins.some((p) => p.name === 'nomi')) add(file, 'manifest.mismatch', 'marketplace does not list the plugin "nomi"');
    } else if (data.version !== plugin.version || data.description !== plugin.description) {
      add(file, 'manifest.mismatch', 'version and description must equal .claude-plugin/plugin.json');
    }
  }
  const agentPlugin = json('plugin.json');
  if (agentPlugin) for (const error of validate(agentPlugin, json('tools/schemas/agent-plugin.schema.json'))) add('plugin.json', 'manifest.schema', error);
  const doc = fs.existsSync(path.join(root, 'docs', 'INTEGRATIONS.md')) ? fs.readFileSync(path.join(root, 'docs', 'INTEGRATIONS.md'), 'utf8') : '';
  for (const host of table.hosts) {
    const row = `| ${host.name} | ${host.status} | ${host.version || '—'} | ${host.verified || '—'} |`;
    if (!doc.includes(row)) add('docs/INTEGRATIONS.md', 'hosts.sync', `missing the row "${row}" recorded in adapters/hosts.json`);
  }
  return findings;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return TEXT_FILES.test(entry.name) ? [full] : [];
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const findings = checkRepo(root);
  for (const f of findings) {
    console.log(`${path.relative(root, f.file).split(path.sep).join('/')}:${f.line}  ${f.code}  ${f.message}`);
  }
  console.log(findings.length ? `check: ${findings.length} finding(s)` : 'check: ok');
  process.exitCode = findings.length ? 1 : 0;
}
