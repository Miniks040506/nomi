// Frontmatter reader for the YAML subset Nomi files use: scalars, quoted strings,
// inline and block lists, and one level of nested maps. Anything else throws with
// a line number, so a file that strict host parsers would reject never passes here.

export function splitFrontmatter(text) {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(src);
  if (!match) return { data: null, body: src, bodyLine: 1 };
  let data;
  try {
    data = parseYaml(match[1]);
  } catch (err) {
    // Report file lines: the YAML block starts one line below the opening "---".
    throw err instanceof FrontmatterError ? new FrontmatterError(err.line + 1, err.detail) : err;
  }
  return {
    data,
    body: src.slice(match[0].length),
    bodyLine: match[0].replace(/\n$/, '').split('\n').length + 1,
  };
}

export function parseYaml(src) {
  const out = {};
  let parent = null;
  let childIndent = null;
  src.replace(/\r\n?/g, '\n').split('\n').forEach((raw, i) => {
    const line = i + 1;
    const text = raw.trimEnd();
    if (!text.trim() || text.trim().startsWith('#')) return;
    const indent = text.length - text.trimStart().length;
    const item = text.trim();

    if (indent === 0) {
      const m = /^([A-Za-z0-9_-]+):(?:\s+(.*))?$/.exec(item);
      if (!m) throw fail(line, 'expected "key: value"');
      const value = m[2] === undefined ? '' : stripComment(m[2]);
      if (value === '') {
        out[m[1]] = null;
        parent = m[1];
        childIndent = null;
      } else {
        out[m[1]] = parseValue(value, line);
        parent = null;
      }
      return;
    }

    if (parent === null) throw fail(line, 'unexpected indentation');
    if (childIndent === null) childIndent = indent;
    if (indent !== childIndent) throw fail(line, 'only one level of nesting is supported');

    if (item.startsWith('- ')) {
      if (out[parent] === null) out[parent] = [];
      if (!Array.isArray(out[parent])) throw fail(line, 'list item inside a map');
      out[parent].push(parseValue(stripComment(item.slice(2)), line));
      return;
    }
    const m = /^([A-Za-z0-9_-]+):(?:\s+(.*))?$/.exec(item);
    if (!m) throw fail(line, 'expected "key: value"');
    if (out[parent] === null) out[parent] = {};
    if (Array.isArray(out[parent])) throw fail(line, 'map entry inside a list');
    const value = m[2] === undefined ? '' : stripComment(m[2]);
    out[parent][m[1]] = value === '' ? null : parseValue(value, line);
  });
  return out;
}

function stripComment(value) {
  const v = value.trim();
  if (v.startsWith('"') || v.startsWith("'")) return v;
  return v.replace(/(^|\s)#.*$/, '').trim();
}

function parseValue(v, line) {
  if (v.startsWith('"')) {
    const end = closingQuote(v, line);
    return JSON.parse(v.slice(0, end + 1));
  }
  if (v.startsWith("'")) {
    let i = 1;
    let s = '';
    for (; i < v.length; i++) {
      if (v[i] === "'" && v[i + 1] === "'") { s += "'"; i++; continue; }
      if (v[i] === "'") break;
      s += v[i];
    }
    if (i >= v.length) throw fail(line, 'unterminated string');
    if (v.slice(i + 1).trim().replace(/^#.*$/, '')) throw fail(line, 'text after closing quote');
    return s;
  }
  if (v.startsWith('[')) {
    if (!v.endsWith(']')) throw fail(line, 'unterminated inline list');
    const inner = v.slice(1, -1).trim();
    return inner ? inner.split(',').map((part) => parseValue(part.trim(), line)) : [];
  }
  if (/^[>|&*!{]/.test(v)) throw fail(line, 'unsupported YAML syntax');
  if (v.includes(': ') || v.endsWith(':')) throw fail(line, 'quote values that contain ": "');
  if (v === 'true' || v === 'false') return v === 'true';
  if (v === 'null' || v === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function closingQuote(v, line) {
  for (let i = 1; i < v.length; i++) {
    if (v[i] === '\\') { i++; continue; }
    if (v[i] === '"') {
      if (v.slice(i + 1).trim().replace(/^#.*$/, '')) throw fail(line, 'text after closing quote');
      return i;
    }
  }
  throw fail(line, 'unterminated string');
}

export class FrontmatterError extends Error {
  constructor(line, detail) {
    super(`frontmatter line ${line}: ${detail}`);
    this.line = line;
    this.detail = detail;
  }
}

function fail(line, message) {
  return new FrontmatterError(line, message);
}
