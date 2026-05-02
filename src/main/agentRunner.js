// agentRunner.js
const { spawn }    = require('child_process');
const { EventEmitter } = require('events');
const os           = require('os');
const { getAllProfiles, normalizeExecutionMode } = require('./providerProfiles');
const { loadProxySettings } = require('./proxySettings');

// Stderr warnings to filter out — these are informational, not errors
const WARNINGS_TO_FILTER = [
  '256-color support not detected',
  'Ripgrep is not available',
  'Falling back to GrepTool',
  'Both GOOGLE_API_KEY and GEMINI_API_KEY are set',
  'Using GOOGLE_API_KEY',
  'Using GEMINI_API_KEY',
  'Warning:',
  'INFO:',
  'DEBUG:',
  'color support',
  'terminal with at least',
  'Debugger attached',
  'Waiting for the debugger',
];

class AgentRunner extends EventEmitter {

  constructor() {
    super();
    this.activeProcesses = {};
  }

  // Build environment variables for a specific agent
  _buildEnv(agentId, executionMode = 'native') {
    const profiles = getAllProfiles();
    const profile  = profiles[agentId];
    if (!profile) return { ...process.env };

    const mode = normalizeExecutionMode(agentId, executionMode);
    if (mode !== 'proxy') return { ...process.env };

    const settings = loadProxySettings();
    const agentEnv = profile.envVars ? profile.envVars(settings) : {};
    return { ...process.env, ...agentEnv };
  }

  // Run any agent by ID
  runAgent(agentId, task, model, workDir, sessionId, silent = false, extraOptions = {}) {
    const profiles = getAllProfiles();
    const profile  = profiles[agentId];
    const executionMode = normalizeExecutionMode(agentId, extraOptions.executionMode);

    if (!profile) {
      this.emit('agent-error', {
        agent: agentId,
        agentId,
        error: `Provider "${agentId}" not found in profiles.`,
        sessionId
      });
      return null;
    }

    // Build args — handle subagent model for Codex
    let args;
    if (profile.taskArgs.length >= 3 && extraOptions.subagentModel) {
      args = profile.taskArgs(task, model || profile.defaultModel, extraOptions.subagentModel || profile.defaultSubagentModel);
    } else {
      args = profile.taskArgs(task, model || profile.defaultModel);
    }

    let proc;
    const isCmd = process.platform === 'win32' && profile.command.endsWith('.cmd');
    const command = isCmd ? (process.env.ComSpec || 'cmd.exe') : profile.command;
    const commandArgs = isCmd
      ? ['/d', '/c', this._quoteCommand([profile.command, ...args])]
      : args;

    try {
      proc = spawn(command, commandArgs, {
        cwd:   workDir || os.homedir(),
        env:   this._buildEnv(agentId, executionMode),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      this.emit('agent-error', {
        agent: profile.name,
        agentId,
        error: err.message,
        sessionId
      });
      return null;
    }

    if (task) {
      proc.stdin.write(task);
    }
    proc.stdin.end();

    this._handleProcess(proc, profile.name, agentId, profile.outputFormat, sessionId, silent);
    this._trackProcess(proc, agentId, sessionId);
    return proc;
  }

  // Send task to multiple agents in parallel
  broadcastTask({ task, workDir, agents, models, subagentModels, executionModes, sessionId }) {
    agents.forEach(agentId => {
      this.runAgent(agentId, task, models[agentId], workDir, sessionId, false, {
        subagentModel: subagentModels?.[agentId],
        executionMode: executionModes?.[agentId],
      });
    });
  }

  // Send task to one specific agent
  sendToAgent({ task, workDir, agent, model, subagentModel, executionMode, sessionId, silent }) {
    return this.runAgent(agent, task, model, workDir, sessionId, silent, { subagentModel, executionMode });
  }

  // Stop all agents for a session
  stopSession(sessionId) {
    const procs = this.activeProcesses[sessionId];
    if (!procs) return;
    Object.values(procs).forEach(proc => {
      try { proc.kill('SIGTERM'); } catch(e) { console.error('Failed to kill agent process:', e); }
    });
    delete this.activeProcesses[sessionId];
    this.emit('session-stopped', { sessionId });
  }

  // Stop one specific agent
  stopAgent(agentId, sessionId) {
    const procs = this.activeProcesses[sessionId];
    if (!procs || !procs[agentId]) return;
    try { procs[agentId].kill('SIGTERM'); } catch(e) { console.error('Failed to kill agent process:', e); }
    delete procs[agentId];
    this.emit('agent-stopped', { agent: agentId, agentId, sessionId });
  }

  _handleProcess(proc, agentName, agentId, outputFormat, sessionId, silent) {
    let buffer = '';
    let retryCount = 0;
    let resolved = false;
    const noOutputTimeout = setTimeout(() => {
      if (!resolved) {
        this.emit('agent-error', {
          agent: agentName,
          agentId,
          sessionId,
          error: `${agentName} did not produce any output within 30 seconds. Check that 9Router is running and the model is correctly configured.`,
          type: 'timeout',
        });
        proc.kill('SIGTERM');
      }
    }, 30000);

    proc.stdout.on('data', (data) => {
      resolved = true;
      clearTimeout(noOutputTimeout);
      buffer += data.toString();

      // For JSON output (e.g. Codex), wait for process close to parse all at once
      if (outputFormat === 'json') return;

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

        } else {
          // plain text (Gemini CLI, Aider, OpenCode, etc.)
          content = line.trim();
        }

        if (content && content.trim()) {
          this.emit('agent-chunk', { agent: agentName, agentId, content, sessionId, silent });
        }
      });
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (!text) return;

      // Filter known harmless warnings — do NOT show as errors in UI
      const isJustWarning = WARNINGS_TO_FILTER.some(w =>
        text.toLowerCase().includes(w.toLowerCase())
      );
      if (isJustWarning) {
        console.log(`[${agentName}] filtered warning:`, text.slice(0, 100));
        return;
      }

      if (text.includes('"subtype":"api_retry"')) {
        try {
          const parsed = JSON.parse(text);
          if (parsed?.type === 'system' && parsed?.subtype === 'api_retry') {
            retryCount++;
            if (retryCount >= 5) {
              this.emit('agent-error', {
                agent: agentName,
                agentId,
                sessionId,
                error: `Cannot reach the AI proxy at localhost:20128 after ${retryCount} attempts. Please make sure 9Router is running, then try again.`,
                type: 'proxy-unreachable',
              });
              proc.kill('SIGTERM');
            }
            return;
          }
        } catch(e) {}
      }

      // Detect credential/provider errors specifically
      if (text.includes('No active credentials for provider')) {
        const providerMatch = text.match(/provider:\s*(\w+)/i);
        const providerName = providerMatch ? providerMatch[1] : 'unknown';
        this.emit('agent-error', {
          agent: agentName, agentId, sessionId,
          error: `No credentials configured for provider "${providerName}" in your proxy (9Router). Go to Settings → Proxy to configure, or use /model to change the model for ${agentName}.`,
          type: 'credentials',
        });
        return;
      }

      if (text.includes('exhausted your capacity') || text.includes('quota will reset')) {
        this.emit('agent-error', {
          agent: agentName,
          agentId,
          sessionId,
          error: `${agentName} quota is temporarily exhausted. ${text}`,
          type: 'quota',
        });
        proc.kill('SIGTERM');
        return;
      }

      // Detect Codex thread/session not found errors
      if (text.includes('failed to record rollout items') ||
          (text.includes('thread') && text.includes('not found'))) {
        this.emit('agent-error', {
          agent: agentName, agentId, sessionId,
          error: `${agentName} session error — model session expired or not found. Try using /model to switch models.`,
          type: 'session',
        });
        return;
      }

      // Generic error — emit to UI
      this.emit('agent-error', { agent: agentName, agentId, error: text, sessionId });
    });

