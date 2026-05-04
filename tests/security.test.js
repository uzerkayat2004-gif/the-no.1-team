const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { getSafeSessionPath } = require('../src/main/sessionActions');
const { getSafeBrainPath, writeFile, readFile } = require('../src/main/brainMemory');
const workspaceManager = require('../src/main/workspaceManager');

test('sessionActions path guard rejects traversal and absolute paths', () => {
  assert.throws(() => getSafeSessionPath('../outside'), /Path traversal/);
  assert.throws(() => getSafeSessionPath('..\\outside'), /Path traversal/);
  assert.throws(() => getSafeSessionPath(path.resolve(os.homedir(), 'outside')), /Path traversal/);

  const safe = getSafeSessionPath('session-1', 'session.md');
  assert.ok(safe.endsWith(path.join('session-1', 'session.md')));
});

test('brainMemory path guard rejects traversal and keeps valid paths inside brain', () => {
  assert.throws(() => getSafeBrainPath('../outside.md'), /Path traversal/);
  assert.throws(() => getSafeBrainPath('..\\outside.md'), /Path traversal/);
  assert.throws(() => getSafeBrainPath(path.resolve(os.homedir(), 'outside.md')), /Path traversal/);

  const safe = getSafeBrainPath('memory/sessions.md');
  assert.ok(safe.endsWith(path.join('memory', 'sessions.md')));
  assert.strictEqual(writeFile('../outside.md', 'nope'), false);
  assert.strictEqual(readFile('../outside.md'), '');
});

test('workspaceManager validates directories and limits noisy workspace listing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'no1team-workspace-'));
  try {
    fs.mkdirSync(path.join(tmp, 'node_modules'));
    fs.writeFileSync(path.join(tmp, 'node_modules', 'ignored.js'), 'ignored');
    fs.mkdirSync(path.join(tmp, 'src'));
    fs.writeFileSync(path.join(tmp, 'src', 'kept.js'), 'kept');

    const validation = workspaceManager.validateWorkspace(tmp);
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.outsideDefaultBase, true);

    const files = workspaceManager.listWorkspaceFiles(tmp);
    assert.ok(files.some(file => file.path === path.join('src', 'kept.js')));
    assert.ok(!files.some(file => file.path.includes('node_modules')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
