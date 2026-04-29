const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const agentRunner = require('./agentRunner')
const { loadProxySettings, saveProxySettings } = require('./proxySettings')
const { detectTaskType, stripSlashCommand, TASK_TYPES } = require('./taskDetector')
const { injectSkill } = require('./skillBuilder')
const { getAllProfiles, getSerializableProfiles } = require('./providerProfiles')
const sessionCtx = require('./sessionContext')
const pipelineManager = require('./pipelineManager')
const collaborationManager = require('./collaborationManager')
const brainMemory = require('./brainMemory')
const brainstormChat = require('./brainstormChat')
const analyticsManager = require('./analyticsManager')
const notificationManager = require('./notificationManager')
const exportManager = require('./exportManager')
const errorHandler = require('./errorHandler')
const workspaceManager = require('./workspaceManager')
const sessionActions = require('./sessionActions')

let mainWindow

const workspacePath = path.join(os.homedir(), 'no1team', 'workspace')

function initializeWorkspace() {
  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true })
  }
}

/* ═══════════════════════════
   Brain File System
   ═══════════════════════════ */
function getBrainPath() {
  return path.join(os.homedir(), 'no1team', 'brain')
}

function getSafePath(base, relativePath) {
  const fullPath = path.resolve(base, relativePath)
  const relative = path.relative(base, fullPath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Access denied: Path traversal detected')
  }
  return fullPath
}

function initBrainStructure() {
  const base = path.join(os.homedir(), 'no1team');

  const dirs = [
    'workspace',
    'brain/memory',
    'brain/memory/sessions',
    'brain/agents',
    'brain/boss',
    'brain/rules',
    'brain/skills',
    'brain/knowledge/topics',
    'brain/identity',
    'brain/security',
  ];

  dirs.forEach(dir => {
    const full = path.join(base, dir);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
    }
  });

  // Only create files if they do not already exist
  const defaults = {

    'brain/master-index.md': `# No. 1 Team — Master Index
Created: ${new Date().toISOString().slice(0, 10)}

## Sessions
[Sessions will appear here as they are completed]

## Knowledge Base
[Topics will appear here as they are researched]

## Team
- [[identity/mission]]
- [[identity/agents]]
- [[boss/preferences]]
`,

    'brain/identity/mission.md': `# No. 1 Team Mission
We are a multi-agent AI coordination system.
The Boss directs. The team executes. Quality is non-negotiable.

## How We Work
- Boss gives task via chat
- Agents research, code, or analyze in parallel
- Senior Agent coordinates and synthesizes
- Boss approves final output
- Everything is saved to Brain memory
`,

    'brain/identity/agents.md': `# Team Roster

## Claude Code (claude)
Role: Senior Architect
Strengths: Complex logic, architecture, long reasoning, web search, file editing
Best for: Deep research, complex coding, senior agent role

## Codex (codex)
Role: Precision Coder
Strengths: Fast code generation, testing, API integration, refactoring
Best for: Coding tasks, test writing, feature implementation

## Gemini CLI (gemini)
Role: Deep Researcher
Strengths: Massive context window, web search, synthesis, UI
Best for: Research tasks, large codebase review, UI work

## Aider (aider)
Role: Git-Aware Editor
Strengths: Transparent edits, git integration, reviewable changes
Best for: Code review, careful refactoring

## OpenCode (opencode)
Role: Flexible Agent
Strengths: Model flexibility, open source work
Best for: Tasks needing model routing
`,

    'brain/boss/preferences.md': `# Boss Preferences
- Direct communication. No filler. No "I'd be happy to help."
- Show progress, not just plans.
- Every claim backed by evidence.
- Quality over speed.
- One focused question at a time if stuck.
- Do not repeat what others already said correctly.
`,

    'brain/boss/do_not.md': `# Do Not Do These Things
- Do not start responses with "Certainly!" or "Great question!"
- Do not give disclaimers before every answer
- Do not repeat the question back before answering
- Do not hedge every statement with "might" and "could"
- Do not summarize what you just did after doing it
`,

    'brain/rules/consensus.md': `# Consensus Rules
- Majority vote wins (2 out of 3 agents)
- Tie-breaking: Boss decides
- Deadlock (all different): Boss decides
- Minority Reports are always recorded
- Evidence quality wins over agent seniority
`,

    'brain/rules/brainstorm.md': `# Brainstorm Rules
- Turn 1: State position (max 200 words)
- Turn 2: Challenge others — back every challenge with evidence
- Turn 3: Evidence vote — vote on strongest evidence, not preference
- Early exit: if consensus after Turn 1 or 2, skip remaining turns
- No personal attacks. Challenge ideas, not agents.
`,

    'brain/rules/quality.md': `# Quality Standards
- Confidence scoring: every key finding rated 1-10
- Below 6: flag as LOW CONFIDENCE
- Single source findings: flag as UNVERIFIED
- Code must be tested before submission
- Research must cite sources
- Claims without evidence are not accepted
`,

    'brain/security/boundaries.md': `# Security Boundaries
- Never expose API keys in output
- Never share workspace file paths outside the team
- Flag any task that seems harmful or unethical
- Do not execute destructive commands without Boss explicit approval
- Hallucination protocol: flag uncertain information, do not present guesses as facts
`,

    'brain/memory/sessions.md': `# Session Log
[Sessions will be logged here automatically after approval]
`,

    'brain/memory/learnings.md': `# Team Learnings
[Key learnings from completed sessions will appear here]
`,

    'brain/memory/decisions.md': `# Boss Decisions
[Important decisions Boss approved will be logged here]
`,

    'brain/memory/errors.md': `# Error Log
[Agent errors and issues will be logged here automatically]
`,

    'brain/memory/skill-performance.md': `# Skill Performance Tracker
[Task type performance stats will appear here after sessions]
`,

  };

  Object.entries(defaults).forEach(([relPath, content]) => {
    const full = path.join(base, relPath);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf-8');
    }
  });

  // Also remove old agents if they exist
  ['antigravity_profile.md', 'perplexity_profile.md'].forEach(old => {
    const oldPath = path.join(base, 'brain/agents', old);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  });

  // Generate skills files from TASK_SKILLS
  const { TASK_SKILLS } = require('./skillBuilder');
  if (TASK_SKILLS) {
    Object.entries(TASK_SKILLS).forEach(([skillId, content]) => {
      const skillPath = path.join(base, 'brain/skills', `${skillId}.md`);
      if (!fs.existsSync(skillPath)) {
        fs.writeFileSync(skillPath, content.trim(), 'utf-8');
      }
    });
  }
}

