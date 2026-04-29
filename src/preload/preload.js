const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('teamAPI', {
  platform: process.platform,
  appVersion: '0.4.0',

  // 🪟 WINDOW CONTROLS 🪟
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
  },

  // ── AGENT TASK RUNNER (Phase 2) ────────────────
  sendTask: (payload) =>
    ipcRenderer.send('boss-send-task', payload),

  sendToAgent: (payload) =>
    ipcRenderer.send('boss-send-to-agent', payload),

  stopSession: (sessionId) =>
    ipcRenderer.send('stop-session', { sessionId }),

  stopAllAgents: (sessionId) =>
    ipcRenderer.send('stop-all-agents', { sessionId }),

  stopAgent: (agentId, sessionId) =>
    ipcRenderer.send('stop-agent', { agentId, sessionId }),

  onAgentChunk: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('agent-chunk', listener)
    return () => ipcRenderer.removeListener('agent-chunk', listener)
  },

  onAgentDone: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('agent-done', listener)
    return () => ipcRenderer.removeListener('agent-done', listener)
  },

  onAgentError: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('agent-error', listener)
    return () => ipcRenderer.removeListener('agent-error', listener)
  },

  onSessionStopped: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('session-stopped', listener)
    return () => ipcRenderer.removeListener('session-stopped', listener)
  },

  onAgentStopped: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('agent-stopped', listener)
    return () => ipcRenderer.removeListener('agent-stopped', listener)
  },

  onTaskTypeDetected: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('task-type-detected', listener)
    return () => ipcRenderer.removeListener('task-type-detected', listener)
  },

  // ── PIPELINE (Phase 3) ─────────────────────────
  startPipeline: (payload) =>
    ipcRenderer.send('start-pipeline', payload),

  bossApprove: (sessionId) =>
    ipcRenderer.send('boss-approve', { sessionId }),

  bossSendBack: (sessionId, targetAgent, reason) =>
    ipcRenderer.send('boss-send-back', { sessionId, targetAgent, reason }),

  bossCancel: (sessionId, reason) =>
    ipcRenderer.send('boss-cancel', { sessionId, reason }),

  onPipelineEvent: (eventName, callback) => {
    const channel = `pipeline-${eventName}`
    const listener = (_, data) => callback(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },

  // ── COLLABORATION (Phase 4) ────────────────────
  startBrainstorm: (sessionId, agents, seniorAgent) =>
    ipcRenderer.send('start-brainstorm', { sessionId, agents, seniorAgent }),

  runBrainstorm: (payload) =>
    ipcRenderer.send('run-brainstorm', payload),

  onCollabEvent: (eventName, callback) => {
    const channel = `collab-${eventName}`
    const listener = (_, data) => callback(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },

  // ── BRAINSTORM CHAT (Phase 4) ──────────────────
  activateBrainstormChat: (sessionId) =>
    ipcRenderer.send('activate-brainstorm-chat', { sessionId }),

  sendBrainstormMessage: (payload) =>
    ipcRenderer.send('brainstorm-chat-message', payload),

  onBrainstormChatActivated: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('brainstorm-chat-activated', listener)
    return () => ipcRenderer.removeListener('brainstorm-chat-activated', listener)
  },

  // ── BRAIN MEMORY (Phase 4) ─────────────────────
  saveSessionToBrain: (payload) =>
    ipcRenderer.send('save-session-to-brain', payload),

  loadSessionContext: (folderRel) =>
    ipcRenderer.invoke('load-session-context', folderRel),

  buildResumeBriefing: (folderRel, newTask) =>
    ipcRenderer.invoke('build-resume-briefing', { folderRel, newTask }),

  loadRelevantMemory: (taskType, task) =>
    ipcRenderer.invoke('load-relevant-memory', { taskType, task }),

  updateAgentPerformance: (payload) =>
    ipcRenderer.send('update-agent-performance', payload),

  updateSkillPerformance: (payload) =>
    ipcRenderer.send('update-skill-performance', payload),

  logBrainError: (agentId, error) =>
    ipcRenderer.send('log-brain-error', { agentId, error }),

  listBrainSessions: () =>
    ipcRenderer.invoke('list-brain-sessions'),

  getSkillStats: () =>
    ipcRenderer.invoke('get-skill-stats'),

  restoreBrainBackup: (relPath) =>
    ipcRenderer.invoke('restore-brain-backup', relPath),

  brain: {
    listSkills: () => ipcRenderer.invoke('list-skills'),
    readSkill: (skillId) => ipcRenderer.invoke('read-skill', skillId),
    writeSkill: (skillId, content) => ipcRenderer.invoke('write-skill', { skillId, content }),
  },

  onSessionSavedToBrain: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('session-saved-to-brain', listener)
    return () => ipcRenderer.removeListener('session-saved-to-brain', listener)
  },

  // ── ANALYTICS (Phase 5) ────────────────────────
  getAnalytics: () =>
    ipcRenderer.invoke('get-analytics'),

  // ── NOTIFICATIONS (Phase 5) ────────────────────
  updateNotificationSettings: (settings) =>
    ipcRenderer.send('update-notification-settings', settings),

  onToast: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('show-toast', listener)
    return () => ipcRenderer.removeListener('show-toast', listener)
  },

  // ── EXPORT (Phase 5) ───────────────────────────
  exportSession: (payload) =>
    ipcRenderer.invoke('export-session', payload),

  // ── ERROR HANDLING (Phase 5) ───────────────────
  onShowError: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('show-error', listener)
    return () => ipcRenderer.removeListener('show-error', listener)
  },

  // ── WORKSPACE (Phase 5) ────────────────────────
  createSessionWorkspace: (sessionId, sessionName) =>
    ipcRenderer.invoke('create-session-workspace', { sessionId, sessionName }),

  chooseWorkspaceFolder: () =>
    ipcRenderer.invoke('choose-workspace-folder'),

  validateWorkspace: (workDir) =>
    ipcRenderer.invoke('validate-workspace', workDir),

  listWorkspaceFiles: (workDir) =>
    ipcRenderer.invoke('list-workspace-files', workDir),

  openWorkspaceInExplorer: (workDir) =>
    ipcRenderer.send('open-workspace-in-explorer', workDir),

  // ── SESSION ACTIONS (Phase 5) ──────────────────
  renameSession: (folderName, newName) =>
    ipcRenderer.invoke('rename-session', { folderName, newName }),

  pinSession: (folderName, pinned) =>
    ipcRenderer.invoke('pin-session', { folderName, pinned }),

  archiveSession: (folderName) =>
    ipcRenderer.invoke('archive-session', { folderName }),

  deleteSession: (folderName) =>
    ipcRenderer.invoke('delete-session', { folderName }),

  duplicateSession: (folderName, newName) =>
    ipcRenderer.invoke('duplicate-session', { folderName, newName }),

  // ── PROVIDER PROFILES (Phase 2) ────────────────
  getProviderProfiles: () =>
    ipcRenderer.invoke('get-provider-profiles'),

  testProvider: (agentId) =>
    ipcRenderer.invoke('test-provider', agentId),

  // ── TASK DETECTION (Phase 2) ───────────────────
  detectTaskType: (message) =>
    ipcRenderer.invoke('detect-task-type', message),

  getTaskTypes: () =>
    ipcRenderer.invoke('get-task-types'),

  // ── SESSION CONTEXT (Phase 2) ──────────────────
  createSessionContext: (payload) =>
    ipcRenderer.send('create-session-context', payload),

  updateSessionContext: (sessionId, updates) =>
    ipcRenderer.send('update-session-context', { sessionId, updates }),

  getSessionContext: (sessionId) =>
    ipcRenderer.invoke('get-session-context', sessionId),

  // ── WORKSPACE ─────────────────────────────────
  openWorkspace: () =>
    ipcRenderer.invoke('open-workspace'),

  // ── PROXY SETTINGS ────────────────────────────
  getProxySettings: () =>
    ipcRenderer.invoke('get-proxy-settings'),

  saveProxySettings: (settings) =>
    ipcRenderer.send('save-proxy-settings', settings),

  // ── BRAIN FILES ───────────────────────────────
  brain: {
    getSkill: () => ipcRenderer.invoke('brain:getSkill'),
    saveSkill: (content) => ipcRenderer.invoke('brain:saveSkill', { content }),
    listTree: () => ipcRenderer.invoke('brain:listTree'),
    readFile: (filePath) => ipcRenderer.invoke('brain:readFile', { filePath }),
    writeFile: (filePath, content) => ipcRenderer.invoke('brain:writeFile', { filePath, content }),
    appendFile: (filePath, content) => ipcRenderer.invoke('brain:appendFile', { filePath, content }),
    searchContent: (query) => ipcRenderer.invoke('brain:searchContent', { query }),
    scanBacklinks: (targetFileName) => ipcRenderer.invoke('brain:scanBacklinks', { targetFileName }),
    scanOrphans: () => ipcRenderer.invoke('brain:scanOrphans'),
  },

  // ── SESSION / EXPORT ──────────────────────────
  session: {
    getNextNumber: () => ipcRenderer.invoke('session:getNextNumber'),
    save: (sessionNumber, data) => ipcRenderer.invoke('session:save', { sessionNumber, data }),
    load: (sessionNumber) => ipcRenderer.invoke('session:load', { sessionNumber }),
    list: () => ipcRenderer.invoke('session:list'),
    saveState: (sessionNumber, state) => ipcRenderer.invoke('session:saveState', { sessionNumber, state }),
    loadState: (sessionNumber) => ipcRenderer.invoke('session:loadState', { sessionNumber }),
    searchPast: (keywords) => ipcRenderer.invoke('session:searchPast', { keywords }),
  },

  // ── NOTIFICATIONS ─────────────────────────────
  notify: {
    show: (title, body) => ipcRenderer.invoke('notify:show', { title, body }),
  },

  // ── EXPORT ────────────────────────────────────
  export: {
    toPDF: (htmlContent) => ipcRenderer.invoke('export:toPDF', { htmlContent }),
  },

  // Expose raw ipcRenderer for the new fixes
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(event, ...args))
  }
})
