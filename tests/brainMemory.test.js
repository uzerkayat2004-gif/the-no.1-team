const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Mock os.homedir before requiring the module
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'no1team-test-'));
const originalHomedir = os.homedir;
os.homedir = () => tmpDir;

const brainMemory = require('../src/main/brainMemory.js');

test('brainMemory basic file operations', async (t) => {
  await t.test('writeFile and readFile basic', () => {
    const success = brainMemory.writeFile('test-file.txt', 'hello world');
    assert.strictEqual(success, true);

    const content = brainMemory.readFile('test-file.txt');
    assert.strictEqual(content, 'hello world');
  });

  await t.test('readFile on non-existent file', () => {
    const content = brainMemory.readFile('does-not-exist.txt');
    assert.strictEqual(content, '');
  });

  await t.test('writeFile overwrite creates backup', () => {
    brainMemory.writeFile('test-backup.txt', 'v1');
    brainMemory.writeFile('test-backup.txt', 'v2');

    // Original should be v2
    const content = brainMemory.readFile('test-backup.txt');
    assert.strictEqual(content, 'v2');

    // Backup should be v1
    const backupContent = brainMemory.readFile('test-backup.txt.backup');
    assert.strictEqual(backupContent, 'v1');
  });

  await t.test('restoreBackup restores previous version', () => {
    brainMemory.writeFile('test-restore.txt', 'v1');
    brainMemory.writeFile('test-restore.txt', 'v2');

    const restoreSuccess = brainMemory.restoreBackup('test-restore.txt');
    assert.strictEqual(restoreSuccess, true);

    // Original should be v1 again
    const content = brainMemory.readFile('test-restore.txt');
    assert.strictEqual(content, 'v1');
  });

  await t.test('restoreBackup on non-existent backup', () => {
    const restoreSuccess = brainMemory.restoreBackup('no-backup.txt');
    assert.strictEqual(restoreSuccess, false);
  });
});

test('brainMemory session operations', async (t) => {
  await t.test('saveSession and loadSessionContext', () => {
    const sessionData = {
      sessionId: 'sess-123',
      sessionName: 'Test Session',
      taskType: 'testing',
      task: 'Write unit tests for brainMemory',
      finalAnswer: 'All tests pass!\n- Tested everything',
      seniorAgent: 'Tester',
      agents: ['Coder', 'Reviewer'],
      researchData: {
        'topic-1': 'Some research content',
        'topic-2': 'More research content'
      },
      combinedDoc: 'Combined research content',
      brainstormTranscript: 'Agent 1: hello\nAgent 2: hi',
      bossApproved: true,
      sendBackCount: 1
    };

    const folderRel = brainMemory.saveSession(sessionData);

    // Check returned folder path
    assert.strictEqual(folderRel.startsWith('sessions/'), true);

    // Verify session context loads properly
    const ctx = brainMemory.loadSessionContext(folderRel);

    assert.strictEqual(ctx.moc.includes('# Test Session'), true);
    assert.strictEqual(ctx.moc.includes('Task Type: testing'), true);
    assert.strictEqual(ctx.moc.includes('Status: ✅ Approved'), true);
    assert.strictEqual(ctx.moc.includes('Agents: Coder, Reviewer'), true);

    // Check key points extraction
    assert.strictEqual(ctx.moc.includes('## Key Points\n- Tested everything'), true);

    assert.strictEqual(ctx.research.includes('Some research content'), true);
    assert.strictEqual(ctx.combined.includes('Combined research content'), true);
    assert.strictEqual(ctx.brainstorm.includes('Agent 1: hello'), true);
    assert.strictEqual(ctx.final.includes('All tests pass!'), true);
  });

  await t.test('buildResumeBriefing', () => {
    const sessionData = {
      sessionId: 'sess-resume',
      taskType: 'testing',
      task: 'Original task',
      finalAnswer: 'Partial answer',
    };

    const folderRel = brainMemory.saveSession(sessionData);

    const resume = brainMemory.buildResumeBriefing(folderRel, 'New subtask');

    assert.strictEqual(resume.includes('=== RESUMING PREVIOUS SESSION ==='), true);
    assert.strictEqual(resume.includes('PREVIOUS SESSION OVERVIEW:'), true);
    assert.strictEqual(resume.includes('PREVIOUS FINAL ANSWER (summary):'), true);
    assert.strictEqual(resume.includes('Partial answer'), true);
    assert.strictEqual(resume.includes('NEW TASK IN THIS SESSION:\nNew subtask'), true);
  });
});

