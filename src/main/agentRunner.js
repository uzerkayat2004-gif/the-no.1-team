// agentRunner.js
const { spawn }    = require('child_process');
const { EventEmitter } = require('events');
const os           = require('os');
const { getAllProfiles } = require('./providerProfiles');
const { loadProxySettings } = require('./proxySettings');

class AgentRunner extends EventEmitter {

  constructor() {
    super();
    this.activeProcesses = {};
  }

  // Build environment variables for a specific agent
  _buildEnv(agentId) {
    const settings  = loadProxySettings();
    const profiles  = getAllProfiles();
    const profile   = profiles[agentId];
    if (!profile) return { ...process.env };
    const agentEnv  = profile.envVars ? profile.envVars(settings) : {};
    return { ...process.env, ...agentEnv };
  }

  // Run any agent by ID
  runAgent(agentId, task, model, workDir, sessionId, silent = false) {
    const profiles = getAllProfiles();
    const profile  = profiles[agentId];

    if (!profile) {
      this.emit('agent-error', {
        agent: agentId,
        agentId,
        error: `Provider "${agentId}" not found in profiles.`,
        sessionId
      });
      return null;
    }

    const args = profile.taskArgs(task, model || profile.defaultModel);

    const proc = spawn(profile.command, args, {
      cwd:   workDir || os.homedir(),
      env:   this._buildEnv(agentId),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    this._handleProcess(proc, profile.name, agentId, profile.outputFormat, sessionId, silent);
    this._trackProcess(proc, agentId, sessionId);
    return proc;
  }

  // Send task to multiple agents in parallel
  broadcastTask({ task, workDir, agents, models, sessionId }) {
    agents.forEach(agentId => {
      this.runAgent(agentId, task, models[agentId], workDir, sessionId);
    });
  }

  // Send task to one specific agent
  sendToAgent({ task, workDir, agent, model, sessionId, silent }) {
    this.runAgent(agent, task, model, workDir, sessionId, silent);
  }

  // Stop all agents for a session
  stopSession(sessionId) {
    const procs = this.activeProcesses[sessionId];
    if (!procs) return;
    Object.values(procs).forEach(proc => {
      try { proc.kill('SIGTERM'); } catch(e) { console.error(`Failed to kill process for session ${sessionId}:`, e); }
    });
    delete this.activeProcesses[sessionId];
    this.emit('session-stopped', { sessionId });
  }

  // Stop one specific agent
  stopAgent(agentId, sessionId) {
    const procs = this.activeProcesses[sessionId];
    if (!procs || !procs[agentId]) return;
    try { procs[agentId].kill('SIGTERM'); } catch(e) { console.error(`Failed to kill agent ${agentId} for session ${sessionId}:`, e); }
    delete procs[agentId];
    this.emit('agent-stopped', { agent: agentId, agentId, sessionId });
  }

  _handleProcess(proc, agentName, agentId, outputFormat, sessionId, silent) {
    let buffer = '';

    proc.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      lines.forEach(line => {
        if (!line.trim()) return;
        let content = null;

        if (outputFormat === 'stream-json') {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'assistant' && parsed.message?.content) {
              parsed.message.content.forEach(block => {
                if (block.type === 'text' && block.text) content = block.text;
              });
            } else if (parsed.type === 'result' && parsed.result) {
              content = parsed.result;
            } else if (parsed.type === 'system') {
              return; // skip system/init messages
            }
          } catch(e) { content = line.trim(); }

        } else if (outputFormat === 'json') {
          try {
            const parsed = JSON.parse(line);
            if (typeof parsed === 'object') {
              content = parsed.response || parsed.output || (typeof parsed.message === 'string' ? parsed.message : null) || parsed.text || null;
              if (!content) content = line.trim();
            } else {
              content = line.trim();
            }
          } catch(e) { content = line.trim(); }

        } else {
          // plain text
          content = line.trim();
        }

        if (content && content.trim()) {
          this.emit('agent-chunk', { agent: agentName, agentId, content, sessionId, silent });
        }
      });
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        this.emit('agent-error', { agent: agentName, agentId, error: text, sessionId });
      }
    });

    proc.on('close', (code) => {
      if (buffer.trim()) {
        this.emit('agent-chunk', { agent: agentName, agentId, content: buffer.trim(), sessionId, silent });
      }
      this.emit('agent-done', { agent: agentName, agentId, exitCode: code, sessionId, silent });
    });

    proc.on('error', (err) => {
      let message = err.message;
      if (err.code === 'ENOENT') {
        message = `${agentName} is not installed or not found in PATH. Please install it first.`;
      }
      this.emit('agent-error', { agent: agentName, agentId, error: message, sessionId });
    });
  }

  _trackProcess(proc, agentId, sessionId) {
    if (!this.activeProcesses[sessionId]) this.activeProcesses[sessionId] = {};
    this.activeProcesses[sessionId][agentId] = proc;
  }
}

module.exports = new AgentRunner();
