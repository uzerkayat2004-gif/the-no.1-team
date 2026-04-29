const test = require('node:test');
const assert = require('node:assert');
const {
  createSession,
  getSession,
  updateSession,
  addToHistory,
  clearSession
} = require('../src/main/sessionContext');

test('sessionContext tests', async (t) => {

  await t.test('createSession should create a session with default values', () => {
    const sessionId = 'test-session-1';
    const session = createSession(sessionId);

    assert.strictEqual(session.sessionId, sessionId);
    assert.strictEqual(session.taskType, 'general');
    assert.strictEqual(session.seniorAgent, null);
    assert.deepStrictEqual(session.activeAgents, []);
    assert.strictEqual(session.workDir, null);
    assert.strictEqual(session.mode, 'manual');
    assert.strictEqual(session.phase, 'idle');
    assert.deepStrictEqual(session.history, []);
    assert.strictEqual(session.round, 0);
    assert.ok(session.createdAt, 'createdAt should be defined');

    // Cleanup
    clearSession(sessionId);
  });

  await t.test('createSession should create a session with provided data', () => {
    const sessionId = 'test-session-2';
    const data = {
      taskType: 'specific',
      seniorAgent: 'AgentSmith',
      activeAgents: ['AgentA', 'AgentB'],
      workDir: '/tmp/test',
      mode: 'auto',
      phase: 'working'
    };

    const session = createSession(sessionId, data);

    assert.strictEqual(session.sessionId, sessionId);
    assert.strictEqual(session.taskType, 'specific');
    assert.strictEqual(session.seniorAgent, 'AgentSmith');
    assert.deepStrictEqual(session.activeAgents, ['AgentA', 'AgentB']);
    assert.strictEqual(session.workDir, '/tmp/test');
    assert.strictEqual(session.mode, 'auto');
    assert.strictEqual(session.phase, 'working');

    // Cleanup
    clearSession(sessionId);
  });

  await t.test('getSession should return null for a non-existent session', () => {
    const session = getSession('non-existent-session');
    assert.strictEqual(session, null);
  });

  await t.test('getSession should return an existing session', () => {
    const sessionId = 'test-session-3';
    createSession(sessionId);

    const session = getSession(sessionId);
    assert.ok(session, 'session should be returned');
    assert.strictEqual(session.sessionId, sessionId);

    // Cleanup
    clearSession(sessionId);
  });

  await t.test('updateSession should return null for a non-existent session', () => {
    const updated = updateSession('non-existent-session', { phase: 'done' });
    assert.strictEqual(updated, null);
  });

  await t.test('updateSession should update an existing session', () => {
    const sessionId = 'test-session-4';
    createSession(sessionId);

    const updates = {
      phase: 'working',
      round: 5
    };

    const updatedSession = updateSession(sessionId, updates);
    assert.strictEqual(updatedSession.phase, 'working');
    assert.strictEqual(updatedSession.round, 5);

    const fetchedSession = getSession(sessionId);
    assert.strictEqual(fetchedSession.phase, 'working');
    assert.strictEqual(fetchedSession.round, 5);
    assert.strictEqual(fetchedSession.taskType, 'general', 'other properties should remain unchanged');

    // Cleanup
    clearSession(sessionId);
  });

  await t.test('addToHistory should do nothing for a non-existent session', () => {
    // Should not throw
    addToHistory('non-existent-session', { message: 'hello' });
  });

  await t.test('addToHistory should add an entry to session history', () => {
    const sessionId = 'test-session-5';
    createSession(sessionId);

    const entry = { role: 'user', content: 'test message' };
    addToHistory(sessionId, entry);

    const session = getSession(sessionId);
    assert.strictEqual(session.history.length, 1);

    const historyEntry = session.history[0];
    assert.strictEqual(historyEntry.role, 'user');
    assert.strictEqual(historyEntry.content, 'test message');
    assert.ok(historyEntry.timestamp, 'timestamp should be injected');

    // Cleanup
    clearSession(sessionId);
  });

  await t.test('clearSession should remove a session', () => {
    const sessionId = 'test-session-6';
    createSession(sessionId);
    assert.ok(getSession(sessionId));

    clearSession(sessionId);
    assert.strictEqual(getSession(sessionId), null);
  });
});
