const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { loadProxySettings, saveProxySettings } = require('./proxySettings');

const DEFAULT_SETTINGS = {
  proxyUrl: 'http://localhost:20128',
  apiKey: 'your-9router-api-key',
  claudeBaseUrl: 'http://localhost:20128',
  openaiBaseUrl: 'http://localhost:20128/v1',
  geminiBaseUrl: 'http://localhost:20128/v1',
};

const SETTINGS_PATH = path.join(os.homedir(), 'no1team', 'brain', 'proxy-settings.json');

test('proxySettings module', async (t) => {
  // Suppress console.error so tests stay clean
  t.mock.method(console, 'error', () => {});

  await t.test('loadProxySettings', async (t) => {
    await t.test('returns DEFAULT_SETTINGS if file does not exist', (t) => {
      const originalExistsSync = fs.existsSync;
      t.mock.method(fs, 'existsSync', (pathStr) => {
        if (pathStr === SETTINGS_PATH) return false;
        return originalExistsSync(pathStr); // Fallback
      });

      const settings = loadProxySettings();
      assert.deepStrictEqual(settings, DEFAULT_SETTINGS);
    });

    await t.test('returns merged settings if file exists', (t) => {
      const originalExistsSync = fs.existsSync;
      const originalReadFileSync = fs.readFileSync;
      const mockSettings = { proxyUrl: 'http://custom-proxy:1234', apiKey: 'custom-key' };

      t.mock.method(fs, 'existsSync', (pathStr) => {
        if (pathStr === SETTINGS_PATH) return true;
        return originalExistsSync(pathStr);
      });
      t.mock.method(fs, 'readFileSync', (pathStr, encoding) => {
        if (pathStr === SETTINGS_PATH) return JSON.stringify(mockSettings);
        return originalReadFileSync(pathStr, encoding);
      });

      const settings = loadProxySettings();
      assert.deepStrictEqual(settings, { ...DEFAULT_SETTINGS, ...mockSettings });
    });

    await t.test('returns DEFAULT_SETTINGS and logs error if file is invalid JSON', (t) => {
      const originalExistsSync = fs.existsSync;
      const originalReadFileSync = fs.readFileSync;

      t.mock.method(fs, 'existsSync', (pathStr) => {
        if (pathStr === SETTINGS_PATH) return true;
        return originalExistsSync(pathStr);
      });
      t.mock.method(fs, 'readFileSync', (pathStr, encoding) => {
        if (pathStr === SETTINGS_PATH) return '{ invalid json }';
        return originalReadFileSync(pathStr, encoding);
      });

      const settings = loadProxySettings();
      assert.deepStrictEqual(settings, DEFAULT_SETTINGS);
      assert.ok(console.error.mock.calls.length >= 1);

      const callsArgs = console.error.mock.calls.map(c => c.arguments[0]);
      const hasCorrectError = callsArgs.some(arg => typeof arg === 'string' && arg.includes('Failed to load proxy settings'));
      assert.ok(hasCorrectError);
    });
  });

  await t.test('saveProxySettings', async (t) => {
    await t.test('creates directory if it does not exist and saves file', (t) => {
      const dirPath = path.dirname(SETTINGS_PATH);
      const originalExistsSync = fs.existsSync;
      const originalWriteFileSync = fs.writeFileSync;
      let mkdirCalled = false;
      let writeFileSyncCalled = false;
      let writeArgs = null;

      t.mock.method(fs, 'existsSync', (pathStr) => {
        if (pathStr === dirPath) return false;
        return originalExistsSync(pathStr);
      });
      t.mock.method(fs, 'mkdirSync', () => { mkdirCalled = true; });
      t.mock.method(fs, 'writeFileSync', (pathStr, data) => {
        if (pathStr === SETTINGS_PATH) {
          writeFileSyncCalled = true;
          writeArgs = data;
        } else {
          originalWriteFileSync(pathStr, data);
        }
      });

      const testSettings = { proxyUrl: 'http://test:1234' };
      saveProxySettings(testSettings);

      assert.strictEqual(mkdirCalled, true);
      assert.strictEqual(writeFileSyncCalled, true);
      assert.strictEqual(writeArgs, JSON.stringify(testSettings, null, 2));
    });

    await t.test('does not create directory if it exists and saves file', (t) => {
      const dirPath = path.dirname(SETTINGS_PATH);
      const originalExistsSync = fs.existsSync;
      const originalWriteFileSync = fs.writeFileSync;
      let mkdirCalled = false;
      let writeFileSyncCalled = false;

      t.mock.method(fs, 'existsSync', (pathStr) => {
        if (pathStr === dirPath) return true;
        return originalExistsSync(pathStr);
      });
      t.mock.method(fs, 'mkdirSync', () => { mkdirCalled = true; });
      t.mock.method(fs, 'writeFileSync', (pathStr, data) => {
        if (pathStr === SETTINGS_PATH) {
          writeFileSyncCalled = true;
        } else {
          originalWriteFileSync(pathStr, data);
        }
      });

      saveProxySettings({ proxyUrl: 'http://test:1234' });

      assert.strictEqual(mkdirCalled, false);
      assert.strictEqual(writeFileSyncCalled, true);
    });

    await t.test('logs error if writing fails', (t) => {
      const dirPath = path.dirname(SETTINGS_PATH);
      const originalExistsSync = fs.existsSync;

      t.mock.method(fs, 'existsSync', (pathStr) => {
        if (pathStr === dirPath) return true;
        return originalExistsSync(pathStr);
      });
      t.mock.method(fs, 'writeFileSync', () => {
        throw new Error('Write failed');
      });

      // It shouldn't throw an error, it should catch it
      saveProxySettings({ proxyUrl: 'test' });

      assert.ok(console.error.mock.calls.length >= 1);
      const callsArgs = console.error.mock.calls.map(c => c.arguments[0]);
      const hasCorrectError = callsArgs.some(arg => typeof arg === 'string' && arg.includes('Failed to save proxy settings'));
      assert.ok(hasCorrectError);
    });
  });
});