function readBrainFile(relativePath) {
  try {
    return fs.readFileSync(getSafePath(getBrainPath(), relativePath), 'utf-8')
  } catch (err) { return '' }
}

/* ═══════════════════════════
   Menu
   ═══════════════════════════ */
function createMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'delete' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/* ═══════════════════════════
   Window
   ═══════════════════════════ */



function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 700,
    title: "No. 1 Team",
    backgroundColor: '#0A0A0F', // var(--bg-main)
    frame: false, // Remove default OS title bar
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // IPC handlers for custom title bar window controls
  ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize() })
  ipcMain.on('window-maximize', () => { 
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize()
      else mainWindow.maximize()
    }
  })
  ipcMain.on('window-close', () => { if (mainWindow) mainWindow.close() })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
  }

  mainWindow.webContents.openDevTools()

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.log(`[Renderer ${level === 3 ? 'ERROR' : 'WARN'}] ${message} (${sourceId}:${line})`)
    }
  })
}

/* ═══════════════════════════
   App Lifecycle
   ═══════════════════════════ */
app.whenReady().then(() => {
  initBrainStructure()
  initializeWorkspace()
  createMenu()
  createWindow()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

/* ═══════════════════════════
   Agent Runner IPC (Phase 2)
   ═══════════════════════════ */

ipcMain.on('boss-send-task', (event, payload) => {
  const { message, sessionId, agents, models, mode } = payload
  let context = sessionCtx.getSession(sessionId)
  if (!context) context = sessionCtx.createSession(sessionId, { activeAgents: agents, mode })

  const { taskType, fromSlash } = detectTaskType(message)
  const cleanTask = fromSlash ? stripSlashCommand(message) : message

  sessionCtx.updateSession(sessionId, { taskType: taskType.id })
  sessionCtx.addToHistory(sessionId, { sender: 'BOSS', content: cleanTask })

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('task-type-detected', { sessionId, taskType, fromSlash, message: cleanTask })
  }

  const profiles = getAllProfiles()
  agents.forEach(agentId => {
    const profile = profiles[agentId]
    if (!profile) return
    const model = models[agentId] || profile.defaultModel
    const workDir = context?.workDir || null
    const fullPrompt = injectSkill(profile.name, taskType.id, cleanTask, {
      ...context, sessionId, activeAgents: agents.map(id => profiles[id]?.name || id),
    })
    agentRunner.sendToAgent({ task: fullPrompt, workDir, agent: agentId, model, sessionId })
  })
})

ipcMain.on('boss-send-to-agent', (event, payload) => {
  agentRunner.sendToAgent(payload)
})

ipcMain.on('stop-all-agents', (event, { sessionId }) => {
  agentRunner.stopSession(sessionId)
})

ipcMain.on('stop-agent', (event, { agentId, sessionId }) => {
  agentRunner.stopAgent(agentId, sessionId)
})

ipcMain.on('stop-session', (event, { sessionId }) => {
  agentRunner.stopSession(sessionId)
})

// Session context IPC
ipcMain.on('create-session-context', (event, payload) => { sessionCtx.createSession(payload.sessionId, payload) })
ipcMain.on('update-session-context', (event, { sessionId, updates }) => { sessionCtx.updateSession(sessionId, updates) })
ipcMain.handle('get-session-context', (event, sessionId) => sessionCtx.getSession(sessionId))

// Provider profiles IPC — use serializable version (no functions)
ipcMain.handle('get-provider-profiles', () => getSerializableProfiles())
ipcMain.handle('test-provider', async (event, agentId) => {
  const { exec } = require('child_process')
  const profiles = getAllProfiles()
  const profile = profiles[agentId]
  if (!profile) return { installed: false, error: 'Provider not found' }
  return new Promise((resolve) => {
    exec(profile.installCheck, { timeout: 5000 }, (err) => {
      if (err) resolve({ installed: false, error: err.message })
      else resolve({ installed: true })
    })
  })
})

// Task detection IPC
ipcMain.handle('detect-task-type', (event, message) => detectTaskType(message))
ipcMain.handle('get-task-types', () => TASK_TYPES)

// Forward agent events to renderer
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data)
}
agentRunner.on('agent-chunk', data => { if (!data.silent) sendToRenderer('agent-chunk', data) })
agentRunner.on('agent-done', data => { if (!data.silent) sendToRenderer('agent-done', data) })
agentRunner.on('agent-error', data => sendToRenderer('agent-error', data))
agentRunner.on('agent-stopped', data => sendToRenderer('agent-stopped', data))
agentRunner.on('session-stopped', data => sendToRenderer('session-stopped', data))

