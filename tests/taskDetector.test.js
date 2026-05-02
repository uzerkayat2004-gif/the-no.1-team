const test = require('node:test');
const assert = require('node:assert');
const { detectTaskType, detectResearchPolicy, stripSlashCommand, TASK_TYPES } = require('../src/main/taskDetector.js');

test('stripSlashCommand', async (t) => {
  await t.test('should strip slash command and trim', () => {
    assert.strictEqual(stripSlashCommand('/quick research something'), 'research something');
    assert.strictEqual(stripSlashCommand('/code write a function'), 'write a function');
  });

  await t.test('should handle message without slash command', () => {
    assert.strictEqual(stripSlashCommand('just a message'), 'just a message');
  });

  await t.test('should handle empty string', () => {
    assert.strictEqual(stripSlashCommand(''), '');
  });

  await t.test('should handle null/undefined/non-string', () => {
    assert.strictEqual(stripSlashCommand(null), '');
    assert.strictEqual(stripSlashCommand(undefined), '');
    assert.strictEqual(stripSlashCommand(123), '123');
  });
});

test('detectTaskType - slash commands', async (t) => {
  await t.test('should detect /quick', () => {
    const result = detectTaskType('/quick do something');
    assert.strictEqual(result.taskType, TASK_TYPES.quick);
    assert.strictEqual(result.fromSlash, true);
    assert.strictEqual(result.researchPolicy.requiresCurrentResearch, true);
    assert.strictEqual(result.researchPolicy.minSources, 1);
  });

  await t.test('should detect /code', () => {
    const result = detectTaskType('/code some code');
    assert.strictEqual(result.taskType, TASK_TYPES.code);
    assert.strictEqual(result.fromSlash, true);
    assert.strictEqual(result.researchPolicy.requiresCurrentResearch, false);
  });

  await t.test('should return null for unknown slash command', () => {
    const result = detectTaskType('/unknown command');
    assert.strictEqual(result.taskType, TASK_TYPES.general);
    assert.strictEqual(result.fromSlash, false);
    assert.strictEqual(result.researchPolicy.requiresCurrentResearch, false);
  });
});

test('detectTaskType - keywords', async (t) => {
  await t.test('should detect quick research from keywords', () => {
    const result = detectTaskType('can you do a quick research on AI?');
    assert.strictEqual(result.taskType, TASK_TYPES.quick);
    assert.strictEqual(result.fromSlash, false);
    assert.strictEqual(result.researchPolicy.requiresCurrentResearch, true);
  });

  await t.test('should detect deep research from keywords', () => {
    const result = detectTaskType('thorough research needed');
    assert.strictEqual(result.taskType, TASK_TYPES.deep);
    assert.strictEqual(result.fromSlash, false);
    assert.strictEqual(result.researchPolicy.minSources, 5);
  });

  await t.test('should default to general', () => {
    const result = detectTaskType('hello');
    assert.strictEqual(result.taskType, TASK_TYPES.general);
    assert.strictEqual(result.fromSlash, false);
    assert.strictEqual(result.researchPolicy.requiresCurrentResearch, false);
  });
});

test('detectTaskType - edge cases', async (t) => {
  await t.test('should handle null/undefined/non-string', () => {
    [null, undefined, 123].forEach(value => {
      const result = detectTaskType(value);
      assert.strictEqual(result.taskType, TASK_TYPES.general);
      assert.strictEqual(result.fromSlash, false);
      assert.strictEqual(result.researchPolicy.requiresCurrentResearch, false);
    });
  });
});

test('detectResearchPolicy', async (t) => {
  await t.test('/research current OpenAI pricing requires 3 sources', () => {
    const policy = detectResearchPolicy('/research current OpenAI pricing', 'research');
    assert.strictEqual(policy.requiresCurrentResearch, true);
    assert.strictEqual(policy.requireUrls, true);
    assert.strictEqual(policy.minSources, 3);
  });

  await t.test('/deep latest model comparison requires 5 sources', () => {
    const policy = detectResearchPolicy('/deep latest model comparison', 'deep');
    assert.strictEqual(policy.requiresCurrentResearch, true);
    assert.strictEqual(policy.minSources, 5);
  });

  await t.test('coding task does not require current research', () => {
    const policy = detectResearchPolicy('/code build a navbar', 'code');
    assert.strictEqual(policy.requiresCurrentResearch, false);
    assert.strictEqual(policy.minSources, 0);
  });
});
