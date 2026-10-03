import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { install, targets, loadHosts, resolveBin } from '../tools/install.mjs';

// Review focus 4: paths with spaces and non-ASCII characters.
const temp = (t) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi install ö ')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };
const rel = (dir, actions) => actions.map((a) => `${a.action} ${path.relative(dir, a.dest).split(path.sep).join('/')}`);

test('hosts that share a folder get one copy; Claude Code gets its own folder only when chosen', () => {
  const hosts = loadHosts();
  assert.deepEqual(targets(hosts, ['codex', 'cursor', 'opencode'], 'project', 'p'), [path.join('p', '.agents/skills')]);
  assert.deepEqual(targets(hosts, 'all', 'project', 'p').sort(), [path.join('p', '.agents/skills'), path.join('p', '.claude/skills')].sort());
  assert.ok(targets(hosts, ['antigravity', 'hermes'], 'user', 'h').includes(path.join('h', '.gemini/config/skills')));
  assert.throws(() => targets(hosts, ['nope'], 'project', 'p'), /unknown host/);
});

test('install copies the whole set side by side, is idempotent, and uninstall removes only Nomi', (t) => {
  const dir = temp(t);
  fs.mkdirSync(path.join(dir, '.agents', 'skills', 'other'), { recursive: true });
  assert.deepEqual(rel(dir, install({ hosts: ['codex'], dir, dryRun: true })), ['copy .agents/skills/nomi', 'copy .agents/skills/nomi-web']);
  assert.equal(fs.existsSync(path.join(dir, '.agents', 'skills', 'nomi')), false, 'a dry run writes nothing');
  install({ hosts: ['codex'], dir });
  // The domain skill finds the core as its sibling: the layout the skills rely on.
  assert.ok(fs.existsSync(path.join(dir, '.agents', 'skills', 'nomi-web', '..', 'nomi', 'scripts', 'nomi.mjs')));
  fs.writeFileSync(path.join(dir, '.agents', 'skills', 'nomi', 'stale.txt'), 'left by an older version');
  assert.deepEqual(rel(dir, install({ hosts: ['codex'], dir })), ['replace .agents/skills/nomi', 'replace .agents/skills/nomi-web']);
  assert.equal(fs.existsSync(path.join(dir, '.agents', 'skills', 'nomi', 'stale.txt')), false);
  assert.equal(fs.existsSync(path.join(dir, '.claude')), false, 'no .claude folder unless Claude Code is a target');
  assert.deepEqual(rel(dir, install({ hosts: ['codex'], dir, uninstall: true })), ['remove .agents/skills/nomi', 'remove .agents/skills/nomi-web']);
  assert.deepEqual(fs.readdirSync(path.join(dir, '.agents', 'skills')), ['other']);
  assert.deepEqual(install({ hosts: ['codex'], dir, uninstall: true }), []);
});

test('install refuses to replace a foreign folder named like a Nomi skill, and user scope uses the home folder', (t) => {
  const dir = temp(t), home = temp(t);
  fs.mkdirSync(path.join(dir, '.claude', 'skills', 'nomi'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'skills', 'nomi', 'SKILL.md'), '---\nname: something-else\n---\n');
  assert.throws(() => install({ hosts: ['claude'], dir }), /not the Nomi skill/);
  install({ scope: 'user', hosts: ['claude', 'hermes'], home });
  assert.ok(fs.existsSync(path.join(home, '.claude', 'skills', 'nomi-web', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(home, '.hermes', 'skills', 'nomi', 'SKILL.md')));
});

test('a host CLI resolves to spawnable arguments, or null when it is not installed', (t) => {
  const dir = temp(t);
  assert.equal(resolveBin('host-x', { PATH: dir }), null);
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(dir, 'host-x.cmd'), '@ECHO off\r\n"%_prog%"  "%dp0%\\node_modules\\host-x\\bin\\cli.mjs" %*\r\n');
    assert.deepEqual(resolveBin('host-x', { PATH: dir }), [process.execPath, path.join(dir, 'node_modules', 'host-x', 'bin', 'cli.mjs')]);
  } else {
    fs.writeFileSync(path.join(dir, 'host-x'), '');
    assert.deepEqual(resolveBin('host-x', { PATH: dir }), [path.join(dir, 'host-x')]);
  }
});