    proc.on('close', (code) => {
      clearTimeout(noOutputTimeout);
      if (buffer.trim()) {
        let content = buffer.trim();
        if (outputFormat === 'json') {
          content = this._extractJsonLines(content) || content;
        }
        this.emit('agent-chunk', { agent: agentName, agentId, content, sessionId, silent });
      }
      this.emit('agent-done', { agent: agentName, agentId, exitCode: code, sessionId, silent });
      if (this.activeProcesses[sessionId]?.[agentId] === proc) {
        delete this.activeProcesses[sessionId][agentId];
      }
    });

    proc.on('error', (err) => {
      clearTimeout(noOutputTimeout);
      let message = err.message;
      if (err.code === 'ENOENT') {
        message = `${agentName} is not installed or not found in PATH. Please install it first.`;
      }
      this.emit('agent-error', { agent: agentName, agentId, error: message, sessionId });
      this.emit('agent-done', { agent: agentName, agentId, exitCode: 1, sessionId, silent });
    });
  }

  _quoteCommand(parts) {
    return parts.map(part => {
      const value = String(part ?? '');
      return /[\s"&|<>^]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
    }).join(' ');
  }

  _extractJsonLines(content) {
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
    if (!lines.length) return null;

    const extracted = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const text = this._extractJsonContent(parsed);
        if (text) extracted.push(text);
      } catch(e) {
        try {
          return this._extractJsonContent(JSON.parse(content));
        } catch(e2) {
          return content; // not JSON at all, return as-is
        }
      }
    }
    return extracted.filter((value, index, arr) => arr.indexOf(value) === index).join('\n');
  }

  _extractJsonContent(parsed) {
    if (!parsed) return null;
    if (typeof parsed === 'string') return parsed;
    if (Array.isArray(parsed)) {
      return parsed.map(item => this._extractJsonContent(item)).filter(Boolean).join('\n');
    }
    if (parsed.response) return parsed.response;
    if (parsed.output) return parsed.output;
    if (parsed.result) return parsed.result;
    if (typeof parsed.message === 'string') return parsed.message;
    if (parsed.text) return parsed.text;
    if (parsed.item?.type === 'message' && Array.isArray(parsed.item.content)) {
      return parsed.item.content.map(block => block.text || block.content || '').filter(Boolean).join('\n');
    }
    if (parsed.type === 'message' && Array.isArray(parsed.content)) {
      return parsed.content.map(block => block.text || block.content || '').filter(Boolean).join('\n');
    }
    if (parsed.type === 'error' && parsed.message) return `⚠️ ${parsed.message}`;
    if (parsed.type === 'item.completed' && parsed.item) {
      return this._extractJsonContent(parsed.item);
    }
    if (parsed.type === 'turn.failed' && parsed.error?.message) return `⚠️ ${parsed.error.message}`;
    return null;
  }

  _trackProcess(proc, agentId, sessionId) {
    if (!this.activeProcesses[sessionId]) this.activeProcesses[sessionId] = {};
    this.activeProcesses[sessionId][agentId] = proc;
  }
}

module.exports = new AgentRunner();
