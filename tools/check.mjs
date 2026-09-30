// Static gate for the canonical skill: Agent Skills spec rules, context budgets,
// skill-relative links and vendor neutrality (docs/ARCHITECTURE.md §4 and §12,
// docs/INTEGRATIONS.md §5). Usage: node tools/check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitFrontmatter } from '../skills/nomi/scripts/lib/frontmatter.mjs';

const ALLOWED_KEYS = ['name', 'description', 'license', 'compatibility', 'metadata'];
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DESCRIPTION_BUDGET = 400;
const TEXT_FILES = /\.(md|mjs|js|json|txt|ya?ml)$/;
const HOST_SYNTAX = /\$\{CLAUDE_|\$ARGUMENTS|CLAUDE_PLUGIN_/g;
const HOST_WORDS = /Claude Code|Codex|Cursor|OpenCode|Gemini|Antigravity|OpenClaw|Hermes|\b(?:Bash|Read|Write|Edit|Task|Skill|Agent) tool\b|activate_skill|skill_view|skills_list|TodoWrite|AskUserQuestion/g;
const SKILL_PATH = /(?:\]\(|`|<skill-dir>\/)((?:references|assets|scripts)\/[^)`\s#]+)/g;

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
    if (/^references\/(web|motion|3d|game|world)\.md$/.test(rel)) {
      const headings = [...content.matchAll(/^## (.+)$/gm)].map(m => m[1].trim());
      if (headings.join('|') !== 'Decide|Traps|Instrument|Observe|Critique lenses|Moves') add(file, 1, 'module.sections', 'domain module needs exactly Decide, Traps, Instrument, Observe, Critique lenses, Moves in that order');
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
      }
    });
  }
  return findings;
}

export function checkRepo(root) {
  const skillDir = path.join(root, 'skills', 'nomi');
  const findings = checkSkill(skillDir);
  const manifest = path.join(root, '.claude-plugin', 'plugin.json');
  if (fs.existsSync(manifest)) {
    const plugin = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    let skill = null;
    try { skill = splitFrontmatter(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')).data; } catch { /* reported by checkSkill */ }
    const version = skill && skill.metadata && skill.metadata.version;
    if (plugin.name !== 'nomi' || plugin.version !== version) {
      findings.push({ file: manifest, line: 1, code: 'manifest.mismatch', message: `plugin.json name/version (${plugin.name} ${plugin.version}) must be "nomi" and the skill's metadata.version (${version})` });
    }
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
