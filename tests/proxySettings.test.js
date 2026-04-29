const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { loadProxySettings } = require('../src/main/proxySettings');

test('loadProxySettings should return DEFAULT_SETTINGS and log error when parsing fails', (t) => {
  // Mock setup
  t.mock.method(fs, 'existsSync', () => true);
  t.mock.method(fs, 'readFileSync', () => '{ invalid_json'); // This will cause JSON.parse to throw

  let errorLogged = false;
  t.mock.method(console, 'error', (msg, e) => {
    if (msg.includes('Failed to parse proxy config:')) {
      errorLogged = true;
    }
  });

  const settings = loadProxySettings();

  // Verify it returns default settings
  assert.deepStrictEqual(settings, {
    proxyUrl: 'http://localhost:20128',
    apiKey: 'your-9router-api-key',
    claudeBaseUrl: 'http://localhost:20128',
    openaiBaseUrl: 'http://localhost:20128/v1',
    geminiBaseUrl: 'http://localhost:20128/v1',
  });

  // Verify it logged the error
  assert.strictEqual(errorLogged, true, 'Should have logged an error to console.error');
});
