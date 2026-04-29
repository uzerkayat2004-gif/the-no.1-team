const { test } = require('node:test');
const assert = require('node:assert');
const brainMemory = require('../src/main/brainMemory');
const { getAnalytics } = require('../src/main/analyticsManager');

test('getAnalytics works with empty inputs', (t) => {
  t.mock.method(brainMemory, 'listSessions', () => []);
  t.mock.method(brainMemory, 'getSkillStats', () => ({}));
  t.mock.method(brainMemory, 'readFile', () => '');

  const result = getAnalytics();
  assert.deepStrictEqual(result.overview, {
    totalSessions: 0,
    approved: 0,
    sentBack: 0,
    cancelled: 0,
    approvalRate: 0
  });
  assert.deepStrictEqual(result.taskBreakdown, {});
  assert.deepStrictEqual(result.agentStats, {});
  assert.deepStrictEqual(result.skillStats, {});
  assert.deepStrictEqual(result.recentSessions, []);
});

test('getAnalytics processes sessions correctly', (t) => {
  t.mock.method(brainMemory, 'listSessions', () => [
    { status: '✅ Approved', taskType: 'research' },
    { status: '🔄 Sent Back', taskType: 'coding' },
    { status: '❌ Cancelled' }, // No taskType, should default to 'general'
    { status: '✅ Approved', taskType: 'coding' },
    { status: '✅ Approved', taskType: 'research' },
    { status: '✅ Approved', taskType: 'coding' }
  ]);
  t.mock.method(brainMemory, 'getSkillStats', () => ({
    research: { total: 2, approved: 2, sendBacks: 0 }
  }));
  t.mock.method(brainMemory, 'readFile', () => '');

  const result = getAnalytics();
  assert.strictEqual(result.overview.totalSessions, 6);
  assert.strictEqual(result.overview.approved, 4);
  assert.strictEqual(result.overview.sentBack, 1);
  assert.strictEqual(result.overview.cancelled, 1);
  assert.strictEqual(result.overview.approvalRate, Math.round((4 / 6) * 100));

  assert.deepStrictEqual(result.taskBreakdown, {
    research: 2,
    coding: 3,
    general: 1
  });

  assert.strictEqual(result.recentSessions.length, 5);
  assert.strictEqual(result.recentSessions[0].taskType, 'research');

  assert.deepStrictEqual(result.skillStats, {
    research: { total: 2, approved: 2, sendBacks: 0 }
  });
});

test('getAnalytics processes agent profiles correctly', (t) => {
  t.mock.method(brainMemory, 'listSessions', () => []);

  t.mock.method(brainMemory, 'readFile', (path) => {
    if (path === 'agents/claude.md') {
      return "[2023-10-27] coding — ✅ Approved — Send-backs: 0\n" +
             "[2023-10-28] coding — 🔄 Not approved — Send-backs: 2\n" +
             "[2023-10-29] general — ✅ Approved — Send-backs: 1";
    }
    if (path === 'agents/codex.md') {
      return "[2023-10-27] coding — 🔄 Not approved — Send-backs: 5\n" +
             "Some random non-matching line\n";
    }
    return ''; // empty agent
  });
  t.mock.method(brainMemory, 'getSkillStats', () => ({}));

  const result = getAnalytics();

  assert.ok(result.agentStats.claude);
  assert.strictEqual(result.agentStats.claude.name, 'Claude Code'); // from providerProfiles default
  assert.strictEqual(result.agentStats.claude.total, 3);
  assert.strictEqual(result.agentStats.claude.approved, 2);
  assert.strictEqual(result.agentStats.claude.approvalRate, Math.round((2 / 3) * 100));
  assert.strictEqual(result.agentStats.claude.avgSendBacks, '1.0');

  assert.ok(result.agentStats.codex);
  assert.strictEqual(result.agentStats.codex.total, 1);
  assert.strictEqual(result.agentStats.codex.approved, 0);
  assert.strictEqual(result.agentStats.codex.approvalRate, 0);
  assert.strictEqual(result.agentStats.codex.avgSendBacks, '5.0');

  assert.strictEqual(result.agentStats.gemini, undefined);
});
