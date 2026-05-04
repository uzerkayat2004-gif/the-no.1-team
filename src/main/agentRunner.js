// agentRunner.js
const { spawn, execSync } = require('child_process');
const { EventEmitter }    = require('events');
const os                   = require('os');
const path                 = require('path');
const { getAllProfiles, normalizeExecutionMode } = require('./providerProfiles');
const { loadProxySettings } = require('./proxySettings');

// Default workspace path — matches main.js
const DEFAULT_WORKSPACE = path.join(os.homedir(), 'no1team', 'workspace');

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
  'npm warn',
  'npm notice',
  'Downloading',
  'Installing',
  'Progress:',
  'reify:',
  'WARN',
];

// Stderr patterns that indicate real errors (not just warnings)
const FATAL_STDERR_PATTERNS = [
  'No active credentials for provider',
  'exhausted your capacity',
  'quota will reset',
  'ENOENT',
  'command not found',
  'is not recognized',
  'Cannot find module',
  'Authentication',
  'Unauthorized',
  'Invalid API',
  'failed to record rollout items',
];

class AgentRunner extends EventEmitter {

  constructor() {
    super();
    this.activeProcesses = {};
    this._geminiChecked = false;
    this._geminiAvailable = false;
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

  // Check if gemini binary is installed (cached after first check)
  _isGeminiInstalled() {
    if (this._geminiChecked) return this._geminiAvailable;
    this._geminiChecked = true;
    try {
      const cmd = process.platform === 'win32' ? 'where gemini.cmd' : 'which gemini';
      execSync(cmd, { stdio: 'ignore', timeout: 5000 });
      this._geminiAvailable = true;
    } catch {
      this._geminiAvailable = false;
      console.log('[AgentRunner] gemini binary not found, will use npx fallback');
    }
    return this._geminiAvailable;
  }

  // Resolve actual command and args for a provider (handles Gemini fallback)
  _resolveCommand(profile, args) {
    let command = profile.command;
    let finalArgs = args;

    // Gemini: fallback to npx if gemini binary not found
    if (profile.id === 'gemini' && profile.fallbackCommand && !this._isGeminiInstalled()) {
      command = profile.fallbackCommand;
      finalArgs = [...(profile.fallbackPrefix || []), ...args];
    }

    // Windows .cmd wrapper handling
    const isCmd = process.platform === 'win32' && command.endsWith('.cmd');
    if (isCmd) {
      const quotedCmd = this._quoteCommand([command, ...finalArgs]);
      return {
        command: process.env.ComSpec || 'cmd.exe',
        args: ['/d', '/c', quotedCmd],
      };
    }

    return { command, args: finalArgs };
  }

  // Log diagnostic info about the launch for debugging
  _logDiagnostic(agentId, profile, resolvedCmd, resolvedArgs, cwd, executionMode) {
    const pathSnippet = (process.env.PATH || '').split(path.delimiter).slice(0, 5).join(path.delimiter);
    console.log(`[AgentRunner] ─── Launch Diagnostic: ${profile.name} ───`);
    console.log(`  agentId:    ${agentId}`);
    console.log(`  mode:       ${executionMode}`);
    console.log(`  promptMode: ${profile.promptMode || 'stdin'}`);
    console.log(`  command:    ${resolvedCmd}`);
    console.log(`  args:       ${JSON.stringify(resolvedArgs).slice(0, 300)}`);
    console.log(`  cwd:        ${cwd}`);
    console.log(`  PATH (top5): ${pathSnippet}...`);
    console.log(`  timeout:    ${profile.startupTimeoutMs || 90000}ms`);
    console.log(`  outputFmt:  ${profile.outputFormat}`);
    console.log(`─────────────────────────────────────────`);
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

    // Build args — pass task to taskArgs for argument-mode providers
    const promptMode = profile.promptMode || 'stdin';
    let args;
    if (promptMode === 'argument') {
      // Codex and Gemini: task is built into the args by taskArgs()
      if (profile.taskArgs.length >= 3 && extraOptions.subagentModel) {
        args = profile.taskArgs(task, model || profile.defaultModel, extraOptions.subagentModel || profile.defaultSubagentModel);
      } else {
        args = profile.taskArgs(task, model || profile.defaultModel);
      }
    } else {
      // stdin mode (Claude): task NOT in args, will be written to stdin
      if (profile.taskArgs.length >= 3 && extraOptions.subagentModel) {
        args = profile.taskArgs(null, model || profile.defaultModel, extraOptions.subagentModel || profile.defaultSubagentModel);
      } else {
        args = profile.taskArgs(null, model || profile.defaultModel);
      }
    }

    // Resolve command (handles Gemini npx fallback + Windows .cmd wrapper)
    const resolved = this._resolveCommand(profile, args);

    // cwd: use workDir if provided, otherwise app workspace, never bare homedir
    const cwd = workDir || DEFAULT_WORKSPACE;

    let proc;
    try {
      // Log diagnostic
      this._logDiagnostic(agentId, profile, resolved.command, resolved.args, cwd, executionMode);

      proc = spawn(resolved.command, resolved.args, {
        cwd,
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

    // Write prompt to stdin only for stdin-mode providers (Claude)
    if (promptMode === 'stdin' && task) {
      proc.stdin.write(task);
    }
    proc.stdin.end();

    this._handleProcess(proc, profile.name, agentId, profile.outputFormat, sessionId, silent, profile);
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
    Object.entries(procs).forEach(([agentId, proc]) => {
      this._killProcessTree(proc, agentId);
    });
    delete this.activeProcesses[sessionId];
    this.emit('session-stopped', { sessionId });
  }

  // Stop one specific agent
  stopAgent(agentId, sessionId) {
    const procs = this.activeProcesses[sessionId];
    if (!procs || !procs[agentId]) return;
    this._killProcessTree(procs[agentId], agentId);
    delete procs[agentId];
    this.emit('agent-stopped', { agent: agentId, agentId, sessionId });
  }

  // Kill process tree — on Windows, taskkill /T /F kills the entire process tree
  // This fixes the issue where killing cmd.exe wrapper leaves the CLI child alive
  _killProcessTree(proc, agentId) {
    try {
      if (process.platform === 'win32' && proc.pid) {
        // taskkill /T /F /PID kills the entire process tree on Windows
        execSync(`taskkill /T /F /PID ${proc.pid}`, { stdio: 'ignore', timeout: 5000 });
      } else {
        proc.kill('SIGTERM');
      }
    } catch (e) {
      // Process may already be dead
      console.log(`[AgentRunner] Process cleanup for ${agentId}: ${e.message}`);
      try { proc.kill('SIGKILL'); } catch (_) {}
    }
  }

  _handleProcess(proc, agentName, agentId, outputFormat, sessionId, silent, profile) {
    let buffer = '';
    let stderrBuffer = '';
    let retryCount = 0;
    let resolved = false;
    let exitCode = null;

    // Per-provider startup timeout (default 90s, was 30s)
    const timeoutMs = profile?.startupTimeoutMs || 90000;
    const noOutputTimeout = setTimeout(() => {
      if (!resolved) {
        const modeHint = profile?.executionModes?.includes('proxy')
          ? ' If using proxy mode, check that 9Router is running.'
          : '';
        this.emit('agent-error', {
          agent: agentName,
          agentId,
          sessionId,
          error: `${agentName} did not produce any output within ${Math.round(timeoutMs / 1000)} seconds. Check that ${agentName} is installed and configured correctly.${modeHint}`,
          type: 'timeout',
        });
        this._killProcessTree(proc, agentId);
      }
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      resolved = true;
      clearTimeout(noOutputTimeout);
      buffer += data.toString();

      // For full-JSON output (wait for close to parse complete object)
      if (outputFormat === 'json') return;

      // JSONL and stream-json: process line by line
      const lines = buffer.split('\n');
      buffer = lines.pop();

      lines.forEach(line => {
        if (!line.trim()) return;
        let content = null;

        if (outputFormat === 'stream-json') {
          content = this._parseStreamJsonLine(line);
        } else if (outputFormat === 'jsonl') {
          content = this._parseJsonlLine(line);
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
      if (!text) return;
      stderrBuffer += text + '\n';

      // Filter known harmless warnings — do NOT show as errors in UI
      const isJustWarning = WARNINGS_TO_FILTER.some(w =>
        text.toLowerCase().includes(w.toLowerCase())
      );
      if (isJustWarning) {
        console.log(`[${agentName}] filtered warning:`, text.slice(0, 100));
        return;
      }

      // Handle Claude retry events on stderr
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
              this._killProcessTree(proc, agentId);
            }
            return;
          }
        } catch(e) {}
      }

      // Check for clearly fatal stderr patterns — emit immediately
      const isFatal = FATAL_STDERR_PATTERNS.some(p =>
        text.includes(p)
      );
      if (isFatal) {
        this.emit('agent-error', { agent: agentName, agentId, error: text, sessionId });
        return;
      }

      // Non-fatal stderr: log but don't show as UI error yet.
      // If the process exits non-zero, we'll emit stderr as error then.
      console.log(`[${agentName}] stderr (deferred):`, text.slice(0, 200));
    });

    proc.on('close', (code) => {
      exitCode = code;
      clearTimeout(noOutputTimeout);

      if (buffer.trim()) {
        let content = buffer.trim();
        if (outputFormat === 'json') {
          content = this._parseFullJson(content) || content;
        } else if (outputFormat === 'jsonl') {
          content = this._parseJsonlBatch(content) || content;
        }
        this.emit('agent-chunk', { agent: agentName, agentId, content, sessionId, silent });
      }

      // If non-zero exit AND there was deferred stderr, emit it now as error
      if (code !== 0 && stderrBuffer.trim()) {
        this.emit('agent-error', {
          agent: agentName,
          agentId,
          error: stderrBuffer.trim().slice(0, 500),
          sessionId,
          type: 'exit-error',
        });
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

  // ═══ Provider-specific parsers ═══

  // Claude stream-json: one JSON object per line
  _parseStreamJsonLine(line) {
    try {
      const parsed = JSON.parse(line);

      // assistant message — may contain multiple text blocks
      if (parsed.type === 'assistant' && parsed.message?.content) {
        const texts = [];
        parsed.message.content.forEach(block => {
          if (block.type === 'text' && block.text) texts.push(block.text);
        });
        return texts.join('\n') || null;
      }

      // final result
      if (parsed.type === 'result' && parsed.result) {
        return parsed.result;
      }

      // system/init messages — skip
      if (parsed.type === 'system') {
        return null;
      }

      // Unknown type — try to extract something useful
      if (parsed.text) return parsed.text;
      if (parsed.content) return typeof parsed.content === 'string' ? parsed.content : null;

      return null;
    } catch (e) {
      // Not valid JSON — return as plain text
      return line.trim() || null;
    }
  }

  // Codex JSONL: one JSON per line from --json output
  _parseJsonlLine(line) {
    try {
      const parsed = JSON.parse(line);
      return this._extractCodexContent(parsed);
    } catch (e) {
      return line.trim() || null;
    }
  }

  // Parse multiple JSONL lines (for remaining buffer at close)
  _parseJsonlBatch(content) {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    const results = [];
    for (const line of lines) {
      const text = this._parseJsonlLine(line);
      if (text) results.push(text);
    }
    return results.length ? results.join('\n') : null;
  }

  // Extract human-readable text from Codex JSON event
  _extractCodexContent(parsed) {
    if (!parsed) return null;
    if (typeof parsed === 'string') return parsed;

    // Codex JSONL event types
    if (parsed.response) return parsed.response;
    if (parsed.output) return parsed.output;
    if (parsed.result) return parsed.result;
    if (typeof parsed.message === 'string') return parsed.message;
    if (parsed.text) return parsed.text;

    // Codex item.completed event
    if (parsed.type === 'item.completed' && parsed.item) {
      return this._extractCodexContent(parsed.item);
    }
    // Codex message event with content array
    if (parsed.item?.type === 'message' && Array.isArray(parsed.item.content)) {
      return parsed.item.content.map(block => block.text || block.content || '').filter(Boolean).join('\n');
    }
    if (parsed.type === 'message' && Array.isArray(parsed.content)) {
      return parsed.content.map(block => block.text || block.content || '').filter(Boolean).join('\n');
    }

    // Error events
    if (parsed.type === 'error' && parsed.message) return `⚠️ ${parsed.message}`;
    if (parsed.type === 'turn.failed' && parsed.error?.message) return `⚠️ ${parsed.error.message}`;

    return null;
  }

  // Parse complete JSON object (Gemini --output-format json)
  _parseFullJson(content) {
    try {
      const parsed = JSON.parse(content);

      // Gemini JSON output — extract text
      if (parsed.response) return parsed.response;
      if (parsed.result) return parsed.result;
      if (parsed.output) return parsed.output;
      if (parsed.text) return parsed.text;
      if (typeof parsed.message === 'string') return parsed.message;

      // Array of results
      if (Array.isArray(parsed)) {
        return parsed.map(item => this._parseFullJson(JSON.stringify(item))).filter(Boolean).join('\n');
      }

      // Content blocks
      if (parsed.candidates && Array.isArray(parsed.candidates)) {
        return parsed.candidates.map(c =>
          c.content?.parts?.map(p => p.text || '').join('\n') || ''
        ).filter(Boolean).join('\n');
      }

      // Fallback: stringify
      return content;
    } catch (e) {
      // Try as JSONL
      return this._parseJsonlBatch(content);
    }
  }

  // ═══ Diagnostics ═══

  // Run a quick smoke test for a provider
  runDiagnostic(agentId, sessionId) {
    const prompts = {
      claude: 'Say exactly: READY FROM CLAUDE',
      codex:  'Say exactly: READY FROM CODEX',
      gemini: 'Say exactly: READY FROM GEMINI',
    };
    const prompt = prompts[agentId] || `Say exactly: READY FROM ${agentId.toUpperCase()}`;
    console.log(`[AgentRunner] Running diagnostic for ${agentId}...`);
    return this.runAgent(agentId, prompt, null, null, sessionId || `diag-${agentId}-${Date.now()}`, false);
  }

  // ═══ Helpers ═══

  _quoteCommand(parts) {
    return parts.map(part => {
      const value = String(part ?? '');
      return /[\s"&|<>^]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
    }).join(' ');
  }

  _trackProcess(proc, agentId, sessionId) {
    if (!this.activeProcesses[sessionId]) this.activeProcesses[sessionId] = {};
    this.activeProcesses[sessionId][agentId] = proc;
  }
}

module.exports = new AgentRunner();
