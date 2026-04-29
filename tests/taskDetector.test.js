const { describe, it } = require('node:test');
const assert = require('node:assert');
const { detectTaskType, stripSlashCommand, TASK_TYPES } = require('../src/main/taskDetector');

describe('taskDetector', () => {
  describe('detectTaskType', () => {
    it('should detect task type from valid slash command', () => {
      const result = detectTaskType('/quick Help me with this');
      assert.deepStrictEqual(result, { taskType: TASK_TYPES.quick, fromSlash: true });
    });

    it('should be case-insensitive for slash commands', () => {
      const result = detectTaskType('/QUICK Help me with this');
      assert.deepStrictEqual(result, { taskType: TASK_TYPES.quick, fromSlash: true });
    });

    it('should return fromKeywords fallback if slash command is not at the start', () => {
      const result = detectTaskType('Help me /quick do a quick search');
      assert.deepStrictEqual(result, { taskType: TASK_TYPES.quick, fromSlash: false });
    });

    it('should return fromKeywords fallback if slash command is invalid', () => {
      const result = detectTaskType('/invalidCommand Help me');
      assert.deepStrictEqual(result, { taskType: TASK_TYPES.general, fromSlash: false });
    });

    describe('detectFromKeywords fallbacks', () => {
      it('should detect quick research', () => {
        assert.deepStrictEqual(detectTaskType('I need quick research on X'), { taskType: TASK_TYPES.quick, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('fast research needed'), { taskType: TASK_TYPES.quick, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('do a quick search'), { taskType: TASK_TYPES.quick, fromSlash: false });
      });

      it('should detect deep research', () => {
        assert.deepStrictEqual(detectTaskType('I need deep research on X'), { taskType: TASK_TYPES.deep, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('thorough research please'), { taskType: TASK_TYPES.deep, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('full research'), { taskType: TASK_TYPES.deep, fromSlash: false });
      });

      it('should detect team coding', () => {
        assert.deepStrictEqual(detectTaskType('team code this'), { taskType: TASK_TYPES.teamcode, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('teamcode this'), { taskType: TASK_TYPES.teamcode, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('parallel code'), { taskType: TASK_TYPES.teamcode, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('all agents code'), { taskType: TASK_TYPES.teamcode, fromSlash: false });
      });

      it('should detect code review', () => {
        assert.deepStrictEqual(detectTaskType('review this code'), { taskType: TASK_TYPES.review, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('review my file'), { taskType: TASK_TYPES.review, fromSlash: false });
      });

      it('should detect debugging', () => {
        assert.deepStrictEqual(detectTaskType('debug this issue'), { taskType: TASK_TYPES.debug, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('fix this problem'), { taskType: TASK_TYPES.debug, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('i have an error'), { taskType: TASK_TYPES.debug, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('there is a bug'), { taskType: TASK_TYPES.debug, fromSlash: false });
      });

      it('should detect app testing', () => {
        assert.deepStrictEqual(detectTaskType('test my app'), { taskType: TASK_TYPES.apptest, fromSlash: false });
      });

      it('should detect unit testing', () => {
        assert.deepStrictEqual(detectTaskType('write test'), { taskType: TASK_TYPES.test, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('unit test this'), { taskType: TASK_TYPES.test, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('test this file'), { taskType: TASK_TYPES.test, fromSlash: false });
      });

      it('should detect planning', () => {
        assert.deepStrictEqual(detectTaskType('plan the architecture'), { taskType: TASK_TYPES.plan, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('architect this system'), { taskType: TASK_TYPES.plan, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('design system'), { taskType: TASK_TYPES.plan, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('plan structure'), { taskType: TASK_TYPES.plan, fromSlash: false });
      });

      it('should detect documentation', () => {
        assert.deepStrictEqual(detectTaskType('document this'), { taskType: TASK_TYPES.doc, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('write a readme'), { taskType: TASK_TYPES.doc, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('summarize file'), { taskType: TASK_TYPES.doc, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('convert file'), { taskType: TASK_TYPES.doc, fromSlash: false });
      });

      it('should detect brainstorming', () => {
        assert.deepStrictEqual(detectTaskType('lets brainstorm'), { taskType: TASK_TYPES.brainstorm, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('lets chat'), { taskType: TASK_TYPES.brainstorm, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('discuss this'), { taskType: TASK_TYPES.brainstorm, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('i have an idea'), { taskType: TASK_TYPES.brainstorm, fromSlash: false });
      });

      it('should detect coding', () => {
        assert.deepStrictEqual(detectTaskType('code this'), { taskType: TASK_TYPES.code, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('build an app'), { taskType: TASK_TYPES.code, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('create a component'), { taskType: TASK_TYPES.code, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('implement feature'), { taskType: TASK_TYPES.code, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('write some javascript'), { taskType: TASK_TYPES.code, fromSlash: false });
      });

      it('should detect research', () => {
        assert.deepStrictEqual(detectTaskType('research this topic'), { taskType: TASK_TYPES.research, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('find info about'), { taskType: TASK_TYPES.research, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('search for'), { taskType: TASK_TYPES.research, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('look up'), { taskType: TASK_TYPES.research, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('what is node.js'), { taskType: TASK_TYPES.research, fromSlash: false });
      });

      it('should fallback to general for unknown inputs', () => {
        assert.deepStrictEqual(detectTaskType('hello world'), { taskType: TASK_TYPES.general, fromSlash: false });
        assert.deepStrictEqual(detectTaskType('can you help me?'), { taskType: TASK_TYPES.general, fromSlash: false });
        assert.deepStrictEqual(detectTaskType(''), { taskType: TASK_TYPES.general, fromSlash: false });
      });
    });
  });

  describe('stripSlashCommand', () => {
    it('should strip valid slash command', () => {
      assert.strictEqual(stripSlashCommand('/quick Help me with this'), 'Help me with this');
    });

    it('should strip case-insensitive slash command', () => {
      assert.strictEqual(stripSlashCommand('/QUICK Help me with this'), 'Help me with this');
    });

    it('should strip slash command even if it is unknown', () => {
      assert.strictEqual(stripSlashCommand('/unknownCommand Help me with this'), 'Help me with this');
    });

    it('should strip slash command at the start', () => {
      assert.strictEqual(stripSlashCommand('/plan structure'), 'structure');
    });

    it('should leave strings without slash command intact', () => {
      assert.strictEqual(stripSlashCommand('Help me with this'), 'Help me with this');
    });

    it('should not strip slash command if not at the start', () => {
      assert.strictEqual(stripSlashCommand('Help me /quick'), 'Help me /quick');
    });

    it('should leave string intact if slash is alone', () => {
      assert.strictEqual(stripSlashCommand('/'), '/');
    });

    it('should handle empty string', () => {
      assert.strictEqual(stripSlashCommand(''), '');
    });
  });
});
