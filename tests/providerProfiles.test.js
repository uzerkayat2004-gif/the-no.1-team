const test = require('node:test');
const assert = require('node:assert');
const {
  getAllProfiles,
  getSerializableProfiles,
  normalizeExecutionMode,
  getModeCapabilities,
  getProfileForMode,
} = require('../src/main/providerProfiles');

test('provider execution metadata', async (t) => {
  await t.test('Claude supports native and proxy execution modes', () => {
    const claude = getAllProfiles().claude;
    assert.deepStrictEqual(claude.executionModes, ['native', 'proxy']);
    assert.strictEqual(claude.defaultExecutionMode, 'native');
  });

  await t.test('Codex supports native and proxy execution modes', () => {
    const codex = getAllProfiles().codex;
    assert.deepStrictEqual(codex.executionModes, ['native', 'proxy']);
    assert.strictEqual(codex.defaultExecutionMode, 'native');
  });

  await t.test('Gemini supports native execution only', () => {
    const gemini = getAllProfiles().gemini;
    assert.deepStrictEqual(gemini.executionModes, ['native']);
    assert.strictEqual(normalizeExecutionMode('gemini', 'proxy'), 'native');
  });

  await t.test('serialized profiles include execution metadata without functions', () => {
    const serialized = getSerializableProfiles();
    assert.deepStrictEqual(serialized.claude.executionModes, ['native', 'proxy']);
    assert.strictEqual(serialized.claude.defaultExecutionMode, 'native');
    assert.strictEqual(typeof serialized.claude.taskArgs, 'undefined');
    assert.strictEqual(typeof serialized.claude.envVars, 'undefined');
  });

  await t.test('mode capabilities are merged into mode-aware profile', () => {
    const claudeNative = getProfileForMode('claude', 'native');
    const claudeProxy = getProfileForMode('claude', 'proxy');
    assert.strictEqual(claudeNative.executionMode, 'native');
    assert.strictEqual(claudeNative.researchCapabilities.webSearch, 'native');
    assert.strictEqual(claudeProxy.executionMode, 'proxy');
    assert.strictEqual(claudeProxy.researchCapabilities.webSearch, 'unknown');
  });

  await t.test('unknown or unsupported execution modes normalize safely', () => {
    assert.strictEqual(normalizeExecutionMode('claude', 'banana'), 'native');
    assert.strictEqual(normalizeExecutionMode('missing', 'proxy'), 'native');
    assert.deepStrictEqual(getModeCapabilities('missing', 'proxy'), {});
  });
});
