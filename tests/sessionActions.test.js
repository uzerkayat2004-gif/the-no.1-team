const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Mock os.homedir once for all tests to point to a virtual path
mock.method(os, 'homedir', () => '/mock/home');

// Require the module under test after mocking os.homedir
const {
  renameSession,
  pinSession,
  archiveSession,
  deleteSession,
  duplicateSession
} = require('../src/main/sessionActions.js');

const SESSIONS_DIR = path.join('/mock/home', 'no1team', 'brain', 'sessions');

test('sessionActions', async (t) => {
  afterEach(() => {
    mock.restoreAll();
    // Re-mock os.homedir to ensure it stays mocked between tests
    mock.method(os, 'homedir', () => '/mock/home');
  });

  await t.test('renameSession', async (t) => {
    await t.test('returns false if session does not exist', () => {
      mock.method(fs, 'existsSync', () => false);
      assert.strictEqual(renameSession('test-folder', 'New Name'), false);
    });

    await t.test('renames session and returns true if it exists', () => {
      const p = path.join(SESSIONS_DIR, 'test-folder', 'session.md');
      mock.method(fs, 'existsSync', (checkPath) => checkPath === p);
      mock.method(fs, 'readFileSync', () => '# Old Name\nStatus: 💾 Saved Draft\nContent');
      mock.method(fs, 'writeFileSync', () => {});

      assert.strictEqual(renameSession('test-folder', 'New Name'), true);

      const writeCalls = fs.writeFileSync.mock.calls;
      assert.strictEqual(writeCalls.length, 1);
      assert.strictEqual(writeCalls[0].arguments[0], p);
      assert.strictEqual(writeCalls[0].arguments[1], '# New Name\nStatus: 💾 Saved Draft\nContent');
    });
  });

  await t.test('pinSession', async (t) => {
    await t.test('returns false if session does not exist', () => {
      mock.method(fs, 'existsSync', () => false);
      assert.strictEqual(pinSession('test-folder', true), false);
    });

    await t.test('pins session if not already pinned', () => {
      const p = path.join(SESSIONS_DIR, 'test-folder', 'session.md');
      mock.method(fs, 'existsSync', (checkPath) => checkPath === p);
      mock.method(fs, 'readFileSync', () => '# Name\nContent');
      mock.method(fs, 'writeFileSync', () => {});

      assert.strictEqual(pinSession('test-folder', true), true);

      const writeCalls = fs.writeFileSync.mock.calls;
      assert.strictEqual(writeCalls.length, 1);
      assert.strictEqual(writeCalls[0].arguments[0], p);
      assert.strictEqual(writeCalls[0].arguments[1], '# Name\nContent\n#pinned');
    });

    await t.test('does not double pin session if already pinned', () => {
      const p = path.join(SESSIONS_DIR, 'test-folder', 'session.md');
      mock.method(fs, 'existsSync', (checkPath) => checkPath === p);
      mock.method(fs, 'readFileSync', () => '# Name\nContent\n#pinned');
      mock.method(fs, 'writeFileSync', () => {});

      assert.strictEqual(pinSession('test-folder', true), true);

      const writeCalls = fs.writeFileSync.mock.calls;
      assert.strictEqual(writeCalls.length, 1);
      assert.strictEqual(writeCalls[0].arguments[0], p);
      assert.strictEqual(writeCalls[0].arguments[1], '# Name\nContent\n#pinned');
    });

    await t.test('unpins session', () => {
      const p = path.join(SESSIONS_DIR, 'test-folder', 'session.md');
      mock.method(fs, 'existsSync', (checkPath) => checkPath === p);
      mock.method(fs, 'readFileSync', () => '# Name\nContent\n#pinned');
      mock.method(fs, 'writeFileSync', () => {});

      assert.strictEqual(pinSession('test-folder', false), true);

      const writeCalls = fs.writeFileSync.mock.calls;
      assert.strictEqual(writeCalls.length, 1);
      assert.strictEqual(writeCalls[0].arguments[0], p);
      assert.strictEqual(writeCalls[0].arguments[1], '# Name\nContent');
    });
  });

  await t.test('archiveSession', async (t) => {
    await t.test('returns false if session does not exist', () => {
      mock.method(fs, 'existsSync', () => false);
      assert.strictEqual(archiveSession('test-folder'), false);
    });

    await t.test('archives session', () => {
      const p = path.join(SESSIONS_DIR, 'test-folder', 'session.md');
      mock.method(fs, 'existsSync', (checkPath) => checkPath === p);
      mock.method(fs, 'readFileSync', () => '# Name\nStatus: 💾 Saved Draft\nContent');
      mock.method(fs, 'writeFileSync', () => {});

      assert.strictEqual(archiveSession('test-folder'), true);

      const writeCalls = fs.writeFileSync.mock.calls;
      assert.strictEqual(writeCalls.length, 1);
      assert.strictEqual(writeCalls[0].arguments[0], p);
      assert.strictEqual(writeCalls[0].arguments[1], '# Name\nStatus: 📦 Archived\nContent');
    });
  });

  await t.test('deleteSession', async (t) => {
    await t.test('returns false if directory does not exist', () => {
      mock.method(fs, 'existsSync', () => false);
      assert.strictEqual(deleteSession('test-folder'), false);
    });

    await t.test('deletes directory', () => {
      const d = path.join(SESSIONS_DIR, 'test-folder');
      mock.method(fs, 'existsSync', (checkPath) => checkPath === d);
      mock.method(fs, 'rmSync', () => {});

      assert.strictEqual(deleteSession('test-folder'), true);

      const rmCalls = fs.rmSync.mock.calls;
      assert.strictEqual(rmCalls.length, 1);
      assert.strictEqual(rmCalls[0].arguments[0], d);
      assert.deepStrictEqual(rmCalls[0].arguments[1], { recursive: true, force: true });
    });
  });

  await t.test('duplicateSession', async (t) => {
    await t.test('returns false if source directory does not exist', () => {
      mock.method(fs, 'existsSync', () => false);
      assert.strictEqual(duplicateSession('test-folder', 'New Name'), false);
    });

    await t.test('duplicates session and updates session.md', () => {
      const src = path.join(SESSIONS_DIR, 'test-folder');
      const safeName = 'new-name';
      const dest = path.join(SESSIONS_DIR, safeName);
      const destMd = path.join(dest, 'session.md');

      mock.method(fs, 'existsSync', (checkPath) => {
        if (checkPath === src) return true;
        if (checkPath === destMd) return true;
        return false;
      });
      mock.method(fs, 'cpSync', () => {});
      mock.method(fs, 'readFileSync', () => '# Old Name\nStatus: 📦 Archived\nContent');
      mock.method(fs, 'writeFileSync', () => {});

      const result = duplicateSession('test-folder', 'New Name');

      assert.strictEqual(result, safeName);

      const cpCalls = fs.cpSync.mock.calls;
      assert.strictEqual(cpCalls.length, 1);
      assert.strictEqual(cpCalls[0].arguments[0], src);
      assert.strictEqual(cpCalls[0].arguments[1], dest);
      assert.deepStrictEqual(cpCalls[0].arguments[2], { recursive: true });

      const writeCalls = fs.writeFileSync.mock.calls;
      assert.strictEqual(writeCalls.length, 1);
      assert.strictEqual(writeCalls[0].arguments[0], destMd);
      assert.strictEqual(writeCalls[0].arguments[1], '# New Name\nStatus: 💾 Saved Draft\nContent');
    });

    await t.test('handles duplicating session without session.md', () => {
      const src = path.join(SESSIONS_DIR, 'test-folder');
      const safeName = 'new-name';
      const dest = path.join(SESSIONS_DIR, safeName);
      const destMd = path.join(dest, 'session.md');

      mock.method(fs, 'existsSync', (checkPath) => {
        if (checkPath === src) return true;
        if (checkPath === destMd) return false;
        return false;
      });
      mock.method(fs, 'cpSync', () => {});
      mock.method(fs, 'writeFileSync', () => {});

      const result = duplicateSession('test-folder', 'New Name');
      assert.strictEqual(result, safeName);

      const writeCalls = fs.writeFileSync.mock.calls;
      assert.strictEqual(writeCalls.length, 0);
    });
  });
});