ipcMain.handle('open-workspace', () => { shell.openPath(workspacePath) })
ipcMain.handle('get-proxy-settings', () => loadProxySettings())
ipcMain.on('save-proxy-settings', (event, settings) => { saveProxySettings(settings) })

/* ═══════════════════════════
   Pipeline IPC (Phase 3)
   ═══════════════════════════ */

ipcMain.on('start-pipeline', (event, payload) => { pipelineManager.startPipeline(payload) })
ipcMain.on('boss-approve', (event, { sessionId }) => { pipelineManager.bossApprove(sessionId) })
ipcMain.on('boss-send-back', (event, { sessionId, targetAgent, reason }) => { pipelineManager.bossSendBack(sessionId, targetAgent, reason) })
ipcMain.on('boss-cancel', (event, { sessionId, reason }) => { pipelineManager.bossCancel(sessionId, reason) })

const pipelineEvents = [
  'pipeline-start', 'pipeline-complete', 'pipeline-cancelled',
  'checkpoint', 'auto-approved', 'round-header', 'system-message',
  'research-ready', 'combined-doc-ready', 'brainstorm-votes',
  'brainstorm-mode-active', 'send-back', 'boss-approved',
]
pipelineEvents.forEach(evt => {
  pipelineManager.on(evt, data => sendToRenderer(`pipeline-${evt}`, data))
})

/* ═══════════════════════════
   Phase 4 — Collaboration IPC
   ═══════════════════════════ */

ipcMain.on('start-brainstorm', (event, { sessionId, agents, seniorAgent }) => {
  collaborationManager.initBrainstorm(sessionId, agents, seniorAgent)
})

ipcMain.on('run-brainstorm', async (event, payload) => {
  await collaborationManager.runFullBrainstorm(payload)
})

