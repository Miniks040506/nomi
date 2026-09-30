import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitFrontmatter, parseYaml } from '../skills/nomi/scripts/lib/frontmatter.mjs';

test('splits frontmatter from body and reports the body start line', () => {
  const doc = '---\nnomi: 1\n---\n# Title\nbody\n';
  const { data, body, bodyLine } = splitFrontmatter(doc);
  assert.deepEqual(data, { nomi: 1 });
  assert.equal(body, '# Title\nbody\n');
  assert.equal(bodyLine, 4);
});

test('returns null data when there is no frontmatter', () => {
  const { data, body, bodyLine } = splitFrontmatter('# Just markdown\n');
  assert.equal(data, null);
  assert.equal(body, '# Just markdown\n');
  assert.equal(bodyLine, 1);
});

test('handles Windows line endings', () => {
  const { data, body } = splitFrontmatter('---\r\nname: nomi\r\n---\r\nhello\r\n');
  assert.deepEqual(data, { name: 'nomi' });
  assert.equal(body, 'hello\n');
});

test('ignores a leading byte-order mark written by Windows editors', () => {
  assert.deepEqual(splitFrontmatter('﻿---\nnomi: 1\n---\nbody\n').data, { nomi: 1 });
});

test('parses scalars, quoted strings and comments', () => {
  const data = parseYaml([
    'n: 1',
    'yes: true',
    'plain: hello world',
    'dq: "a: b # not a comment"',
    "sq: 'it''s'",
    'c: value # trailing comment',
    '# full-line comment',
  ].join('\n'));
  assert.deepEqual(data, { n: 1, yes: true, plain: 'hello world', dq: 'a: b # not a comment', sq: "it's", c: 'value' });
});

test('parses inline lists, block lists and one level of nested maps', () => {
  const data = parseYaml([
    'domains: [web, "3d"]',
    'tags:',
    '  - a',
    '  - b',
    'sources:',
    '  design: DESIGN.md',
    '  tokens: src/tokens.css',
  ].join('\n'));
  assert.deepEqual(data, { domains: ['web', '3d'], tags: ['a', 'b'], sources: { design: 'DESIGN.md', tokens: 'src/tokens.css' } });
});

test('rejects unquoted values containing ": " that strict YAML parsers would reject', () => {
  assert.throws(() => parseYaml('description: Use when: things happen'), /line 1.*quote/);
  assert.deepEqual(parseYaml('description: "Use when: things happen"'), { description: 'Use when: things happen' });
});

test('rejects syntax outside the supported subset with a line number', () => {
  assert.throws(() => parseYaml('name: nomi\ndescription: >\n  folded'), /line 2/);
  assert.throws(() => parseYaml('a:\n  b:\n    c: deep'), /line 3/);
});
