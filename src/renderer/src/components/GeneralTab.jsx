import React, { useState, useEffect, useRef } from 'react'
import CheckpointMessage from './CheckpointMessage'
import SeniorAgentSelector from './SeniorAgentSelector'
import ResearchPanel from './ResearchPanel'
import { BrainstormChatIndicator } from './BrainstormChatMode'
import ErrorDisplay from './ErrorDisplay'
import ExportOptions from './ExportOptions'

function getColor(agentName) {
  if (!agentName) return 'var(--text-primary)'
  const name = agentName.toLowerCase()
  if (name.includes('claude')) return 'var(--color-claude)'
  if (name.includes('codex')) return 'var(--color-codex)'
  if (name.includes('gemini')) return 'var(--color-gemini)'
  if (name.includes('aider')) return 'var(--color-aider)'
  if (name.includes('opencode')) return 'var(--color-opencode)'
  if (agentName === 'BOSS' || agentName === 'You') return 'var(--color-boss)'
  if (agentName === 'System') return 'var(--accent)'
  return 'var(--text-primary)'
}

export default function GeneralTab({ sessionId }) {
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [target, setTarget] = useState('all')
  const [isRunning, setIsRunning] = useState(false)
  const [agentStatus, setAgentStatus] = useState({})
  const bottomRef = useRef(null)

  // Phase 3 state
  const [seniorAgent, setSeniorAgent] = useState(null)
  const [showSeniorPicker, setShowSeniorPicker] = useState(false)
  const [pendingTask, setPendingTask] = useState(null)
  const [researchData, setResearchData] = useState({})
  const [researchValidation, setResearchValidation] = useState(null)
  const [combinedDoc, setCombinedDoc] = useState(null)
  const [showResearch, setShowResearch] = useState(false)
  const [hasResearch, setHasResearch] = useState(false)
  const [currentMode, setCurrentMode] = useState('manual') // 'auto' | 'manual'

  // Phase 4 state
  const [brainstormChatActive, setBrainstormChatActive] = useState(false)
  const [sendBackCount, setSendBackCount] = useState(0)
  const [originalTask, setOriginalTask] = useState('')
  const [currentTaskType, setCurrentTaskType] = useState('general')

  // Phase 5 state
  const [pipelineComplete, setPipelineComplete] = useState(false)
  const [lastSessionData, setLastSessionData] = useState(null)
  const [workspaceDir, setWorkspaceDir] = useState('')

  // UI states
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [taskType, setTaskType] = useState(null)
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)

  // Provider profiles & models
  const [profiles, setProfiles] = useState(null)
  const [selectedModels, setSelectedModels] = useState({})
  const [selectedSubagentModels, setSelectedSubagentModels] = useState({ codex: 'gpt-5.4-mini' })
  const [selectedProxyModels, setSelectedProxyModels] = useState({
    claude: { opus: '', sonnet: '', haiku: '' },
    codex: { main: '' },
  })
  const [executionModes, setExecutionModes] = useState({})

  // Pending task type — when Boss types a bare slash command with no topic
  const [pendingTaskType, setPendingTaskType] = useState(null)

  const [currentSessionId, setCurrentSessionId] = useState(sessionId)

  // Load provider profiles
  useEffect(() => {
    async function loadProfiles() {
      if (!window.teamAPI?.getProviderProfiles) return
      try {
        const p = await window.teamAPI.getProviderProfiles()
        setProfiles(p)
        const defaults = {}
        const executionDefaults = {}
        Object.values(p).forEach(profile => {
          defaults[profile.id] = profile.defaultModel
          executionDefaults[profile.id] = profile.defaultExecutionMode || 'native'
        })
        setSelectedModels(defaults)
        setExecutionModes(executionDefaults)
      } catch (e) { console.error('Failed to load profiles:', e) }
    }
    loadProfiles()
  }, [])

  // Load session
  useEffect(() => {
    if (!sessionId) return
    setCurrentSessionId(sessionId)
    async function load() {
      if (!window.teamAPI?.session?.loadState) return
      const res = await window.teamAPI.session.loadState(sessionId.replace('session-', ''))
      if (res?.success && res.state?.messages) {
        setMessages(res.state.messages)
        if (res.state.seniorAgent) setSeniorAgent(res.state.seniorAgent)
        if (res.state.currentMode) setCurrentMode(res.state.currentMode)
        if (res.state.workspaceDir) setWorkspaceDir(res.state.workspaceDir)
      }
      else setMessages([])
    }
    load()
  }, [sessionId])

  // Save session
  useEffect(() => {
    if (!currentSessionId || messages.length === 0) return
    const num = currentSessionId.replace('session-', '')
    window.teamAPI?.session?.saveState(num, {
      title: messages.find(m => m.agent === 'You')?.content?.slice(0, 80) || 'New Session',
      messages, seniorAgent, currentMode, workspaceDir, lastUpdated: new Date().toISOString()
    })
  }, [messages, currentSessionId])

  // Add a message helper
  function addMsg(msg) {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), timestamp: new Date(), ...msg }])
  }

  // ── Agent event listeners ──
  useEffect(() => {
    if (!window.teamAPI?.onAgentChunk) return
    const removers = []

    removers.push(window.teamAPI.onAgentChunk((data) => {
      if (data.sessionId !== currentSessionId) return
      setMessages(prev => {
        let foundIndex = -1
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].agentId === data.agentId && prev[i].inProgress) {
            foundIndex = i
            break
          }
        }
        if (foundIndex !== -1) {
          const next = [...prev]
          next[foundIndex] = { ...next[foundIndex], content: next[foundIndex].content + data.content }
          return next
        }
        return [...prev, { id: Date.now() + Math.random(), agent: data.agent, agentId: data.agentId,
          content: data.content, inProgress: true, timestamp: new Date() }]
      })
    }))

    removers.push(window.teamAPI.onAgentDone((data) => {
      if (data.sessionId !== currentSessionId) return
      setMessages(prev => prev.map(m => m.agentId === data.agentId && m.inProgress ? { ...m, inProgress: false } : m))
      setAgentStatus(prev => {
        const updated = { ...prev, [data.agentId]: 'done' }
        if (Object.values(updated).every(s => s === 'done' || s === 'error' || s === 'idle')) setIsRunning(false)
        return updated
      })
    }))

    removers.push(window.teamAPI.onAgentError((data) => {
      if (data.sessionId !== currentSessionId) return
      addMsg({ agent: data.agent, agentId: data.agentId, content: `⚠️ ${data.error}`, isError: true })
      setAgentStatus(prev => ({ ...prev, [data.agentId]: 'error' }))
    }))

    removers.push(window.teamAPI.onSessionStopped((data) => {
      if (data.sessionId !== currentSessionId) return
      setIsRunning(false); setAgentStatus({})
    }))

    return () => removers.forEach(fn => fn?.())
  }, [currentSessionId])

  // ── Pipeline event listeners (Phase 3) ──
  useEffect(() => {
    if (!window.teamAPI?.onPipelineEvent) return
    const removers = []

    removers.push(window.teamAPI.onPipelineEvent('checkpoint', (data) => {
      if (data.sessionId !== currentSessionId) return
      addMsg({ type: 'checkpoint', checkpoint: data, agent: 'System', isSystem: true })
    }))

    removers.push(window.teamAPI.onPipelineEvent('round-header', (data) => {
      if (data.sessionId !== currentSessionId) return
      addMsg({ type: 'round-header', content: data.label, agent: 'System', isSystem: true })
    }))

    removers.push(window.teamAPI.onPipelineEvent('system-message', (data) => {
      if (data.sessionId !== currentSessionId) return
      addMsg({ type: 'system', content: data.message, agent: 'System', isSystem: true })
    }))

    removers.push(window.teamAPI.onPipelineEvent('research-ready', (data) => {
      if (data.sessionId !== currentSessionId) return
      setResearchData(data.researchData)
      setResearchValidation(data.researchValidation || null)
      setHasResearch(true)
      addMsg({ type: 'research-notification', agentCount: Object.keys(data.researchData).length, agent: 'System', isSystem: true })
    }))

    removers.push(window.teamAPI.onPipelineEvent('combined-doc-ready', (data) => {
      if (data.sessionId !== currentSessionId) return
      setCombinedDoc(data.combinedDoc)
      if (data.combinedDoc?.trim()) {
        addMsg({ agent: profiles?.[seniorAgent]?.name || 'Senior Agent', agentId: seniorAgent, content: data.combinedDoc })
      }
    }))

    removers.push(window.teamAPI.onPipelineEvent('pipeline-cancelled', (data) => {
      if (data.sessionId !== currentSessionId) return
      setIsRunning(false)
      addMsg({ type: 'system', content: `❌ Pipeline cancelled${data.reason ? ': ' + data.reason : ''}.`, agent: 'System', isSystem: true })
    }))

    removers.push(window.teamAPI.onPipelineEvent('auto-approved', (data) => {
      if (data.sessionId !== currentSessionId) return
      addMsg({ type: 'system', content: `⚡ Auto-approved: ${data.message}`, agent: 'System', isSystem: true })
    }))

    // Brainstorm mode activation
    removers.push(window.teamAPI.onPipelineEvent('brainstorm-mode-active', (data) => {
      if (data.sessionId !== currentSessionId) return
      setBrainstormChatActive(true)
      window.teamAPI?.activateBrainstormChat?.(currentSessionId)
    }))

    // Collab events
    removers.push(window.teamAPI.onCollabEvent?.('round-start', (data) => {
      if (data.sessionId !== currentSessionId) return
      addMsg({ type: 'round-header', content: data.label, agent: 'System', isSystem: true })
    }))

    removers.push(window.teamAPI.onCollabEvent?.('early-consensus', (data) => {
      if (data.sessionId !== currentSessionId) return
      addMsg({ type: 'system', content: data.message, agent: 'System', isSystem: true })
    }))

    removers.push(window.teamAPI.onCollabEvent?.('deadlock', (data) => {
      if (data.sessionId !== currentSessionId) return
      addMsg({ type: 'system', content: data.message, agent: 'System', isSystem: true })
    }))

    // Session saved to brain notification
    removers.push(window.teamAPI.onSessionSavedToBrain?.((data) => {
      addMsg({ type: 'system', content: `💾 Session saved to Brain: ${data.folderRel}`, agent: 'System', isSystem: true })
    }))

    // Phase 5 — Error display in chat
    removers.push(window.teamAPI.onShowError?.((data) => {
      if (data.sessionId && data.sessionId !== currentSessionId) return
      addMsg({ type: 'error', error: data, agent: 'System', isSystem: true })
    }))

    // Phase 5 — Pipeline complete → show export options and auto-save
    removers.push(window.teamAPI.onPipelineEvent?.('pipeline-complete', (data) => {
      if (data.sessionId !== currentSessionId) return
      setPipelineComplete(true)
      setIsRunning(false)
      if (data.finalAnswer?.trim()) {
        addMsg({ agent: profiles?.[seniorAgent]?.name || 'Senior Agent', agentId: seniorAgent, content: data.finalAnswer })
      }
      addMsg({ type: 'system', content: '✅ Pipeline complete. Session saved.', agent: 'System', isSystem: true })
      setLastSessionData({
        sessionName: originalTask?.slice(0, 40) || 'Session',
        taskType: currentTaskType, task: originalTask,
        finalAnswer: data.finalAnswer, date: new Date().toISOString().slice(0, 10),
        agents: getAgentKeys(), seniorAgent,
      })
    }))

    return () => removers.forEach(fn => fn?.())
  }, [currentSessionId])

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function getAgentKeys() {
    if (target === 'all') return ['claude', 'codex', 'gemini']
    return [target]
  }

  // ── Send message → start pipeline ──
  async function sendMessage() {
    const text = inputText.trim()
    if (!text || isRunning) return
    const agents = getAgentKeys()

    addMsg({ agent: 'You', content: text })
    setInputText('')
    setTaskType(null)
    setSlashMenuOpen(false)

    // If we have a pending task type from a previous bare slash command, use it
    if (pendingTaskType) {
      const finalType = pendingTaskType
      setPendingTaskType(null)
      setOriginalTask(text)
      setCurrentTaskType(finalType)

      if (!seniorAgent) {
        setShowSeniorPicker(true)
        setPendingTask({ message: text, taskType: finalType, agents })
        return
      }
      startPipeline(text, finalType, agents)
      return
    }

    let detectedType = 'general'
    let cleanTask = text
    let fromSlash = false
    try {
      const detected = await window.teamAPI?.detectTaskType?.(text)
      detectedType = detected?.taskType?.id || 'general'
      fromSlash = detected?.fromSlash || false
      cleanTask = fromSlash ? text.replace(/^\/\w+\s*/, '').trim() : text
    } catch (e) {
      const slashMatch = text.match(/^\/(\w+)/)
      if (slashMatch) {
        detectedType = slashMatch[1]
        fromSlash = true
      }
      cleanTask = text.replace(/^\/\w+\s*/, '').trim()
    }

    // CHECK: If slash command used but no topic provided
    if (fromSlash && cleanTask.length === 0 && detectedType !== 'brainstorm') {
      const icons = { quick: '⚡', research: '🔍', deep: '🔬', code: '💻', debug: '🐛', review: '👁️', plan: '📐', test: '🧪', apptest: '📱', doc: '📄', teamcode: '👥' }
      const labels = { quick: 'Quick Research', research: 'Mid Research', deep: 'Deep Research', code: 'Coding Task', debug: 'Debugging', review: 'Code Review', plan: 'Planning', test: 'Testing', apptest: 'App Testing', doc: 'Document', teamcode: 'Team Coding' }
      const actionWords = { code: 'build', debug: 'debug', review: 'review', test: 'test', plan: 'plan' }
      const icon = icons[detectedType] || '💬'
      const label = labels[detectedType] || detectedType
      const action = actionWords[detectedType] || 'research'
      addMsg({ type: 'system', content: `${icon} **${label}** selected.\n\nWhat would you like to ${action}?\n\nType your topic and press Send.`, agent: 'System', isSystem: true })
      setPendingTaskType(detectedType)
      return
    }

    const finalTask = cleanTask || text

    // If no senior agent selected yet, show picker
    if (!seniorAgent) {
      setShowSeniorPicker(true)
      setPendingTask({ message: finalTask, taskType: detectedType, agents })
      return
    }

    // Brainstorm chat mode — free conversation
    if (brainstormChatActive) {
      window.teamAPI?.sendBrainstormMessage?.({
        sessionId: currentSessionId, message: finalTask,
        targetAgents: null, allAgents: agents, models: selectedModels, executionModes,
      })
      return
    }

    setOriginalTask(finalTask)
    setCurrentTaskType(detectedType)
    startPipeline(finalTask, detectedType, agents)
  }

  function startPipeline(task, taskTypeId, agents) {
    setIsRunning(true)
    const newStatus = {}
    agents.forEach(a => { newStatus[a] = 'running' })
    setAgentStatus(newStatus)

    const workDir = workspaceDir || null
    window.teamAPI?.createSessionContext?.({
      sessionId: currentSessionId, task, taskType: taskTypeId, activeAgents: agents, mode: currentMode,
      executionModes, seniorAgent, workDir,
    })

    window.teamAPI?.startPipeline?.({
      sessionId: currentSessionId,
      taskType: taskTypeId,
      task,
      agents,
      models: selectedModels,
      subagentModels: selectedSubagentModels,
      executionModes,
      workDir,
      mode: currentMode,
      seniorAgent,
    })
  }

  function handleSeniorSelect(agentId) {
    const resolved = agentId === 'auto' ? getAgentKeys()[0] : agentId
    setSeniorAgent(resolved)
    setShowSeniorPicker(false)
    addMsg({ type: 'system', content: `👑 Senior Agent: ${profiles?.[resolved]?.name || resolved}`, agent: 'System', isSystem: true })

    if (pendingTask) {
      startPipeline(pendingTask.message, pendingTask.taskType, pendingTask.agents)
      setPendingTask(null)
    }
  }

  function handleStopAll() {
    window.teamAPI?.stopAllAgents?.(currentSessionId)
    setIsRunning(false)
  }

  function handleInput(e) {
    const val = e.target.value
    setInputText(val)
    if (val === '/') { setSlashMenuOpen(true); setSlashQuery('') }
    else if (val.startsWith('/')) { setSlashMenuOpen(true); setSlashQuery(val.slice(1).toLowerCase()) }
    else setSlashMenuOpen(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setSlashMenuOpen(false); setTagDropdownOpen(false) }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (slashMenuOpen) {
        const firstItem = filteredSlash.find(c => c.type !== 'header')
        if (firstItem) selectSlashCommand(firstItem)
        return
      }
      sendMessage()
    }
  }

  function selectSlashCommand(cmd) {
    if (cmd.cmd === '/stop') { handleStopAll(); setSlashMenuOpen(false); setInputText(''); return }
    if (cmd.cmd === '/clear') { setMessages([]); setSlashMenuOpen(false); setInputText(''); return }
    if (cmd.cmd === '/workspace') { window.teamAPI?.openWorkspace(); setSlashMenuOpen(false); setInputText(''); return }
    if (cmd.cmd === '/mode') {
      const newMode = currentMode === 'auto' ? 'manual' : 'auto'
      setCurrentMode(newMode)
      addMsg({ type: 'system', content: `⚡ Switched to ${newMode.toUpperCase()} mode`, agent: 'System', isSystem: true })
      setSlashMenuOpen(false); setInputText(''); return
    }
    if (cmd.cmd === '/model') {
      addMsg({ type: 'model-selector', content: 'Select models', agent: 'System', isSystem: true })
      setSlashMenuOpen(false); setInputText(''); return
    }
    if (cmd.cmd === '/workspace') {
      addMsg({ type: 'workspace-panel', content: 'Workspace Panel', agent: 'System', isSystem: true })
      setSlashMenuOpen(false); setInputText(''); return
    }
    setTaskType(cmd.label)
    setInputText(cmd.cmd + ' ')
    setSlashMenuOpen(false)
  }

  const slashCommands = [
    { type: 'header', label: 'TASK TYPES' },
    { icon: '⚡', cmd: '/quick', label: 'Quick Research', desc: 'Fast answers, low detail' },
    { icon: '🔍', cmd: '/research', label: 'Mid Research', desc: 'Standard research with sources' },
    { icon: '🔬', cmd: '/deep', label: 'Deep Research', desc: 'Thorough, multiple sources' },
    { icon: '💻', cmd: '/code', label: 'Coding Task', desc: 'Write or modify code' },
    { icon: '👁️', cmd: '/review', label: 'Code Review', desc: 'Review existing code' },
    { icon: '🐛', cmd: '/debug', label: 'Debugging', desc: 'Find and fix bugs' },
    { icon: '📐', cmd: '/plan', label: 'Planning', desc: 'Architecture and design' },
    { icon: '🧪', cmd: '/test', label: 'Testing', desc: 'Write unit tests' },
    { icon: '📱', cmd: '/apptest', label: 'App Testing', desc: 'E2E browser tests' },
    { icon: '📄', cmd: '/doc', label: 'File & Document', desc: 'Documentation' },
    { icon: '👥', cmd: '/teamcode', label: 'Team Coding', desc: 'All agents code simultaneously' },
    { icon: '💬', cmd: '/brainstorm', label: 'Brainstorm Chat', desc: 'Structured debate' },
    { type: 'header', label: 'ACTIONS' },
    { icon: '👑', cmd: '/senior', label: 'Change Senior Agent', desc: 'Assign new lead' },
    { icon: '🎯', cmd: '/model', label: 'Change Model', desc: 'Select AI models' },
    { icon: '⚡', cmd: '/mode', label: 'Switch Auto/Manual', desc: 'Toggle execution mode' },
    { icon: '⏹️', cmd: '/stop', label: 'Stop All Agents', desc: 'Halt execution' },
    { icon: '📁', cmd: '/workspace', label: 'Workspace Settings', desc: 'Manage local folder' },
    { icon: '🗑️', cmd: '/clear', label: 'Clear Chat', desc: 'Delete all messages' },
  ]

  const filteredSlash = slashCommands.filter(c =>
    c.type === 'header' || c.cmd.includes(slashQuery) || c.label.toLowerCase().includes(slashQuery)
  )

  const modelSelectorAgents = profiles ? ['claude', 'codex', 'gemini'].filter(id => profiles[id]) : []

  // ─── RENDER ─────────────────────────────────
  return (
    <div className="chat-container">
      {/* Research Panel overlay */}
      <ResearchPanel isOpen={showResearch} onClose={() => setShowResearch(false)}
        researchData={researchData} researchValidation={researchValidation} combinedDoc={combinedDoc} />

      {/* Active Agents row */}
      <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        {profiles && getAgentKeys().map(key => {
          const profile = profiles[key]
          if (!profile) return null
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-elevated)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: profile.color }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{profile.name}</span>
              {seniorAgent === key && <span style={{ fontSize: '10px' }}>👑</span>}
              {agentStatus[key] === 'running' && <span style={{ fontSize: '10px', color: 'var(--status-approved)', animation: 'pulse 1s infinite' }}>●</span>}
            </div>
          )
        })}

        {/* Research Panel button */}
        {hasResearch && (
          <button
            onClick={() => setShowResearch(true)}
            style={{
              background:   'transparent',
              border:       '1px solid var(--border-2)',
              borderRadius: 'var(--radius-sm)',
              color:        'var(--text-2)',
              fontSize:     12,
              padding:      '4px 10px',
              cursor:       'pointer',
              fontFamily:   'var(--font-body)',
              marginLeft:   'auto',
            }}
          >
            🔬 Research Panel
          </button>
        )}
      </div>

      {/* Brainstorm Chat Mode Indicator */}
      <BrainstormChatIndicator isActive={brainstormChatActive} profiles={profiles}
        activeAgents={getAgentKeys()} />

      {/* Messages Area */}
      <div className="chat-scroll-area">
        <div className="auto-badge">{currentMode === 'auto' ? '⚡ AUTO' : '✋ MANUAL'}</div>

        {messages.length === 0 && (
          <div className="empty-state">
            <span className="empty-state-icon">💬</span>
            <span className="empty-state-text">
              Type <code>/</code> to see all commands or just start typing
            </span>
          </div>
        )}

        {/* Senior Agent Picker (inline) */}
        {showSeniorPicker && profiles && (
          <SeniorAgentSelector activeAgents={getAgentKeys()} profiles={profiles} onSelect={handleSeniorSelect} />
        )}

        {messages.map((msg) => {
          const isBoss = msg.agent === 'You' || msg.agent === 'BOSS'
          const isSystem = msg.isSystem || msg.type === 'system'
          const isCheckpoint = msg.type === 'checkpoint'
          const isRoundHeader = msg.type === 'round-header'
          const color = getColor(msg.agent)

          if (isCheckpoint) {
            return <CheckpointMessage key={msg.id} checkpoint={msg.checkpoint} sessionId={currentSessionId}
              onAction={(action) => { if (action === 'cancelled') setIsRunning(false) }} />
          }

          if (isRoundHeader) {
            return <div key={msg.id} className="round-header">{msg.content}</div>
          }

          if (msg.type === 'error' && msg.error) {
            return <ErrorDisplay key={msg.id} error={msg.error} sessionId={currentSessionId}
              onAction={() => {}} />
          }

          if (isSystem) {
            if (msg.type === 'model-selector') {
              const selStyle = { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', cursor: 'pointer', outline: 'none', width: '100%' }
              return (
                <div key={msg.id} style={{ margin: '12px auto', maxWidth: 460, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span>🎯</span>
                    <h3 style={{ margin: 0, fontSize: 14 }}>Change Models</h3>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 16, marginTop: 0 }}>Changes apply to the next task sent.</p>

                  {profiles && getAgentKeys().map(key => {
                    const profile = profiles[key]
                    if (!profile) return null
                    const executionOptions = profile.executionModes || ['native']
                    const currentExecutionMode = executionModes[key] || profile.defaultExecutionMode || 'native'
                    const proxyActive = currentExecutionMode === 'proxy'
                    return (
                      <div key={key} style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: profile.color }} />
                          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{profile.name}</span>
                        </div>
                        <label style={{ color: 'var(--text-secondary)', fontSize: 11, display: 'block', marginBottom: 4 }}>Execution:</label>
                        <select value={currentExecutionMode} onChange={e => setExecutionModes(prev => ({ ...prev, [key]: e.target.value }))} disabled={executionOptions.length === 1} style={{ ...selStyle, marginBottom: 8, opacity: executionOptions.length === 1 ? 0.7 : 1 }}>
                          {executionOptions.map(mode => <option key={mode} value={mode}>{mode === 'proxy' ? 'Proxy' : 'Native CLI'}</option>)}
                        </select>
                        <label style={{ color: 'var(--text-secondary)', fontSize: 11, display: 'block', marginBottom: 4 }}>{key === 'codex' ? 'Main Model:' : 'Model:'}</label>
                        <select value={selectedModels[key] || profile.defaultModel} onChange={e => setSelectedModels(prev => ({ ...prev, [key]: e.target.value }))} style={{ ...selStyle, marginBottom: 6 }}>
                          {profile.models.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        {key === 'codex' && profile.subagentModels && (
                          <>
                            <label style={{ color: 'var(--text-secondary)', fontSize: 11, display: 'block', marginTop: 8, marginBottom: 4 }}>Subagent Model (lighter tasks):</label>
                            <select value={selectedSubagentModels?.codex || profile.defaultSubagentModel} onChange={e => setSelectedSubagentModels(prev => ({ ...prev, codex: e.target.value }))} style={{ ...selStyle, marginBottom: 6 }}>
                              {profile.subagentModels.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                          </>
                        )}
                        {profile.proxyModels && proxyActive && (
                          <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6 }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 10, margin: '0 0 8px', opacity: 0.8 }}>Proxy mode routes this provider through configured 9Router env. Native CLI uses local CLI auth and config.</p>
                            {profile.proxyModels.map(pm => (
                              <div key={pm.slot} style={{ marginBottom: 8 }}>
                                <label style={{ color: 'var(--text-secondary)', fontSize: 11, display: 'block', marginBottom: 3 }}>{pm.label}:</label>
                                <input type="text" placeholder={pm.description} value={selectedProxyModels[key]?.[pm.slot] || ''} onChange={e => setSelectedProxyModels(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [pm.slot]: e.target.value } }))} style={{ ...selStyle, fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }} />
                              </div>
                            ))}
                          </div>
                        )}
                        {key === 'gemini' && <p style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 4, marginBottom: 0, opacity: 0.7 }}>ℹ️ Uses your Google subscription directly. No proxy needed.</p>}
                      </div>
                    )
                  })}
                  <button onClick={() => {
                    const summary = getAgentKeys().map(k => {
                      const p = profiles[k]; if (!p) return ''
                      const model = selectedModels[k] || p.defaultModel
                      const label = p.models.find(m => m.value === model)?.label || model
                      let line = `${p.name}: ${label}`
                      if (k === 'codex') line += ` | Sub: ${selectedSubagentModels?.codex || p.defaultSubagentModel}`
                      line += ` | ${executionModes[k] === 'proxy' ? 'Proxy' : 'Native CLI'}`
                      return line
                    }).filter(Boolean).join('\n')
                    addMsg({ type: 'system', content: `✅ Models updated:\n${summary}`, agent: 'System', isSystem: true })
                    setMessages(prev => prev.filter(m => m.id !== msg.id))
                  }} style={{ marginTop: 4, width: '100%', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                    Apply Changes
                  </button>
                </div>
              )
            }
            if (msg.type === 'workspace-panel') {
              return (
                <div key={msg.id} style={{ margin: '12px auto', maxWidth: 400, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <span>📁</span>
                    <h3 style={{ margin: 0, fontSize: 14 }}>Workspace Settings</h3>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Current Path</p>
                    <code style={{ display: 'block', background: 'var(--bg-card)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '16px', wordBreak: 'break-all', fontSize: 12 }}>
                      {workspaceDir || '~/no1team/workspace'}
                    </code>
                    <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                      <button className="btn-secondary" onClick={() => window.teamAPI?.chooseWorkspaceFolder?.().then(dir => dir && setWorkspaceDir(dir))}>
                        Choose Different Folder
                      </button>
                      <button className="btn-secondary" onClick={() => window.teamAPI?.openWorkspaceInExplorer?.(workspaceDir)} disabled={!workspaceDir && !window.teamAPI?.openWorkspaceInExplorer}>
                        Open in Explorer
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => { setMessages(prev => prev.filter(m => m.id !== msg.id)) }}
                    style={{ marginTop: 16, width: '100%', padding: '8px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}
                  >
                    Close
                  </button>
                </div>
              )
            }
            if (msg.type === 'research-notification') {
              return (
                <div key={msg.id} style={{
                  background:   'var(--surface-2)',
                  border:       '1px solid var(--accent-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding:      '14px 18px',
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'space-between',
                  margin:       '8px 0',
                }}>
                  <div>
                    <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>
                      🔬 Research Complete
                    </span>
                    <p style={{ color: 'var(--text-2)', fontSize: 12, margin: '4px 0 0' }}>
                      {msg.agentCount} agents submitted research to the Research Panel.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowResearch(true)}
                    style={{
                      background:   'var(--accent-dim)',
                      border:       '1px solid var(--accent-border)',
                      borderRadius: 'var(--radius-md)',
                      color:        'var(--accent)',
                      fontSize:     12,
                      padding:      '6px 12px',
                      cursor:       'pointer',
                    }}
                  >
                    View Research →
                  </button>
                </div>
              )
            }
            return (
              <div key={msg.id} style={{ textAlign: 'center', color: 'var(--accent)', fontSize: '12px', padding: '8px 0', opacity: 0.8 }}>
                {msg.content}
              </div>
            )
          }

          return (
            <div key={msg.id} className={`msg-wrapper ${isBoss ? 'msg-boss' : 'msg-agent'} ${msg.agent === msg.agent ? 'same-agent' : ''}`}>
              {!isBoss && (
                <div className="msg-header">
                  <span className="msg-dot" style={{ backgroundColor: color }}></span>
                  <span className="msg-name" style={{ color }}>{msg.agent}</span>
                  {seniorAgent && msg.agentId === seniorAgent && <span className="msg-senior-star">⭐</span>}
                  {msg.inProgress && <span style={{ fontSize: '10px', color: 'var(--status-approved)', animation: 'pulse 1s infinite' }}>typing...</span>}
                  <span className="msg-time">{new Date(msg.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
                </div>
              )}
              {isBoss && (
                <div className="msg-header" style={{ alignSelf: 'flex-end' }}>
                  <span className="msg-time">{new Date(msg.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
                  <span className="msg-name" style={{ color: 'var(--agent-boss)', marginLeft: 'auto' }}>You</span>
                  <span className="msg-dot" style={{ backgroundColor: 'var(--agent-boss)' }}></span>
                </div>
              )}
              <div className={`msg-bubble ${isBoss ? 'msg-bubble-boss' : ''}`} style={!isBoss ? { borderLeft: `2px solid ${color}99` } : {}}>
                <div className="msg-content">{msg.content}</div>
              </div>
            </div>
          )
        })}

        {/* Typing indicators */}
        {Object.entries(agentStatus)
          .filter(([_, status]) => status === 'running')
          .map(([agentId]) => (
            <div key={agentId} className="typing-indicator"
              style={{ color: profiles?.[agentId]?.color || 'var(--text-secondary)' }}>
              <span className="typing-dot">●</span>
              <span>{profiles?.[agentId]?.name || agentId} is working...</span>
            </div>
          ))
        }

        {/* Export options after completion */}
        {pipelineComplete && lastSessionData && (
          <ExportOptions sessionData={lastSessionData} onExported={(filePath) => {
            addMsg({ type: 'system', content: `📤 Exported to: ${filePath}`, agent: 'System', isSystem: true })
          }} />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Messaging Bar */}
      <div className="messaging-bar">
        {showSeniorPicker && (
          <div className="slash-menu" style={{ padding: '16px', bottom: '100%', marginBottom: '8px' }}>
            <SeniorAgentSelector 
              activeAgents={getAgentKeys()} 
              profiles={profiles} 
              onSelect={handleSeniorSelect} 
            />
          </div>
        )}

        {slashMenuOpen && (
          <div className="slash-menu">
            {filteredSlash.map((item, i) => {
              if (item.type === 'header') return <div key={i} className="slash-section-title">{item.label}</div>
              return (
                <div key={i} className="slash-item" onClick={() => selectSlashCommand(item)}>
                  <div className="slash-icon">{item.icon}</div>
                  <div className="slash-cmd">{item.cmd}</div>
                  <div className="slash-desc">{item.desc}</div>
                </div>
              )
            })}
          </div>
        )}

        {tagDropdownOpen && (
          <div className="tag-dropdown">
            <div className="slash-item" onClick={() => { setTarget('all'); setTagDropdownOpen(false) }}>
              <div className="slash-icon">👥</div><div className="slash-desc">Everyone</div>
            </div>
            {['claude', 'codex', 'gemini'].map(id => (
              <div key={id} className="slash-item" onClick={() => { setTarget(id); setTagDropdownOpen(false) }}>
                <div className="slash-icon">{id === 'claude' ? '🟠' : id === 'codex' ? '⬜' : '🔵'}</div>
                <div className="slash-desc">{profiles?.[id]?.name || id}</div>
              </div>
            ))}
          </div>
        )}

        <div className="messaging-row">
          <div className="input-wrapper">
            <button className="tag-btn" onClick={() => setTagDropdownOpen(!tagDropdownOpen)}>
              [@]
            </button>
            <textarea value={inputText} onChange={handleInput} onKeyDown={handleKeyDown}
              placeholder="Type a message or / for commands..." className="msg-input" rows={1} />
            {isRunning ? (
              <button className="btn-danger" onClick={handleStopAll} style={{ margin: 6, height: 30, padding: '0 14px' }}>⏹ Stop</button>
            ) : (
              <button className="btn-send" onClick={sendMessage} disabled={!inputText.trim() && !taskType}>Send →</button>
            )}
          </div>
          
          {taskType && (
            <div className="task-type-tag">
              {taskType} <span className="task-type-close" onClick={() => { setTaskType(null); setInputText('') }}>×</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
