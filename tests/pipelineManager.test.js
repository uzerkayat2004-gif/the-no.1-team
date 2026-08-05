const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

// Mock out dependencies that break outside of Electron/Firebase
const Module = require('node:module');
const originalRequire = Module.prototype.require;

const authMiddlewareMock = {
  checkSession: () => { throw new Error('Test Auth Error'); }
};

Module.prototype.require = function(request) {
  if (request === 'firebase-admin') {
    return {
      auth: () => ({
        verifyIdToken: async () => ({ uid: 'mocked-user' })
      })
    };
  }
  if (request === 'electron') {
    return {
      app: {
        getPath: () => os.homedir(),
        isPackaged: false
      },
      BrowserWindow: {},
      dialog: {}
    };
  }

  if (request === './authMiddleware' || request === '../src/main/authMiddleware') {
    return authMiddlewareMock;
  }

  return originalRequire.apply(this, arguments);
};

// Create a temp dir for homedir to prevent accidental pollution
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-test-'));
const originalHomedir = os.homedir;
os.homedir = () => tmpHome;

// Now require pipelineManager after mocks are in place
const pipelineManager = require('../src/main/pipelineManager');

test('pipelineManager security check catches auth error', async (t) => {
  t.after(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    os.homedir = originalHomedir;
  });

  let caughtMessage = null;
  const listener = (msg) => {
    if (msg.message && msg.message.includes('Security Error')) {
      caughtMessage = msg;
    }
  };

  pipelineManager.on('system-message', listener);

  // Provide a valid task to bypass the topic validation (if it reached that far, though auth is checked first)
  await pipelineManager.startPipeline({
    userId: 'test-user',
    sessionId: 'test-session',
    task: 'Valid Task Here',
    agents: []
  });

  pipelineManager.off('system-message', listener);

  assert.ok(caughtMessage, 'Should have emitted a system-message with Security Error');
  assert.strictEqual(caughtMessage.sessionId, 'test-session');
  assert.ok(caughtMessage.message.includes('Security Error'), 'Message should indicate Security Error');
  assert.ok(caughtMessage.message.includes('Test Auth Error'), 'Message should contain the thrown error message');
});