const collabEvents = ['round-start', 'early-consensus', 'votes-ready', 'deadlock']
collabEvents.forEach(evt => {
  collaborationManager.on(evt, data => sendToRenderer(`collab-${evt}`, data))
})

/* ═══════════════════════════
   Phase 4 — Brainstorm Chat IPC
   ═══════════════════════════ */

ipcMain.on('activate-brainstorm-chat', (event, { sessionId }) => {
  brainstormChat.activate(sessionId)
})

ipcMain.on('brainstorm-chat-message', async (event, payload) => {
  const profiles = getAllProfiles()
  const mentions = brainstormChat.parseMentions(payload.message, profiles)
  await brainstormChat.handleMessage({
    ...payload,
    targetAgents: mentions.length > 0 ? mentions : payload.targetAgents,
  })
})

brainstormChat.on('activated', data => sendToRenderer('brainstorm-chat-activated', data))

/* ═══════════════════════════
   Phase 4 — Brain Memory IPC
   ═══════════════════════════ */

ipcMain.on('save-session-to-brain', (event, payload) => {
  const folderRel = brainMemory.saveSession(payload)
  sendToRenderer('session-saved-to-brain', { folderRel })
})

ipcMain.handle('load-session-context', (event, folderRel) => brainMemory.loadSessionContext(folderRel))
ipcMain.handle('build-resume-briefing', (event, { folderRel, newTask }) => brainMemory.buildResumeBriefing(folderRel, newTask))
ipcMain.handle('load-relevant-memory', (event, { taskType, task }) => brainMemory.loadRelevantMemory(taskType, task))

ipcMain.on('update-agent-performance', (event, p) => {
  brainMemory.updateAgentPerformance(p.agentId, p.taskType, p.wasApproved, p.sendBackCount)
})

ipcMain.on('update-skill-performance', (event, p) => {
  brainMemory.updateSkillPerformance(p.taskType, p.wasApproved, p.sendBackCount)
})

ipcMain.on('log-brain-error', (event, { agentId, error }) => { brainMemory.logError(agentId, error) })
ipcMain.handle('list-brain-sessions', () => brainMemory.listSessions())
ipcMain.handle('get-skill-stats', () => brainMemory.getSkillStats())
ipcMain.handle('restore-brain-backup', (event, relPath) => brainMemory.restoreBackup(relPath))

// New Skill File Management IPC handlers
ipcMain.handle('list-skills', () => {
  const skillsDir = path.join(os.homedir(), 'no1team', 'brain', 'skills')
  if (!fs.existsSync(skillsDir)) return []
  return fs.readdirSync(skillsDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''))
})
ipcMain.handle('read-skill', (event, skillId) => {
  try {
    const p = getSafePath(path.join(os.homedir(), 'no1team', 'brain', 'skills'), `${skillId}.md`)
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : ''
  } catch (err) { return '' }
})
ipcMain.handle('write-skill', (event, { skillId, content }) => {
  try {
    const p = getSafePath(path.join(os.homedir(), 'no1team', 'brain', 'skills'), `${skillId}.md`)
    fs.writeFileSync(p, content, 'utf-8')
    return true
  } catch (err) { return false }
})

/* ═══════════════════════════
   Phase 4 — Auto-Save on Pipeline Complete
   ═══════════════════════════ */

pipelineManager.on('pipeline-complete', (data) => {
  const pipeline = pipelineManager.pipelines?.[data.sessionId]
  if (!pipeline) return

  try {
    brainMemory.saveSession({
      sessionId:            pipeline.sessionId,
      sessionName:          pipeline.task?.slice(0, 40) || 'Session',
      taskType:             pipeline.taskType,
      task:                 pipeline.task,
      finalAnswer:          pipeline.finalAnswer,
      seniorAgent:          pipeline.seniorAgent,
      agents:               pipeline.agents,
      researchData:         pipeline.researchData,
      combinedDoc:          pipeline.combinedDoc,
      brainstormTranscript: collaborationManager.getTranscript(data.sessionId),
      bossApproved:         true,
      sendBackCount:        pipeline.sendBackCount,
    })

    brainMemory.updateSkillPerformance(pipeline.taskType, true, pipeline.sendBackCount)
    pipeline.agents.forEach(agentId => {
      brainMemory.updateAgentPerformance(agentId, pipeline.taskType, true, pipeline.sendBackCount)
    })

    sendToRenderer('session-saved-to-brain', { folderRel: `sessions/${(pipeline.task?.slice(0, 40) || pipeline.sessionId).replace(/[^a-z0-9-_]/gi, '-')}` })
  } catch (e) {
    console.error('Auto-save to Brain failed:', e)
  }
})

