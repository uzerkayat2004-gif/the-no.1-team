// providerProfiles.js
// Defines how to spawn and communicate with each CLI provider

const os = require('os');
const isWindows = process.platform === 'win32';

// Returns only JSON-serializable fields safe to send over IPC to renderer
function serializeProfile(profile) {
  return {
    id:           profile.id,
    name:         profile.name,
    color:        profile.color,
    defaultModel: profile.defaultModel,
    models:       profile.models,
    capabilities: profile.capabilities,
    hasBrowser:   profile.hasBrowser,
    installGuide: profile.installGuide,
    bestAt:       profile.bestAt,
  }
}


const PROVIDER_PROFILES = {

  claude: {
    id: 'claude',
    name: 'Claude Code',
    color: '#E8742A',
    command: isWindows ? 'claude.cmd' : 'claude',
    taskArgs: (task, model) => {
      const args = ['-p', task, '--output-format', 'stream-json', '--verbose'];
      if (model) args.push('--model', model);
      return args;
    },
    defaultModel: 'claude-opus-4-6',
    models: [
      { value: 'claude-opus-4-6',           label: 'Claude Opus 4.6' },
      { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
      { value: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5' },
    ],
    outputFormat: 'stream-json',
    envVars: (proxySettings) => ({
      ANTHROPIC_BASE_URL: proxySettings.claudeBaseUrl,
      ANTHROPIC_API_KEY:  proxySettings.apiKey,
      CLAUDE_API_BASE:    proxySettings.claudeBaseUrl,
    }),
    capabilities: ['coding', 'research', 'debugging', 'planning', 'review', 'testing', 'brainstorm'],
    hasBrowser: true,
    installCheck: isWindows ? 'claude.cmd --version' : 'claude --version',
    installGuide: 'npm install -g @anthropic-ai/claude-code',
    bestAt: ['complex-logic', 'architecture', 'debugging', 'multi-file'],
  },

  codex: {
    id: 'codex',
    name: 'Codex',
    color: '#888888',
    command: isWindows ? 'codex.cmd' : 'codex',
    taskArgs: (task, model) => {
      const args = ['exec', task, '--json'];
      if (model) args.push('--model', model);
      return args;
    },
    defaultModel: 'gpt-5.2-codex',
    models: [
      { value: 'gpt-5.2-codex',     label: 'GPT-5.2 Codex' },
      { value: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max' },
      { value: 'gpt-4o',            label: 'GPT-4o' },
    ],
    outputFormat: 'json',
    envVars: (proxySettings) => ({
      OPENAI_BASE_URL:  proxySettings.openaiBaseUrl,
      OPENAI_API_KEY:   proxySettings.apiKey,
      OPENAI_API_BASE:  proxySettings.openaiBaseUrl,
    }),
    capabilities: ['coding', 'debugging', 'testing', 'brainstorm'],
    hasBrowser: false,
    installCheck: isWindows ? 'codex.cmd --version' : 'codex --version',
    installGuide: 'npm install -g @openai/codex',
    bestAt: ['feature-implementation', 'state-management', 'functions', 'tests'],
  },

  gemini: {
    id: 'gemini',
    name: 'Gemini CLI',
    color: '#4A90D9',
    command: isWindows ? 'gemini.cmd' : 'gemini',
    taskArgs: (task, model) => {
      const args = ['-p', task, '--output-format', 'json'];
      if (model) args.push('--model', model);
      return args;
    },
    defaultModel: 'gemini-2.5-pro',
    models: [
      { value: 'gemini-2.5-pro',          label: 'Gemini 2.5 Pro' },
      { value: 'gemini-3-flash-preview',   label: 'Gemini 3 Flash' },
      { value: 'gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash' },
    ],
    outputFormat: 'json',
    envVars: (proxySettings) => ({
      GEMINI_BASE_URL: proxySettings.geminiBaseUrl,
      GEMINI_API_KEY:  proxySettings.apiKey,
      GOOGLE_API_KEY:  proxySettings.apiKey,
    }),
    capabilities: ['research', 'coding', 'review', 'brainstorm', 'document'],
    hasBrowser: true,
    installCheck: isWindows ? 'gemini.cmd --version' : 'gemini --version',
    installGuide: 'npm install -g @google/gemini-cli',
    bestAt: ['ui-components', 'styling', 'large-context', 'documentation'],
  },

  aider: {
    id: 'aider',
    name: 'Aider',
    color: '#50C878',
    command: 'aider',
    taskArgs: (task, model) => {
      const args = ['--message', task, '--yes-always', '--no-pretty'];
      if (model) args.push('--model', model);
      return args;
    },
    defaultModel: 'claude-opus-4-6',
    models: [
      { value: 'claude-opus-4-6',    label: 'Claude Opus 4.6' },
      { value: 'gpt-4o',             label: 'GPT-4o' },
      { value: 'gemini/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    ],
    outputFormat: 'plain',
    envVars: (proxySettings) => ({
      ANTHROPIC_BASE_URL: proxySettings.claudeBaseUrl,
      ANTHROPIC_API_KEY:  proxySettings.apiKey,
      OPENAI_BASE_URL:    proxySettings.openaiBaseUrl,
      OPENAI_API_KEY:     proxySettings.apiKey,
    }),
    capabilities: ['coding', 'debugging', 'review'],
    hasBrowser: false,
    installCheck: 'aider --version',
    installGuide: 'pip install aider-chat',
    bestAt: ['git-based-editing', 'transparent-diffs', 'refactoring'],
  },

  opencode: {
    id: 'opencode',
    name: 'OpenCode',
    color: '#FF6B9D',
    command: isWindows ? 'opencode.cmd' : 'opencode',
    taskArgs: (task, model) => {
      const args = [task];
      if (model) args.push('--model', model);
      return args;
    },
    defaultModel: 'claude-opus-4-6',
    models: [
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
      { value: 'gpt-4o',          label: 'GPT-4o' },
      { value: 'deepseek-coder',  label: 'DeepSeek Coder' },
    ],
    outputFormat: 'plain',
    envVars: (proxySettings) => ({
      ANTHROPIC_BASE_URL: proxySettings.claudeBaseUrl,
      ANTHROPIC_API_KEY:  proxySettings.apiKey,
      OPENAI_BASE_URL:    proxySettings.openaiBaseUrl,
      OPENAI_API_KEY:     proxySettings.apiKey,
    }),
    capabilities: ['coding', 'debugging', 'research', 'brainstorm'],
    hasBrowser: false,
    installCheck: isWindows ? 'opencode.cmd --version' : 'opencode --version',
    installGuide: 'npm install -g opencode-ai',
    bestAt: ['model-flexibility', 'openrouter-support', 'customization'],
  },

};

// Custom providers added by user are stored separately and merged at runtime
function getAllProfiles(customProviders = []) {
  const all = { ...PROVIDER_PROFILES };
  customProviders.forEach(p => { all[p.id] = p; });
  return all;
}

// IPC-safe version — strips functions before sending to renderer
function getSerializableProfiles(customProviders = []) {
  const all = getAllProfiles(customProviders);
  const serialized = {};
  Object.entries(all).forEach(([id, profile]) => {
    serialized[id] = serializeProfile(profile);
  });
  return serialized;
}

module.exports = { PROVIDER_PROFILES, getAllProfiles, getSerializableProfiles };
