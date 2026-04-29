// errorHandler.js — Centralized error detection and recovery system

const { EventEmitter } = require('events');
const brainMemory = require('./brainMemory');

class ErrorHandler extends EventEmitter {
  constructor() { super(); this.timeouts = {}; }

  getTimeout(taskType) {
    const limits = { quick: 3*60000, research: 8*60000, deep: 20*60000, code: 30*60000,
      teamcode: 45*60000, review: 15*60000, debug: 15*60000, plan: 10*60000,
      test: 20*60000, apptest: 20*60000, doc: 10*60000, brainstorm: 60*60000 };
    return limits[taskType] || 15*60000;
  }

  startTimeout(agentId, sessionId, taskType) {
    const key = `${sessionId}-${agentId}`;
    const ms = this.getTimeout(taskType);
    this.timeouts[key] = setTimeout(() => {
      this.emit('agent-timeout', { agentId, sessionId, taskType,
        message: `${agentId} running for ${Math.round(ms/60000)} min with no response.`,
        buttons: ['Wait Longer', 'Stop & Retry', 'Skip This Agent'] });
      brainMemory.logError(agentId, `Timeout after ${Math.round(ms/60000)}min on ${taskType}`);
    }, ms);
  }

  clearTimeout(agentId, sessionId) {
    const key = `${sessionId}-${agentId}`;
    if (this.timeouts[key]) { clearTimeout(this.timeouts[key]); delete this.timeouts[key]; }
  }

  clearAllTimeouts(sessionId) {
    Object.keys(this.timeouts).forEach(k => {
      if (k.startsWith(sessionId)) { clearTimeout(this.timeouts[k]); delete this.timeouts[k]; }
    });
  }

  isProxyError(e) {
    const l = e.toLowerCase();
    return ['401','403','unauthorized','proxy','connection refused','econnrefused','econnreset','network','timeout'].some(w => l.includes(w));
  }

  isNotInstalledError(e) {
    const l = e.toLowerCase();
    return l.includes('enoent') || l.includes('not found') || l.includes('not installed');
  }

  isGarbageResponse(content, taskType) {
    if (!content || content.trim().length === 0) return true;
    if (content.trim().length < 20 && !['quick','brainstorm'].includes(taskType)) return true;
    return false;
  }

  handleAgentError({ agentId, agentName, error, sessionId, taskType }) {
    brainMemory.logError(agentId, error);
    if (this.isNotInstalledError(error)) {
      this.emit('error-display', { sessionId, type: 'not-installed', agent: agentName,
        message: `⚠️ ${agentName} is not installed`,
        description: `${agentName} could not be found. Install it and make sure it works in your terminal.`,
        buttons: ['Skip This Agent', 'Open Install Guide'] }); return;
    }
    if (this.isProxyError(error)) {
      this.emit('error-display', { sessionId, type: 'proxy-error', agent: agentName,
        message: '🔴 Proxy connection issue',
        description: `${agentName} could not connect to your proxy. Make sure 9Router is running.`,
        buttons: ['Check Proxy & Retry', 'Skip This Agent', 'Save & Exit'] }); return;
    }
    this.emit('error-display', { sessionId, type: 'agent-error', agent: agentName,
      message: `⚠️ ${agentName} encountered an error`, description: error.slice(0, 200),
      buttons: ['Retry Agent', 'Continue Without', 'Cancel Session'] });
  }

  handleAllAgentsFailed(sessionId) {
    this.emit('error-display', { sessionId, type: 'all-failed', message: '🔴 All agents failed',
      description: 'Possible reasons:\n• Proxy (9Router) not running\n• Internet issue\n• CLI tools need updating',
      buttons: ['Retry All Agents', 'Check Proxy Settings', 'Save & Exit'] });
  }

  handleGarbageResponse(agentId, agentName, sessionId) {
    this.emit('error-display', { sessionId, type: 'garbage-response', agent: agentName,
      message: `⚠️ ${agentName} response looks incomplete`,
      description: 'The response was unusually short or empty for this task.',
      buttons: ['Show Anyway', 'Retry Agent', 'Skip Agent'] });
  }
}

module.exports = new ErrorHandler();