/* ═══════════════════════════
   Phase 5 — Analytics IPC
   ═══════════════════════════ */

ipcMain.handle('get-analytics', () => analyticsManager.getAnalytics())

/* ═══════════════════════════
   Phase 5 — Notifications IPC
   ═══════════════════════════ */

ipcMain.on('update-notification-settings', (event, settings) => { notificationManager.updateSettings(settings) })
notificationManager.on('toast', data => sendToRenderer('show-toast', data))
notificationManager.on('notification-clicked', () => { if (mainWindow) mainWindow.focus() })

pipelineManager.on('pipeline-complete', ({ sessionId }) => {
  const isBackground = !mainWindow?.isFocused()
  const context = sessionCtx.getSession(sessionId)
  notificationManager.onPipelineComplete(sessionId, context?.taskType || 'task', isBackground)
})

pipelineManager.on('auto-approved', ({ message }) => { notificationManager.onAutoApproved(message) })

/* ═══════════════════════════
   Phase 5 — Export IPC
   ═══════════════════════════ */

ipcMain.handle('export-session', async (event, payload) => {
  return exportManager.exportSession({ ...payload, browserWindow: mainWindow })
})

/* ═══════════════════════════
   Phase 5 — Error Handling IPC
   ═══════════════════════════ */

agentRunner.on('agent-error', ({ agentId, agent, error, sessionId }) => {
  const context = sessionCtx.getSession(sessionId)
  errorHandler.handleAgentError({ agentId, agentName: agent, error, sessionId, taskType: context?.taskType || 'general' })
})

agentRunner.on('agent-done', ({ agentId, sessionId }) => { errorHandler.clearTimeout(agentId, sessionId) })

errorHandler.on('error-display', data => sendToRenderer('show-error', data))
errorHandler.on('agent-timeout', data => sendToRenderer('show-error', data))

ipcMain.on('start-agent-timeout', (event, { agentId, sessionId, taskType }) => { errorHandler.startTimeout(agentId, sessionId, taskType) })
ipcMain.on('clear-agent-timeout', (event, { agentId, sessionId }) => { errorHandler.clearTimeout(agentId, sessionId) })

/* ═══════════════════════════
   Phase 5 — Workspace IPC
   ═══════════════════════════ */

ipcMain.handle('create-session-workspace', (event, { sessionId, sessionName }) => workspaceManager.createSessionWorkspace(sessionId, sessionName))
ipcMain.handle('choose-workspace-folder', async () => workspaceManager.chooseWorkspaceFolder(mainWindow))
ipcMain.handle('validate-workspace', (event, workDir) => workspaceManager.validateWorkspace(workDir))
ipcMain.handle('list-workspace-files', (event, workDir) => workspaceManager.listWorkspaceFiles(workDir))
ipcMain.on('open-workspace-in-explorer', (event, workDir) => { workspaceManager.openInExplorer(workDir) })

/* ═══════════════════════════
   Phase 5 — Session Actions IPC
   ═══════════════════════════ */

ipcMain.handle('rename-session', (event, { folderName, newName }) => sessionActions.renameSession(folderName, newName))
ipcMain.handle('pin-session', (event, { folderName, pinned }) => sessionActions.pinSession(folderName, pinned))
ipcMain.handle('archive-session', (event, { folderName }) => sessionActions.archiveSession(folderName))
ipcMain.handle('delete-session', (event, { folderName }) => sessionActions.deleteSession(folderName))
ipcMain.handle('duplicate-session', (event, { folderName, newName }) => sessionActions.duplicateSession(folderName, newName))

/* ═══════════════════════════
   Brain Skill Content
   ═══════════════════════════ */

ipcMain.handle('brain:getSkill', async () => {
  return { content: readBrainFile('skills/how_to_join_team.md') }
})

ipcMain.handle('brain:saveSkill', async (event, { content }) => {
  try {
    fs.writeFileSync(getSafePath(getBrainPath(), 'skills/how_to_join_team.md'), content, 'utf-8')
    return { success: true }
  } catch (err) { return { success: false, error: err.message } }
})

