// brainstormChat.js — Free-form group chat between Boss and agents

const { EventEmitter } = require('events');
const agentRunner = require('./agentRunner');
const { injectSkill } = require('./skillBuilder');
const { getAllProfiles, normalizeExecutionMode, getProfileForMode } = require('./providerProfiles');
const sessionCtx = require('./sessionContext');

const MAX_HISTORY_MESSAGES = 30; // keep last N messages to avoid context overflow
const MIN_HISTORY_FOR_TRIM = 40; // only trim when history exceeds this

class BrainstormChat extends EventEmitter {
  constructor() {
    super();
    this.activeSessions = new Set();
    this.chatHistory = {};
  }

  activate(sessionId) {
    this.activeSessions.add(sessionId);
    this.chatHistory[sessionId] = [];
    this.emit('activated', { sessionId });
  }

  deactivate(sessionId) { this.activeSessions.delete(sessionId); }
  isActive(sessionId) { return this.activeSessions.has(sessionId); }

  async handleMessage({ sessionId, message, fromAgent, targetAgents, allAgents, models, executionModes }) {
    if (!this.isActive(sessionId)) return;
    const profiles = getAllProfiles();
    const context = sessionCtx.getSession(sessionId);

    this.chatHistory[sessionId].push({
      sender: fromAgent || 'BOSS',
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Trim history if it's grown too long to prevent context overflow
    if (this.chatHistory[sessionId].length > MIN_HISTORY_FOR_TRIM) {
      // Keep the first 2 messages (original task context) + last MAX_HISTORY_MESSAGES
      const head = this.chatHistory[sessionId].slice(0, 2);
      const tail = this.chatHistory[sessionId].slice(-MAX_HISTORY_MESSAGES);
      this.chatHistory[sessionId] = [...head, { sender: 'System', content: '[... earlier messages trimmed for context ...]', timestamp: '' }, ...tail];
    }

    const historyStr = this.chatHistory[sessionId]
      .map(h => `[${h.sender}]: ${h.content}`)
      .join('\n');

    // Determine which agents should respond
    let respondingAgents = this._resolveRespondingAgents(
      message, targetAgents, allAgents || [], profiles, context
    );

    const promises = respondingAgents.map(agentId => {
      const executionMode = normalizeExecutionMode(agentId, executionModes?.[agentId] || context?.executionModes?.[agentId]);
      const profile = getProfileForMode(agentId, executionMode) || profiles[agentId];
      if (!profile) return Promise.resolve();

      const isDirectlyAddressed = targetAgents?.includes(agentId);
      const prompt = injectSkill(profile.name, 'brainstorm',
        `CONVERSATION HISTORY:\n${historyStr}\n\n` +
        (isDirectlyAddressed
          ? `You were directly addressed by name. Respond directly and specifically to what was asked of you.`
          : `A new message arrived. Respond only if you have something genuinely valuable to add — don't repeat what others said.`
        ) +
        `\n\nKeep your reply conversational and concise (under 150 words unless asked for detail).`,
        { ...context, sessionId }, profile);

      return new Promise((resolve) => {
        let response = '';
        const onChunk = (data) => {
          if (data.sessionId === sessionId && data.agentId === agentId) response += data.content;
        };
        const onDone = (data) => {
          if (data.sessionId === sessionId && data.agentId === agentId) {
            agentRunner.removeListener('agent-chunk', onChunk);
            agentRunner.removeListener('agent-done', onDone);
            const trimmed = response.trim();
            this.chatHistory[sessionId].push({
              sender: profile.name,
              content: trimmed,
              timestamp: new Date().toISOString(),
            });
            resolve({ agentId, agentName: profile.name, content: trimmed });
          }
        };
        agentRunner.on('agent-chunk', onChunk);
        agentRunner.on('agent-done', onDone);
        agentRunner.sendToAgent({
          task: prompt, workDir: context?.workDir, agent: agentId,
          model: models?.[agentId] || profile.defaultModel, executionMode, sessionId,
        });
      });
    });
    await Promise.all(promises);
  }

  // Smarter agent targeting: when no @mention, pick the best 1-2 agents instead of blasting all
  _resolveRespondingAgents(message, targetAgents, allAgents, profiles, context) {
    // Explicit @mentions always win
    if (targetAgents && targetAgents.length > 0) return targetAgents;

    // If only 1 or 2 agents available, respond with all
    if (allAgents.length <= 2) return allAgents;

    const msg = message.toLowerCase();
    const seniorAgent = context?.seniorAgent;

    // Code/debug questions → prefer claude/codex
    if (/\b(code|function|class|bug|error|implement|build|write|refactor|debug|test|file|syntax)\b/.test(msg)) {
      const codeAgents = allAgents.filter(id => id === 'claude' || id === 'codex');
      if (codeAgents.length > 0) return codeAgents.slice(0, 2);
    }

    // Research/factual questions → prefer gemini/claude
    if (/\b(research|find|search|what is|what are|how does|explain|latest|current|look up)\b/.test(msg)) {
      const researchAgents = allAgents.filter(id => id === 'gemini' || id === 'claude');
      if (researchAgents.length > 0) return researchAgents.slice(0, 2);
    }

    // Questions directed at the team as a whole → all agents
    if (/\b(everyone|all of you|team|what do you all|thoughts?|opinions?)\b/.test(msg)) {
      return allAgents;
    }

    // Short messages (< 30 chars) — all agents respond so nothing is missed
    if (message.length < 30) return allAgents;

    // Default: senior agent + one other (most relevant based on message content)
    if (seniorAgent && allAgents.includes(seniorAgent)) {
      const others = allAgents.filter(id => id !== seniorAgent);
      return others.length > 0 ? [seniorAgent, others[0]] : [seniorAgent];
    }

    // Fallback: first two agents
    return allAgents.slice(0, 2);
  }

  // Enhanced mention parsing — handles @FirstName, @FullName, @agentId, partial matches
  parseMentions(message, profiles) {
    const mentions = [];
    const msgLower = message.toLowerCase();
    Object.values(profiles).forEach(profile => {
      const nameClean = profile.name.replace(/\s+/g, '').toLowerCase();
      const firstName = profile.name.split(/\s+/)[0].toLowerCase();
      // Match @FullName (no spaces), @firstname, @agentId
      const patterns = [
        new RegExp(`@${nameClean}`, 'i'),
        new RegExp(`@${firstName}\\b`, 'i'),
        new RegExp(`@${profile.id}\\b`, 'i'),
      ];
      if (patterns.some(p => p.test(message))) {
        if (!mentions.includes(profile.id)) mentions.push(profile.id);
      }
    });
    return mentions;
  }

  getHistory(sessionId) { return this.chatHistory[sessionId] || []; }
}

module.exports = new BrainstormChat();
