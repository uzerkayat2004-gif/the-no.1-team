const test = require('node:test');
const assert = require('node:assert');
const { exportMarkdown, exportFullReport, exportPlainText } = require('../src/main/exportManager.js');

test('exportMarkdown handles missing data gracefully', (t) => {
  const d = {};
  const result = exportMarkdown(d);
  assert.ok(result.includes('# Session Export'), 'Should default sessionName');
  assert.ok(result.includes('## Original Task\nundefined'), 'Should handle missing task correctly');
  assert.ok(result.includes('## Final Answer\nNo final answer yet.'), 'Should default finalAnswer');
});

test('exportMarkdown handles full data correctly', (t) => {
  const d = {
    sessionName: 'Test Session',
    date: '2023-01-01',
    taskType: 'coding',
    task: 'Fix bugs',
    finalAnswer: 'Bugs fixed.'
  };
  const result = exportMarkdown(d);
  assert.ok(result.includes('# Test Session'));
  assert.ok(result.includes('**Date:** 2023-01-01'));
  assert.ok(result.includes('**Task Type:** coding'));
  assert.ok(result.includes('## Original Task\nFix bugs'));
  assert.ok(result.includes('## Final Answer\nBugs fixed.'));
});

test('exportFullReport handles missing data and missing context gracefully', (t) => {
  const d = {};
  const result = exportFullReport(d, null);
  assert.ok(result.includes('# Full Session Report — Session'), 'Should default sessionName');
  assert.ok(result.includes('**Senior Agent:** N/A'), 'Should default seniorAgent');
  assert.ok(result.includes('**Agents:** '), 'Should default agents to empty string representation');
  assert.ok(result.includes('No research data.'), 'Should default research');
  assert.ok(result.includes('No combined document.'), 'Should default combined');
  assert.ok(result.includes('No brainstorm data.'), 'Should default brainstorm');
  assert.ok(result.includes('No final answer.'), 'Should default finalAnswer');
});

test('exportPlainText handles missing data gracefully', (t) => {
  const d = {};
  const result = exportPlainText(d);
  assert.ok(result.includes('Session Export'), 'Should default sessionName');
  assert.ok(result.includes('TASK:\nundefined'), 'Should handle undefined task');
  assert.ok(result.includes('FINAL ANSWER:\nNo final answer yet.'), 'Should default finalAnswer');
});
