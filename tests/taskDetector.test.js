const test = require('node:test');
const assert = require('node:assert');
const { detectTaskType, stripSlashCommand, TASK_TYPES } = require('../src/main/taskDetector.js');

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
    assert.deepStrictEqual(result, { taskType: TASK_TYPES.quick, fromSlash: true });
  });

  await t.test('should detect /code', () => {
    const result = detectTaskType('/code some code');
    assert.deepStrictEqual(result, { taskType: TASK_TYPES.code, fromSlash: true });
  });

  await t.test('should return null for unknown slash command', () => {
    const result = detectTaskType('/unknown command');
    assert.deepStrictEqual(result, { taskType: TASK_TYPES.general, fromSlash: false });
  });
});

test('detectTaskType - keywords', async (t) => {
  await t.test('should detect quick research from keywords', () => {
    const result = detectTaskType('can you do a quick research on AI?');
    assert.deepStrictEqual(result, { taskType: TASK_TYPES.quick, fromSlash: false });
  });

  await t.test('should detect deep research from keywords', () => {
    const result = detectTaskType('thorough research needed');
    assert.deepStrictEqual(result, { taskType: TASK_TYPES.deep, fromSlash: false });
  });

  await t.test('should default to general', () => {
    const result = detectTaskType('hello');
    assert.deepStrictEqual(result, { taskType: TASK_TYPES.general, fromSlash: false });
  });
});

test('detectTaskType - edge cases', async (t) => {
  await t.test('should handle null/undefined/non-string', () => {
    const expected = { taskType: TASK_TYPES.general, fromSlash: false };
    assert.deepStrictEqual(detectTaskType(null), expected);
    assert.deepStrictEqual(detectTaskType(undefined), expected);
    assert.deepStrictEqual(detectTaskType(123), expected);
  });
});
