// brainstormChat.js — Free-form group chat between Boss and agents

const { EventEmitter } = require('events');
const agentRunner = require('./agentRunner');
const { injectSkill } = require('./skillBuilder');
const { getAllProfiles, normalizeExecutionMode, getProfileForMode } = require('./providerProfiles');
const sessionCtx = require('./sessionContext');

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

    this.chatHistory[sessionId].push({ sender: fromAgent || 'BOSS', content: message, timestamp: new Date().toISOString() });

    const historyStr = this.chatHistory[sessionId].map(h => `[${h.sender}]: ${h.content}`).join('\n');
    let respondingAgents = targetAgents && targetAgents.length > 0 ? targetAgents : (allAgents || []);

    const promises = respondingAgents.map(agentId => {
      const executionMode = normalizeExecutionMode(agentId, executionModes?.[agentId] || context?.executionModes?.[agentId]);
      const profile = getProfileForMode(agentId, executionMode) || profiles[agentId];
      if (!profile) return Promise.resolve();
      const prompt = injectSkill(profile.name, 'brainstorm',
        `CONVERSATION HISTORY (entire session):\n${historyStr}\n\n` +
        (targetAgents?.includes(agentId) ? 'You were specifically addressed. Respond directly.' : 'New message from BOSS. Add your perspective if valuable.') +
        '\nRespond naturally as a team member. Keep it conversational.',
        { ...context, sessionId }, profile);

      return new Promise((resolve) => {
        let response = '';
        const onChunk = (data) => { if (data.sessionId === sessionId && data.agentId === agentId) response += data.content; };
        const onDone = (data) => {
          if (data.sessionId === sessionId && data.agentId === agentId) {
            agentRunner.removeListener('agent-chunk', onChunk);
            agentRunner.removeListener('agent-done', onDone);
            this.chatHistory[sessionId].push({ sender: profile.name, content: response.trim(), timestamp: new Date().toISOString() });
            resolve({ agentId, agentName: profile.name, content: response.trim() });
          }
        };
        agentRunner.on('agent-chunk', onChunk);
        agentRunner.on('agent-done', onDone);
        agentRunner.sendToAgent({ task: prompt, workDir: context?.workDir, agent: agentId, model: models?.[agentId] || profile.defaultModel, executionMode, sessionId });
      });
    });
    await Promise.all(promises);
  }

  parseMentions(message, profiles) {
    const mentions = [];
    Object.values(profiles).forEach(profile => {
      const nameClean = profile.name.replace(/\s+/g, '');
      if (new RegExp(`@${nameClean}|@${profile.id}`, 'gi').test(message)) mentions.push(profile.id);
    });
    return mentions;
  }

  getHistory(sessionId) { return this.chatHistory[sessionId] || []; }
}

module.exports = new BrainstormChat();
