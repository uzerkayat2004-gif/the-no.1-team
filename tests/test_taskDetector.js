const { detectTaskType, TASK_TYPES } = require('./src/main/taskDetector.js');
const assert = require('assert');

function runTests() {
  const testCases = [
    { msg: '/quick research', expected: TASK_TYPES.quick },
    { msg: 'fast research', expected: TASK_TYPES.quick },
    { msg: 'deep research about node', expected: TASK_TYPES.deep },
    { msg: 'team code task', expected: TASK_TYPES.teamcode },
    { msg: 'review this file', expected: TASK_TYPES.review },
    { msg: 'review code', expected: TASK_TYPES.review },
    { msg: 'fix this bug', expected: TASK_TYPES.debug },
    { msg: 'test app feature', expected: TASK_TYPES.apptest },
    { msg: 'write test for this', expected: TASK_TYPES.test },
    { msg: 'plan the structure', expected: TASK_TYPES.plan },
    { msg: 'convert file to pdf', expected: TASK_TYPES.doc },
    { msg: 'brainstorm new ideas', expected: TASK_TYPES.brainstorm },
    { msg: 'build a server', expected: TASK_TYPES.code },
    { msg: 'look up definitions', expected: TASK_TYPES.research },
    { msg: 'hello world', expected: TASK_TYPES.general }
  ];

  let passed = 0;
  for (const t of testCases) {
    const res = detectTaskType(t.msg);
    if (res.taskType === t.expected) {
      passed++;
    } else {
      console.error(`Failed: ${t.msg}. Expected ${t.expected.id}, got ${res.taskType.id}`);
    }
  }
  console.log(`Passed ${passed}/${testCases.length}`);
}

runTests();