/* ═══════════════════════════
   Session History System
   ═══════════════════════════ */

function getSessionsPath() {
  return path.join(getBrainPath(), 'sessions')
}

ipcMain.handle('session:getNextNumber', async () => {
  try {
    const sessDir = getSessionsPath()
    if (!fs.existsSync(sessDir)) fs.mkdirSync(sessDir, { recursive: true })
    const files = fs.readdirSync(sessDir).filter(f => f.match(/^session_\d+\.md$/))
    const numbers = files.map(f => parseInt(f.match(/session_(\d+)/)[1]))
    return { number: numbers.length > 0 ? Math.max(...numbers) + 1 : 1 }
  } catch (err) { return { number: 1 } }
})

ipcMain.handle('session:save', async (event, { sessionNumber, data }) => {
  try {
    const sessDir = getSessionsPath()
    if (!fs.existsSync(sessDir)) fs.mkdirSync(sessDir, { recursive: true })
    const filePath = getSafePath(sessDir, `session_${sessionNumber}.md`)
    let content = `# Session ${sessionNumber}\n\n`
    content += `**Task:** ${data.task || 'No task set'}\n`
    content += `**Phase:** ${data.phase || 'Phase 1'}\n`
    content += `**Created:** ${data.createdAt || new Date().toISOString()}\n`
    content += `**Last Updated:** ${new Date().toISOString()}\n`
    content += `**Senior Agent:** ${data.seniorAgent || 'Not assigned'}\n`
    content += `**Red Team:** ${data.redTeamAgent || 'Not assigned'}\n`
    content += `**Active Agents:** ${(data.agents || []).join(', ') || 'None'}\n\n`
    content += `---\n\n## Conversation History\n\n`
    if (data.messages && data.messages.length > 0) {
      for (const msg of data.messages) {
        content += `**${msg.sender || 'Unknown'}** (${msg.time || ''}):\n${msg.text}\n\n`
      }
    }
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true, path: filePath }
  } catch (err) { return { success: false, error: err.message } }
})

ipcMain.handle('session:load', async (event, { sessionNumber }) => {
  try {
    const filePath = getSafePath(getSessionsPath(), `session_${sessionNumber}.md`)
    if (!fs.existsSync(filePath)) return { success: false, error: 'Session not found' }
    return { success: true, content: fs.readFileSync(filePath, 'utf-8') }
  } catch (err) { return { success: false, error: err.message } }
})

ipcMain.handle('session:list', async () => {
  try {
    const sessDir = getSessionsPath()
    if (!fs.existsSync(sessDir)) return { sessions: [] }
    const files = fs.readdirSync(sessDir).filter(f => f.match(/^session_\d+\.md$/))
    const sessions = files.map(f => {
      const num = parseInt(f.match(/session_(\d+)/)[1])
      const content = fs.readFileSync(path.join(sessDir, f), 'utf-8')
      const taskMatch = content.match(/\*\*Task:\*\* (.+)/)
      const dateMatch = content.match(/\*\*Last Updated:\*\* (.+)/)
      const createdMatch = content.match(/\*\*Created:\*\* (.+)/)
      return { number: num, task: taskMatch?.[1] || 'Unknown', lastUpdated: dateMatch?.[1] || '', createdAt: createdMatch?.[1] || '', agents: [] }
    }).sort((a, b) => b.number - a.number)
    return { sessions }
  } catch (err) { return { sessions: [] } }
})

ipcMain.handle('session:saveState', async (event, { sessionNumber, state }) => {
  try {
    const sessDir = getSessionsPath()
    if (!fs.existsSync(sessDir)) fs.mkdirSync(sessDir, { recursive: true })
    fs.writeFileSync(getSafePath(sessDir, `state_${sessionNumber}.json`), JSON.stringify(state, null, 2), 'utf-8')
    return { success: true }
  } catch (err) { return { success: false, error: err.message } }
})

ipcMain.handle('session:loadState', async (event, { sessionNumber }) => {
  try {
    const filePath = getSafePath(getSessionsPath(), `state_${sessionNumber}.json`)
    if (!fs.existsSync(filePath)) return { success: false, error: 'No saved state' }
    return { success: true, state: JSON.parse(fs.readFileSync(filePath, 'utf-8')) }
  } catch (err) { return { success: false, error: err.message } }
})