test('brainMemory metadata and stats operations', async (t) => {
  await t.test('listSessions', () => {
    brainMemory.saveSession({ sessionId: 'list-1', sessionName: 'First Session', taskType: 'coding', bossApproved: true });
    brainMemory.saveSession({ sessionId: 'list-2', sessionName: 'Second Session', taskType: 'research', bossApproved: false });

    const sessions = brainMemory.listSessions();
    assert.strictEqual(sessions.length >= 2, true);

    // Sort logic might affect index, but we just check presence
    const foundFirst = sessions.find(s => s.name === 'First Session');
    const foundSecond = sessions.find(s => s.name === 'Second Session');

    assert.ok(foundFirst);
    assert.strictEqual(foundFirst.taskType, 'coding');
    assert.strictEqual(foundFirst.status, '✅ Approved');

    assert.ok(foundSecond);
    assert.strictEqual(foundSecond.taskType, 'research');
    assert.strictEqual(foundSecond.status, '🔄 In Progress');
  });

  await t.test('updateAgentPerformance', () => {
    brainMemory.updateAgentPerformance('agent-x', 'coding', true, 0);
    brainMemory.updateAgentPerformance('agent-x', 'coding', false, 2);

    const agentLog = brainMemory.readFile('agents/agent-x.md');
    assert.strictEqual(agentLog.includes('✅ Approved'), true);
    assert.strictEqual(agentLog.includes('🔄 Not approved'), true);
    assert.strictEqual(agentLog.includes('Send-backs: 2'), true);
  });

  await t.test('updateSkillPerformance and getSkillStats', () => {
    brainMemory.updateSkillPerformance('writing', true, 0);
    brainMemory.updateSkillPerformance('writing', false, 1);
    brainMemory.updateSkillPerformance('writing', true, 0);
    brainMemory.updateSkillPerformance('drawing', true, 0);

    const stats = brainMemory.getSkillStats();

    assert.ok(stats['writing']);
    assert.strictEqual(stats['writing'].total, 3);
    assert.strictEqual(stats['writing'].approved, 2);
    assert.strictEqual(stats['writing'].sendBacks, 1);

    assert.ok(stats['drawing']);
    assert.strictEqual(stats['drawing'].total, 1);
    assert.strictEqual(stats['drawing'].approved, 1);
    assert.strictEqual(stats['drawing'].sendBacks, 0);
  });

  await t.test('logError', () => {
    brainMemory.logError('agent-err', 'Test error message');
    const errorLog = brainMemory.readFile('memory/errors.md');
    assert.strictEqual(errorLog.includes('agent-err: Test error message'), true);
  });

  await t.test('loadRelevantMemory', () => {
    // Inject preferences and learnings
    brainMemory.writeFile('boss/preferences.md', 'Boss likes short answers.');

    brainMemory.saveSession({
      sessionId: 'mem-task',
      taskType: 'testing',
      task: 'Make testing easy',
      finalAnswer: 'Testing is easy now.',
      bossApproved: true
    });

    const memory = brainMemory.loadRelevantMemory('testing', 'Make testing easy');

    assert.strictEqual(memory.includes('BOSS PREFERENCES:'), true);
    assert.strictEqual(memory.includes('Boss likes short answers.'), true);
    assert.strictEqual(memory.includes('RECENT LEARNINGS:'), true);
    assert.strictEqual(memory.includes('RELATED PAST KNOWLEDGE:'), true);
    assert.strictEqual(memory.includes('Testing is easy now.'), true);
  });
});

// Cleanup temp dir after all tests
test.after(() => {
  os.homedir = originalHomedir;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
