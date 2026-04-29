const { test } = require('node:test');
const assert = require('node:assert');
const { extractMeta } = require('./brainMemory');

test('extractMeta tests', async (t) => {
  await t.test('should extract a regular key correctly', () => {
    const content = 'Task Type: coding \nStatus: ✅ Approved';
    const result = extractMeta(content, 'Task Type');
    assert.strictEqual(result, 'coding');
  });

  await t.test('should handle missing regular keys gracefully', () => {
    const content = 'Status: ✅ Approved';
    const result = extractMeta(content, 'Task Type');
    assert.strictEqual(result, null);
  });

  await t.test('should handle multi-line strings correctly', () => {
    const content = 'Description: This is a description\nthat spans multiple lines.\nTask Type: general';
    const result = extractMeta(content, 'Description');
    assert.strictEqual(result, 'This is a description');
  });

  await t.test('should handle varying whitespace', () => {
    const content = 'Key:    Value   \n';
    const result = extractMeta(content, 'Key');
    assert.strictEqual(result, 'Value');
  });
});