ipcMain.handle('session:searchPast', async (event, { keywords }) => {
  try {
    const sessDir = getSessionsPath()
    if (!fs.existsSync(sessDir)) return { results: [] }
    const stateFiles = fs.readdirSync(sessDir).filter(f => f.match(/^state_\d+\.json$/))
    const kw = (keywords || '').toLowerCase().split(/\s+/).filter(Boolean)
    if (kw.length === 0) return { results: [] }
    const scored = []
    for (const f of stateFiles) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(sessDir, f), 'utf-8'))
        const allText = ((data.title || '') + ' ' + (data.messages || []).map(m => m.text || '').join(' ')).toLowerCase()
        const hits = kw.filter(k => allText.includes(k)).length
        if (hits > 0) {
          const msgs = data.messages || []
          const summary = msgs.slice(-3).map(m => `${m.sender?.name || 'Unknown'}: ${(m.text || '').slice(0, 200)}`).join('\n')
          scored.push({ number: data.number || parseInt(f.match(/state_(\d+)/)?.[1] || '0'), title: data.title || 'Unknown', hits, summary })
        }
      } catch (e) { console.error('Error reading or processing session state file during past session search', e) }
    }
    scored.sort((a, b) => b.hits - a.hits)
    return { results: scored.slice(0, 5) }
  } catch (err) { return { results: [] } }
})

/* ═══════════════════════════
   Desktop Notifications
   ═══════════════════════════ */
const { Notification: ElectronNotification } = require('electron')
ipcMain.handle('notify:show', async (event, { title, body }) => {
  if (ElectronNotification.isSupported()) {
    new ElectronNotification({ title, body, silent: false }).show()
    return { success: true }
  }
  return { success: false, error: 'Notifications not supported' }
})

/* ═══════════════════════════
   Brain File Browser
   ═══════════════════════════ */
function buildTree(dirPath, relativeTo) {
  const items = []
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      const relPath = path.relative(relativeTo, fullPath).replace(/\\/g, '/')
      if (entry.isDirectory()) {
        items.push({ name: entry.name, path: relPath, type: 'folder', children: buildTree(fullPath, relativeTo) })
      } else if (entry.name.endsWith('.md')) {
        const stat = fs.statSync(fullPath)
        items.push({ name: entry.name, path: relPath, type: 'file', size: stat.size, modified: stat.mtime.toISOString() })
      }
    }
  } catch (err) { console.error('Error building brain tree structure', err) }
  return items.sort((a, b) => { if (a.type !== b.type) return a.type === 'folder' ? -1 : 1; return a.name.localeCompare(b.name) })
}

ipcMain.handle('brain:listTree', async () => { return { tree: buildTree(getBrainPath(), getBrainPath()) } })

ipcMain.handle('brain:readFile', async (event, { filePath }) => {
  try { return { success: true, content: fs.readFileSync(getSafePath(getBrainPath(), filePath), 'utf-8') } }
  catch (err) { return { success: false, error: err.message } }
})

ipcMain.handle('brain:writeFile', async (event, { filePath, content }) => {
  try {
    const fullPath = getSafePath(getBrainPath(), filePath)
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf-8')
    return { success: true }
  } catch (err) { return { success: false, error: err.message } }
})

ipcMain.handle('brain:appendFile', async (event, { filePath, content }) => {
  try {
    const fullPath = getSafePath(getBrainPath(), filePath)
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(fullPath, content, 'utf-8')
    return { success: true }
  } catch (err) { return { success: false, error: err.message } }
})

ipcMain.handle('brain:searchContent', async (event, { query }) => {
  try {
    const brainPath = getBrainPath()
    const results = []
    const q = (query || '').toLowerCase()
    if (!q || q.length < 2) return { results: [] }
    function searchDir(dirPath) {
      if (!fs.existsSync(dirPath)) return
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) { searchDir(fullPath) }
        else if (entry.name.endsWith('.md')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8')
            const idx = content.toLowerCase().indexOf(q)
            if (idx !== -1) {
              const start = Math.max(0, idx - 40)
              const end = Math.min(content.length, idx + q.length + 60)
              const snippet = (start > 0 ? '...' : '') + content.slice(start, end).replace(/\n/g, ' ') + (end < content.length ? '...' : '')
              results.push({ path: path.relative(brainPath, fullPath).replace(/\\/g, '/'), name: entry.name, snippet, matchIndex: idx })
            }
          } catch (e) { console.error('Error reading file or calculating match index during brain search', e) }
        }
      }
    }
    searchDir(brainPath)
    return { results: results.slice(0, 30) }
  } catch (err) { return { results: [] } }
})

