// providerProfiles.js
// Defines how to spawn and communicate with each CLI provider

const os = require('os');
const isWindows = process.platform === 'win32';

// Returns only JSON-serializable fields safe to send over IPC to renderer
function serializeProfile(profile) {
  return {
    id:                   profile.id,
    name:                 profile.name,
    color:                profile.color,
    defaultModel:         profile.defaultModel,
    models:               profile.models,
    defaultSubagentModel: profile.defaultSubagentModel || null,
    subagentModels:       profile.subagentModels || null,
    proxyModels:          profile.proxyModels || null,
    defaultProxyModel:    profile.defaultProxyModel || null,
    capabilities:         profile.capabilities,
    hasBrowser:           profile.hasBrowser,
    installGuide:         profile.installGuide,
    researchCapabilities: profile.researchCapabilities,
    executionModes:       profile.executionModes || ['native'],
    defaultExecutionMode: profile.defaultExecutionMode || 'native',
    modeCapabilities:     profile.modeCapabilities || {},
    bestAt:               profile.bestAt,
  }
}


const PROVIDER_PROFILES = {

  claude: {
    id: 'claude',
    name: 'Claude Code',
    color: '#F07830',
    command: isWindows ? 'claude.cmd' : 'claude',
    taskArgs: (task, model) => {
      const args = ['-p', '-', '--output-format', 'stream-json', '--verbose'];
      if (model) args.push('--model', model);
      return args;
    },
    defaultModel: 'opus',
    executionModes: ['native', 'proxy'],
    defaultExecutionMode: 'native',
    modeCapabilities: {
      native: { webSearch: 'native', appResearchTool: false },
      proxy:  { webSearch: 'unknown', appResearchTool: false },
    },
    // Real Claude Code models — aliases and specific versions
    models: [
      // Aliases (auto-resolve to latest version)
      { value: 'opus',       label: 'Claude Opus (Latest)',        group: 'alias' },
      { value: 'sonnet',     label: 'Claude Sonnet (Latest)',      group: 'alias' },
      { value: 'haiku',      label: 'Claude Haiku (Latest)',       group: 'alias' },
      { value: 'best',       label: 'Best Available',              group: 'alias' },
      { value: 'default',    label: 'CLI Default',                 group: 'alias' },
      { value: 'opusplan',   label: 'Opus Plan (Opus + Sonnet)',   group: 'alias' },
      // Specific versions
      { value: 'claude-opus-4-7',            label: 'Claude Opus 4.7',   group: 'opus' },
      { value: 'claude-opus-4-6',            label: 'Claude Opus 4.6',   group: 'opus' },
      { value: 'claude-opus-4-5-20251101',   label: 'Claude Opus 4.5',   group: 'opus' },
      { value: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6', group: 'sonnet' },
      { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', group: 'sonnet' },
      { value: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',  group: 'haiku' },
    ],
    // Proxy model slots — when user selects "Proxy" mode, these 3 slots can be configured
    // Each slot maps to a real model on the proxy side
    proxyModels: [
      { slot: 'opus',   label: 'Proxy Opus Slot',   description: 'What model your proxy maps Claude Opus to' },
      { slot: 'sonnet', label: 'Proxy Sonnet Slot',  description: 'What model your proxy maps Claude Sonnet to' },
      { slot: 'haiku',  label: 'Proxy Haiku Slot',   description: 'What model your proxy maps Claude Haiku to' },
    ],
    outputFormat: 'stream-json',
    envVars: (proxySettings) => ({
      ANTHROPIC_BASE_URL: proxySettings.claudeBaseUrl || 'http://localhost:20128',
      ANTHROPIC_API_KEY:  proxySettings.apiKey || 'dummy',
      CLAUDE_API_BASE:    proxySettings.claudeBaseUrl || 'http://localhost:20128',
    }),
    capabilities: ['coding', 'research', 'debugging', 'planning', 'review', 'testing', 'brainstorm'],
    researchCapabilities: { webSearch: 'unknown', citations: 'required', currentFactsSafe: false, noWebAccessContract: true },
    hasBrowser: true,
    installCheck: isWindows ? 'claude.cmd --version' : 'claude --version',
    installGuide: 'npm install -g @anthropic-ai/claude-code',
    bestAt: ['complex-logic', 'architecture', 'debugging', 'multi-file'],
  },

  codex: {
    id: 'codex',
    name: 'Codex',
    color: '#9B9BA8',
    command: isWindows ? 'codex.cmd' : 'codex',
    taskArgs: (task, model) => {
      const args = ['exec', '-'];
      if (model) args.push('--model', model);
      return args;
    },
    defaultModel: 'gpt-5.5',
    executionModes: ['native', 'proxy'],
    defaultExecutionMode: 'native',
    modeCapabilities: {
      native: { webSearch: 'unknown', appResearchTool: false },
      proxy:  { webSearch: 'unknown', appResearchTool: false },
    },
    defaultSubagentModel: 'gpt-5.4-mini',
    defaultProxyModel: 'gpt-5.5',
    // Main model — primary reasoning model
    models: [
      { value: 'gpt-5.5',           label: 'GPT-5.5 (Latest)',         type: 'main' },
      { value: 'gpt-5.4',           label: 'GPT-5.4 (Stable)',         type: 'main' },
      { value: 'gpt-5.4-mini',      label: 'GPT-5.4 Mini (Fast)',      type: 'main' },
      { value: 'gpt-5.3-codex',     label: 'GPT-5.3 Codex (Complex)',  type: 'main' },
      { value: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max (Long)', type: 'main' },
    ],
    // Subagent model — lighter model for subtasks
    subagentModels: [
      { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini (Fast)',     type: 'subagent' },
      { value: 'gpt-5.5',      label: 'GPT-5.5 (Same as main)',   type: 'subagent' },
      { value: 'gpt-5.4',      label: 'GPT-5.4 (Balanced)',       type: 'subagent' },
    ],
    // Proxy model — what model the proxy routes Codex requests to
    proxyModels: [
      { slot: 'main', label: 'Proxy Model', description: 'What model your proxy maps Codex requests to' },
    ],
    outputFormat: 'json',
    envVars: (proxySettings) => ({
      OPENAI_BASE_URL:  proxySettings.openaiBaseUrl || 'http://localhost:20128/v1',
      OPENAI_API_KEY:   proxySettings.apiKey || 'dummy',
      OPENAI_API_BASE:  proxySettings.openaiBaseUrl || 'http://localhost:20128/v1',
    }),
    capabilities: ['coding', 'debugging', 'testing', 'brainstorm'],
    researchCapabilities: { webSearch: 'unknown', citations: 'best-effort', currentFactsSafe: false, noWebAccessContract: true },
    hasBrowser: false,
    installCheck: isWindows ? 'codex.cmd --version' : 'codex --version',
    installGuide: 'npm install -g @openai/codex',
    bestAt: ['feature-implementation', 'state-management', 'functions', 'tests'],
  },

  gemini: {
    id: 'gemini',
    name: 'Gemini CLI',
    color: '#5B9CF6',
    command: isWindows ? 'npx.cmd' : 'npx',
    taskArgs: (task, model) => {
      const args = ['-y', '@google/gemini-cli', '-p', '-'];
      if (model && model !== 'auto') {
        args.push('--model', model);
      }
      return args;
    },
    defaultModel: 'auto',
    executionModes: ['native'],
    defaultExecutionMode: 'native',
    modeCapabilities: {
      native: { webSearch: 'native', appResearchTool: false },
    },
    models: [
      { value: 'auto',                    label: 'Auto-Route (Flash/Pro based on task)' },
      { value: 'gemini-2.5-pro',          label: 'Gemini 2.5 Pro (Complex tasks)'       },
      { value: 'gemini-2.5-flash',        label: 'Gemini 2.5 Flash (Price-performance)' },
      { value: 'gemini-2.5-flash-lite',   label: 'Gemini 2.5 Flash-Lite (Budget)'       },
      { value: 'gemini-3.1-pro-preview',  label: 'Gemini 3.1 Pro Preview (Latest)'      },
      { value: 'gemini-3.1-flash-lite',   label: 'Gemini 3.1 Flash-Lite (Latest lite)'  },
    ],
    // No proxy for Gemini
    proxyModels: null,
    outputFormat: 'plain',
    envVars: () => ({}),
    capabilities: ['research', 'coding', 'review', 'brainstorm', 'document'],
    researchCapabilities: { webSearch: 'unknown', citations: 'required', currentFactsSafe: false, noWebAccessContract: true },
    hasBrowser: true,
    installCheck: isWindows ? 'npx.cmd -y @google/gemini-cli --version' : 'npx -y @google/gemini-cli --version',
    installGuide: 'npm install -g @google/gemini-cli',
    bestAt: ['ui-components', 'styling', 'large-context', 'documentation', 'deep-research'],
  },

  aider: {
    id: 'aider',
    name: 'Aider',
    color: '#50C878',
    command: 'aider',
    taskArgs: (task, model) => {
      const args = ['--yes-always', '--no-pretty'];
      if (model) args.push('--model', model);
      return args;
    },
    defaultModel: 'claude-opus-4-6',
    executionModes: ['native', 'proxy'],
    defaultExecutionMode: 'native',
    modeCapabilities: {
      native: { webSearch: 'none', appResearchTool: false },
      proxy:  { webSearch: 'none', appResearchTool: false },
    },
    models: [
      { value: 'claude-opus-4-6',       label: 'Claude Opus 4.6' },
      { value: 'gpt-4o',                label: 'GPT-4o' },
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
    researchCapabilities: { webSearch: 'none', citations: 'none', currentFactsSafe: false, noWebAccessContract: true },
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
      const args = [];
      if (model) args.push('--model', model);
      return args;
    },
    defaultModel: 'claude-opus-4-6',
    executionModes: ['native', 'proxy'],
    defaultExecutionMode: 'native',
    modeCapabilities: {
      native: { webSearch: 'unknown', appResearchTool: false },
      proxy:  { webSearch: 'unknown', appResearchTool: false },
    },
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
    researchCapabilities: { webSearch: 'unknown', citations: 'best-effort', currentFactsSafe: false, noWebAccessContract: true },
    hasBrowser: false,
    installCheck: isWindows ? 'opencode.cmd --version' : 'opencode --version',
    installGuide: 'npm install -g opencode-ai',
    bestAt: ['model-flexibility', 'openrouter-support', 'customization'],
  },

};

function getAllProfiles(customProviders = []) {
  const all = { ...PROVIDER_PROFILES };
  customProviders.forEach(p => { all[p.id] = p; });
  return all;
}

function getSerializableProfiles(customProviders = []) {
  const all = getAllProfiles(customProviders);
  const serialized = {};
  Object.entries(all).forEach(([id, profile]) => {
    serialized[id] = serializeProfile(profile);
  });
  return serialized;
}

function normalizeExecutionMode(agentId, requestedMode, customProviders = []) {
  const profile = getAllProfiles(customProviders)[agentId];
  if (!profile) return 'native';
  const modes = profile.executionModes || ['native'];
  if (modes.includes(requestedMode)) return requestedMode;
  return profile.defaultExecutionMode || modes[0] || 'native';
}

function getModeCapabilities(agentId, requestedMode, customProviders = []) {
  const profile = getAllProfiles(customProviders)[agentId];
  if (!profile) return {};
  const mode = normalizeExecutionMode(agentId, requestedMode, customProviders);
  return profile.modeCapabilities?.[mode] || {};
}

function getProfileForMode(agentId, requestedMode, customProviders = []) {
  const profile = getAllProfiles(customProviders)[agentId];
  if (!profile) return null;
  const mode = normalizeExecutionMode(agentId, requestedMode, customProviders);
  const modeCapabilities = getModeCapabilities(agentId, mode, customProviders);
  const webSearch = modeCapabilities.webSearch || profile.researchCapabilities?.webSearch || 'unknown';
  return {
    ...profile,
    executionMode: mode,
    researchCapabilities: {
      ...(profile.researchCapabilities || {}),
      webSearch,
      executionMode: mode,
      appResearchTool: Boolean(modeCapabilities.appResearchTool),
    },
  };
}

module.exports = { PROVIDER_PROFILES, getAllProfiles, getSerializableProfiles, normalizeExecutionMode, getModeCapabilities, getProfileForMode };
