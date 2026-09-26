// Project DNA (.nomi/dna.md): find it, check it, slice it. Schema: docs/ARCHITECTURE.md §6.
import fs from 'node:fs';
import path from 'node:path';
import { splitFrontmatter } from './frontmatter.mjs';

export const REQUIRED = ['Intent', 'Character', 'Signature', 'Never'];
export const DOMAINS = { web: null, motion: 'Motion', '3d': 'Space', game: 'Feel', world: 'World' };
const DIRECTION_SECTIONS = ['Intent', 'Character', 'Signature', 'Motion', 'Space', 'Feel', 'World'];
const MAX_LINES = 150;
const MAX_DECISIONS = 20;

// ponytail: nearest ancestor wins; no merging of nested DNA files.
export function findDna(from) {
  for (let dir = path.resolve(from); ; dir = path.dirname(dir)) {
    const file = path.join(dir, '.nomi', 'dna.md');
    if (fs.existsSync(file)) return file;
    if (path.dirname(dir) === dir) return null;
  }
}

export function parseDna(text) {
  const { data, body, bodyLine } = splitFrontmatter(text);
  const lines = body.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, '')).split('\n');
  const sections = [];
  lines.forEach((line, i) => {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) sections.push({ title: heading[1], line: bodyLine + i, lines: [] });
    else if (sections.length) sections.at(-1).lines.push({ text: line, line: bodyLine + i });
  });
  return { data, sections };
}

export function checkDna(text, vagueWords) {
  let parsed;
  try {
    parsed = parseDna(text);
  } catch (err) {
    return [{ line: 1, code: 'dna.frontmatter', message: err.message }];
  }
  const { data, sections } = parsed;
  const findings = [];
  if (!data || data.nomi !== 1) findings.push({ line: 1, code: 'dna.version', message: 'frontmatter must declare "nomi: 1"' });

  for (const name of REQUIRED) {
    const s = sections.find((x) => x.title === name);
    if (!s) findings.push({ line: null, code: 'dna.section-missing', section: name, message: `missing "## ${name}"` });
    else if (!s.lines.some((l) => l.text.trim())) findings.push({ line: s.line, code: 'dna.section-empty', section: name, message: `"## ${name}" is empty` });
  }

  const vague = new RegExp(`\\b(${vagueWords.map((w) => w.replace(/[-]/g, '\\-')).join('|')})\\b`, 'gi');
  for (const s of sections.filter((x) => DIRECTION_SECTIONS.includes(x.title))) {
    for (const l of s.lines) {
      if (isConcrete(l.text)) continue;
      for (const m of l.text.matchAll(vague)) {
        findings.push({ line: l.line, code: 'dna.vague', word: m[1].toLowerCase(), message: `"${m[1]}" needs a concrete translation on this line (values, names or rules)` });
      }
    }
  }

  const decisions = sections.find((x) => x.title === 'Decisions');
  const count = decisions ? decisions.lines.filter((l) => /^\s*[-*]\s/.test(l.text)).length : 0;
  if (count > MAX_DECISIONS) findings.push({ line: decisions.line, code: 'dna.decisions', message: `${count} decisions (max ${MAX_DECISIONS}); fold the oldest into one summary line` });

  const total = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').length;
  if (total > MAX_LINES) findings.push({ line: MAX_LINES + 1, code: 'dna.length', message: `${total} lines (max ${MAX_LINES}); point to token files instead of copying values` });
  return findings;
}

export function sliceDna(text, domain) {
  const wanted = domain === undefined ? null : [...REQUIRED, DOMAINS[domain]].filter(Boolean);
  return parseDna(text).sections
    .filter((s) => !wanted || wanted.includes(s.title))
    .map((s) => [`## ${s.title}`, ...s.lines.map((l) => l.text)].join('\n').trimEnd())
    .join('\n\n') + '\n';
}

// ponytail: heuristic. A number, a hex colour, or a separator followed by 4+ words
// counts as a translation; tune against real DNA files if it misfires.
function isConcrete(line) {
  return /\d|#[0-9a-f]{3,8}\b/i.test(line) || /(?::|—|–|->|→|=)\s*(?:\S+\s+){3,}\S+/.test(line);
}