ipcMain.handle('brain:scanBacklinks', async (event, { targetFileName }) => {
  try {
    const brainPath = getBrainPath()
    const targetBase = (targetFileName || '').replace(/\.md$/i, '')
    if (!targetBase) return { backlinks: [] }
    const backlinks = []
    const pattern = new RegExp(`\\[\\[${targetBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]`, 'i')
    async function scanDir(dirPath) {
      let entries
      try {
        entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
      } catch (err) {
        return // Ignore if directory doesn't exist or can't be read
      }

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
          await scanDir(fullPath)
        }
        else if (entry.name.endsWith('.md')) {
          try {
            const content = await fs.promises.readFile(fullPath, 'utf-8')
            if (pattern.test(content)) {
              backlinks.push({ path: path.relative(brainPath, fullPath).replace(/\\/g, '/'), name: entry.name })
            }
          } catch (e) {
            console.error(`Failed to read markdown file for backlinks at ${fullPath}:`, e)
          }
        }
      }
    }
    await scanDir(brainPath)
    return { backlinks }
  } catch (err) { return { backlinks: [] } }
})

ipcMain.handle('brain:scanOrphans', async () => {
  try {
    const brainPath = getBrainPath()
    const allFiles = []
    const linkPattern = /\[\[([^\]]+)\]\]/g
    function collectFiles(dirPath) {
      if (!fs.existsSync(dirPath)) return
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) { collectFiles(fullPath) }
        else if (entry.name.endsWith('.md')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8')
            const matches = content.match(linkPattern)
            allFiles.push({ path: path.relative(brainPath, fullPath).replace(/\\/g, '/'), name: entry.name, baseName: entry.name.replace(/\.md$/i, ''), outgoing: matches ? matches.map(m => m.slice(2, -2).toLowerCase()) : [] })
          } catch (e) { console.error('Error reading file or calculating matches during orphans scan', e) }
        }
      }
    }
    collectFiles(brainPath)
    const incomingMap = {}
    for (const f of allFiles) { for (const link of f.outgoing) { if (!incomingMap[link]) incomingMap[link] = []; incomingMap[link].push(f.name) } }
    const orphans = allFiles.filter(f => f.outgoing.length === 0 && !incomingMap[f.baseName.toLowerCase()]).map(f => ({ path: f.path, name: f.name }))
    return { orphans }
  } catch (err) { return { orphans: [] } }
})

/* ═══════════════════════════
   PDF Export
   ═══════════════════════════ */
ipcMain.handle('export:toPDF', async (event, payload) => {
  try {
    let htmlContent = payload.htmlContent;
    if (payload.sessionData) {
      const { exportSession } = require('./exportManager');
      // Simple HTML wrap of the markdown content for PDF export
      const mdContent = `# ${payload.sessionData.sessionName || 'Session'}\n\n**Task:** ${payload.sessionData.task}\n\n**Answer:** ${payload.sessionData.finalAnswer}`;
      htmlContent = `<html><body style="font-family: sans-serif; white-space: pre-wrap; padding: 20px;">${mdContent}</body></html>`;
    }
    const win = new BrowserWindow({ show: false, width: 800, height: 600 })
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent))
    const pdfBuffer = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 } })
    win.close()
    
    // Allow saving directly if requested via ExportOptions
    if (payload.sessionData) {
      const { dialog } = require('electron');
      const os = require('os');
      const safeName = (payload.sessionData.sessionName || 'session').replace(/[^a-z0-9]/gi, '-').slice(0, 30);
      const { filePath } = await dialog.showSaveDialog({
        defaultPath: path.join(os.homedir(), `${safeName}.pdf`),
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });
      if (filePath) {
        fs.writeFileSync(filePath, pdfBuffer);
        return { success: true, filePath };
      } else {
        return { success: false, cancelled: true };
      }
    }
    
    return { success: true, data: pdfBuffer.toString('base64') }
  } catch (err) { return { success: false, error: err.message } }
})
