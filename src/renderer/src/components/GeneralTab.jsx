import React, { useState, useEffect, useRef, useCallback } from 'react'
import WorldGlobe from './WorldGlobe'
import CheckpointMessage from './CheckpointMessage'
import SeniorAgentSelector from './SeniorAgentSelector'
import ResearchPanel from './ResearchPanel'
import { BrainstormChatIndicator } from './BrainstormChatMode'
import ErrorDisplay from './ErrorDisplay'
import ExportOptions from './ExportOptions'

const AGENT_COLORS = {
  claude:    'var(--agent-claude)',
  codex:     'var(--agent-codex)',
  gemini:    'var(--agent-gemini)',
  aider:     'var(--agent-aider)',
  opencode:  'var(--agent-opencode)',
}

const AGENT_COLOR_RAW = {
  claude:    '#FB923C',
  codex:     '#A78BFA',
  gemini:    '#60A5FA',
  aider:     '#4ADE80',
  opencode:  '#F472B6',
}

function getAgentColor(agentId, agentName) {
  if (!agentId && !agentName) return 'var(--text-2)'
  if (agentId && AGENT_COLORS[agentId]) return AGENT_COLORS[agentId]
  if (!agentName) return 'var(--text-2)'
  const n = agentName.toLowerCase()
  if (n.includes('claude'))    return 'var(--agent-claude)'
  if (n.includes('codex'))     return 'var(--agent-codex)'
  if (n.includes('gemini'))    return 'var(--agent-gemini)'
  if (n.includes('aider'))     return 'var(--agent-aider)'
  if (n.includes('opencode'))  return 'var(--agent-opencode)'
  if (n === 'you' || n === 'boss') return 'var(--agent-boss)'
  if (n === 'system')          return 'var(--agent-system)'
  return 'var(--text-2)'
}

function formatTime(ts) {
  const d = new Date(ts)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 5)   return 'just now'
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/* Parses message content and wraps code blocks in a header + copy UI */
function MessageContent({ content }) {
  const [copied, setCopied] = useState(null)

  const copyCode = useCallback((code, blockIdx) => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(blockIdx)
      setTimeout(() => setCopied(null), 1800)
    })
  }, [])

  if (!content || typeof content !== 'string') return null

  // Split on fenced code blocks
  const CODE_BLOCK_RE = /```(\w*)\n?([\s\S]*?)```/g
  const parts = []
  let lastIdx = 0
  let match
  let blockIdx = 0

  while ((match = CODE_BLOCK_RE.exec(content)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'text', content: content.slice(lastIdx, match.index) })
    }
    parts.push({ type: 'code', lang: match[1] || 'code', code: match[2], idx: blockIdx++ })
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIdx) })
  }

  if (parts.length === 0) {
    return <div className="msg-content">{content}</div>
  }

  return (
    <div className="msg-content">
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return part.content ? <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part.content}</span> : null
        }
        const isCopied = copied === part.idx
        return (
          <div key={i} className="code-block">
            <div className="code-block-header">
              <span className="code-lang">{part.lang || 'code'}</span>
              <button className={`code-copy-btn ${isCopied ? 'copied' : ''}`}
                onClick={() => copyCode(part.code, part.idx)}>
                {isCopied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <pre>{part.code}</pre>
          </div>
        )
      })}
    </div>
  )
}


export default function GeneralTab({ sessionId, onTitleUpdate }) {
  const [messages, setMessages]               = useState([])
  const [inputText, setInputText]             = useState('')
  const [target, setTarget]                   = useState('all')
  const [isRunning, setIsRunning]             = useState(false)
  const [agentStatus, setAgentStatus]         = useState({})
  const bottomRef = useRef(null)

  // Stable refs so async event-listener callbacks never read stale closure values
  const profilesRef    = useRef(null)
  const seniorAgentRef = useRef(null)

  const [seniorAgent, setSeniorAgent]         = useState(null)
  const [showSeniorPicker, setShowSeniorPicker] = useState(false)
  const [pendingTask, setPendingTask]         = useState(null)
  const [researchData, setResearchData]       = useState({})
  const [researchValidation, setResearchValidation] = useState(null)
  const [combinedDoc, setCombinedDoc]         = useState(null)
  const [showResearch, setShowResearch]       = useState(false)
  const [hasResearch, setHasResearch]         = useState(false)
  const [currentMode, setCurrentMode]         = useState('manual')

  const [brainstormChatActive, setBrainstormChatActive] = useState(false)
  const [sendBackCount, setSendBackCount]     = useState(0)
  const [originalTask, setOriginalTask]       = useState('')
  const [currentTaskType, setCurrentTaskType] = useState('general')

  const [pipelineComplete, setPipelineComplete] = useState(false)
  const [lastSessionData, setLastSessionData] = useState(null)
  const [workspaceDir, setWorkspaceDir]       = useState('')

  const [slashMenuOpen, setSlashMenuOpen]     = useState(false)
  const [slashQuery, setSlashQuery]           = useState('')
  const [taskType, setTaskType]               = useState(null)
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)

  const [profiles, setProfiles]               = useState(null)
  const [selectedModels, setSelectedModels]   = useState({})
  const [selectedSubagentModels, setSelectedSubagentModels] = useState({ codex: 'gpt-5.4-mini' })
  const [selectedProxyModels, setSelectedProxyModels] = useState({
    claude: { opus: '', sonnet: '', haiku: '' },
    codex:  { main: '' },
  })
  const [executionModes, setExecutionModes]   = useState({})
  const [pendingTaskType, setPendingTaskType] = useState(null)
  const [currentSessionId, setCurrentSessionId] = useState(sessionId)

  // Load provider profiles
  useEffect(() => {
    async function loadProfiles() {
      if (!window.teamAPI?.getProviderProfiles) return
      try {
        const p = await window.teamAPI.getProviderProfiles()
        setProfiles(p)
        profilesRef.current = p
        const defaults = {}, execDefaults = {}
        Object.values(p).forEach(profile => {
          defaults[profile.id] = profile.defaultModel
          execDefaults[profile.id] = profile.defaultExecutionMode || 'native'
        })
        setSelectedModels(defaults)
        setExecutionModes(execDefaults)
      } catch (e) { console.error('Failed to load profiles:', e) }
    }
    loadProfiles()
  }, [])

  // Keep refs in sync so async callbacks always read fresh values
  useEffect(() => { profilesRef.current = profiles },    [profiles])
  useEffect(() => { seniorAgentRef.current = seniorAgent }, [seniorAgent])

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
      } else setMessages([])
    }
    load()
  }, [sessionId])

  // Save session — include all stateful values so stored data stays fresh
  useEffect(() => {
    if (!currentSessionId || messages.length === 0) return
    const num = currentSessionId.replace('session-', '')
    const firstUserMsg = messages.find(m => m.agent === 'You')
    const title = firstUserMsg?.content?.slice(0, 80).trim() || 'New Session'
    window.teamAPI?.session?.saveState(num, {
      title, messages, seniorAgent, currentMode, workspaceDir,
      lastUpdated: new Date().toISOString()
    })
    // Sync title back to sidebar
    if (firstUserMsg && onTitleUpdate) onTitleUpdate(title)
  }, [messages, currentSessionId, seniorAgent, currentMode, workspaceDir])

  function addMsg(msg) {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), timestamp: new Date(), ...msg }])
  }

  // Agent event listeners
  useEffect(() => {
    if (!window.teamAPI?.onAgentChunk) return
    const removers = []

    removers.push(window.teamAPI.onAgentChunk((data) => {
      if (data.sessionId !== currentSessionId) {
        console.log('[session mismatch]', data.sessionId, '!=', currentSessionId)
        return
      }
      setMessages(prev => {
        let foundIdx = -1
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].agentId === data.agentId && prev[i].inProgress) { foundIdx = i; break }
        }
        if (foundIdx !== -1) {
          const next = [...prev]
          next[foundIdx] = { ...next[foundIdx], content: next[foundIdx].content + data.content }
          return next
        }
        return [...prev, {
          id: Date.now() + Math.random(), agent: data.agent, agentId: data.agentId,
          content: data.content, inProgress: true, timestamp: new Date()
        }]
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

  // Pipeline event listeners
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
        const sr = seniorAgentRef.current
        addMsg({ agent: profilesRef.current?.[sr]?.name || 'Senior Agent', agentId: sr, content: data.combinedDoc })
      }
    }))

    removers.push(window.teamAPI.onPipelineEvent('pipeline-cancelled', (data) => {
      if (data.sessionId !== currentSessionId) return
      setIsRunning(false)
      addMsg({ type: 'system', content: `Pipeline cancelled${data.reason ? ': ' + data.reason : ''}.`, agent: 'System', isSystem: true })
    }))

    removers.push(window.teamAPI.onPipelineEvent('auto-approved', (data) => {
      if (data.sessionId !== currentSessionId) return
      addMsg({ type: 'system', content: `⚡ Auto-approved: ${data.message}`, agent: 'System', isSystem: true })
    }))

    removers.push(window.teamAPI.onPipelineEvent('brainstorm-mode-active', (data) => {
      if (data.sessionId !== currentSessionId) return
      setBrainstormChatActive(true)
      window.teamAPI?.activateBrainstormChat?.(currentSessionId)
    }))

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

    removers.push(window.teamAPI.onSessionSavedToBrain?.((data) => {
      addMsg({ type: 'system', content: `💾 Session saved to Brain: ${data.folderRel}`, agent: 'System', isSystem: true })
    }))

    removers.push(window.teamAPI.onShowError?.((data) => {
      if (data.sessionId && data.sessionId !== currentSessionId) return
      addMsg({ type: 'error', error: data, agent: 'System', isSystem: true })
    }))

    removers.push(window.teamAPI.onPipelineEvent?.('pipeline-complete', (data) => {
      if (data.sessionId !== currentSessionId) return
      const sr = seniorAgentRef.current
      setPipelineComplete(true)
      setIsRunning(false)
      if (data.finalAnswer?.trim()) {
        addMsg({ agent: profilesRef.current?.[sr]?.name || 'Senior Agent', agentId: sr, content: data.finalAnswer })
      }
      addMsg({ type: 'system', content: '✅ Pipeline complete. Session saved.', agent: 'System', isSystem: true })
      setLastSessionData(prev => ({
        sessionName: prev?.task?.slice(0, 40) || 'Session',
        taskType: prev?.taskType || 'general', task: prev?.task,
        finalAnswer: data.finalAnswer, date: new Date().toISOString().slice(0, 10),
        agents: profilesRef.current ? Object.keys(profilesRef.current) : ['claude','codex','gemini'],
        seniorAgent: sr,
      }))
    }))

    return () => removers.forEach(fn => fn?.())
  }, [currentSessionId])

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function getAgentKeys() {
    const available = profiles ? Object.keys(profiles) : ['claude', 'codex', 'gemini']
    if (target === 'all') return available
    return available.includes(target) ? [target] : available
  }

  async function sendMessage() {
    const text = inputText.trim()
    if (!text || isRunning) return
    const agents = getAgentKeys()

    addMsg({ agent: 'You', content: text })
    setInputText('')
    setTaskType(null)
    setSlashMenuOpen(false)

    if (pendingTaskType) {
      const finalType = pendingTaskType
      setPendingTaskType(null)
      setOriginalTask(text)
      setCurrentTaskType(finalType)
      if (!seniorAgent) { setShowSeniorPicker(true); setPendingTask({ message: text, taskType: finalType, agents }); return }
      startPipeline(text, finalType, agents)
      return
    }

    let detectedType = 'general', cleanTask = text, fromSlash = false
    try {
      const detected = await window.teamAPI?.detectTaskType?.(text)
      detectedType = detected?.taskType?.id || 'general'
      fromSlash    = detected?.fromSlash || false
      cleanTask    = fromSlash ? text.replace(/^\/\w+\s*/, '').trim() : text
    } catch {
      const slashMatch = text.match(/^\/(\w+)/)
      if (slashMatch) { detectedType = slashMatch[1]; fromSlash = true }
      cleanTask = text.replace(/^\/\w+\s*/, '').trim()
    }

    if (fromSlash && cleanTask.length === 0 && detectedType !== 'brainstorm') {
      const icons   = { quick:'⚡', research:'🔍', deep:'🔬', code:'💻', debug:'🐛', review:'👁️', plan:'📐', test:'🧪', apptest:'📱', doc:'📄', teamcode:'👥' }
      const labels  = { quick:'Quick Research', research:'Mid Research', deep:'Deep Research', code:'Coding Task', debug:'Debugging', review:'Code Review', plan:'Planning', test:'Testing', apptest:'App Testing', doc:'Document', teamcode:'Team Coding' }
      const actions = { code:'build', debug:'debug', review:'review', test:'test', plan:'plan' }
      const icon = icons[detectedType] || '💬'
      const label = labels[detectedType] || detectedType
      const action = actions[detectedType] || 'research'
      addMsg({ type: 'system', content: `${icon} **${label}** selected.\nWhat would you like to ${action}? Type your topic and press Send.`, agent: 'System', isSystem: true })
      setPendingTaskType(detectedType)
      return
    }

    const finalTask = cleanTask || text
    if (!seniorAgent) { setShowSeniorPicker(true); setPendingTask({ message: finalTask, taskType: detectedType, agents }); return }

    if (brainstormChatActive) {
      window.teamAPI?.sendBrainstormMessage?.({ sessionId: currentSessionId, message: finalTask, targetAgents: null, allAgents: agents, models: selectedModels, executionModes })
      return
    }

    setOriginalTask(finalTask)
    setCurrentTaskType(detectedType)
    startPipeline(finalTask, detectedType, agents)
  }

  function startPipeline(task, taskTypeId, agents) {
    // Reset previous run state so a fresh pipeline starts clean
    setPipelineComplete(false)
    setBrainstormChatActive(false)
    setLastSessionData({ task, taskType: taskTypeId })
    setHasResearch(false)
    setResearchData({})
    setCombinedDoc(null)
    setIsRunning(true)
    const newStatus = {}
    agents.forEach(a => { newStatus[a] = 'running' })
    setAgentStatus(newStatus)

    const workDir = workspaceDir?.trim() || null
    window.teamAPI?.createSessionContext?.({ sessionId: currentSessionId, task, taskType: taskTypeId, activeAgents: agents, mode: currentMode, executionModes, seniorAgent, workDir })
    window.teamAPI?.startPipeline?.({ sessionId: currentSessionId, taskType: taskTypeId, task, agents, models: selectedModels, subagentModels: selectedSubagentModels, executionModes, workDir, mode: currentMode, seniorAgent })
  }

  function handleSeniorSelect(agentId) {
    let resolved = agentId
    if (agentId === 'auto') {
      // Task-type-aware auto selection: pick the best agent for the job
      const taskMap = { code: 'codex', debug: 'claude', review: 'claude', test: 'codex', apptest: 'codex', doc: 'gemini', plan: 'gemini', research: 'gemini', deep: 'gemini', quick: 'claude' }
      const preferred = taskMap[currentTaskType]
      const available = getAgentKeys()
      resolved = (preferred && available.includes(preferred)) ? preferred : available[0]
    }
    setSeniorAgent(resolved)
    seniorAgentRef.current = resolved
    setShowSeniorPicker(false)
    addMsg({ type: 'system', content: `👑 Senior Agent: ${profiles?.[resolved]?.name || resolved}`, agent: 'System', isSystem: true })
    if (pendingTask) { startPipeline(pendingTask.message, pendingTask.taskType, pendingTask.agents); setPendingTask(null) }
  }

  function handleStopAll() { window.teamAPI?.stopAllAgents?.(currentSessionId); setIsRunning(false) }

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
        const first = filteredSlash.find(c => c.type !== 'header')
        if (first) { selectSlashCommand(first); return }
      }
      sendMessage()
    }
  }

  function selectSlashCommand(cmd) {
    if (cmd.cmd === '/stop')      { handleStopAll(); setSlashMenuOpen(false); setInputText(''); return }
    if (cmd.cmd === '/clear')     { setMessages([]); setSlashMenuOpen(false); setInputText(''); return }
    if (cmd.cmd === '/workspace') {
      addMsg({ type: 'workspace-panel', content: 'Workspace', agent: 'System', isSystem: true })
      setSlashMenuOpen(false); setInputText(''); return
    }
    if (cmd.cmd === '/senior') {
      setShowSeniorPicker(true)
      setSlashMenuOpen(false); setInputText(''); return
    }
    if (cmd.cmd === '/mode') {
      const newMode = currentMode === 'auto' ? 'manual' : 'auto'
      setCurrentMode(newMode)
      addMsg({ type: 'system', content: `⚡ Switched to ${newMode.toUpperCase()} mode. ${newMode === 'auto' ? 'Intermediate checkpoints will be auto-approved — only the final answer needs your review.' : 'All checkpoints require your approval.'}`, agent: 'System', isSystem: true })
      setSlashMenuOpen(false); setInputText(''); return
    }
    if (cmd.cmd === '/model') {
      addMsg({ type: 'model-selector', content: 'Select models', agent: 'System', isSystem: true })
      setSlashMenuOpen(false); setInputText(''); return
    }
    if (cmd.cmd === '/retry') {
      setSlashMenuOpen(false); setInputText('')
      if (!originalTask || !currentTaskType) {
        addMsg({ type: 'system', content: '⚠️ No previous task to retry. Run a task first.', agent: 'System', isSystem: true })
        return
      }
      if (isRunning) {
        addMsg({ type: 'system', content: '⚠️ A task is already running. Stop it first with /stop.', agent: 'System', isSystem: true })
        return
      }
      addMsg({ type: 'system', content: `🔁 Retrying: "${originalTask.slice(0, 80)}" as ${currentTaskType}`, agent: 'System', isSystem: true })
      startPipeline(originalTask, currentTaskType, getAgentKeys())
      return
    }
    if (cmd.cmd === '/history') {
      setSlashMenuOpen(false); setInputText('')
      const msgCount = messages.filter(m => m.agent === 'You').length
      const agentMsgs = messages.filter(m => m.agent !== 'You' && !m.isSystem).length
      const hasPipeline = pipelineComplete
      const lines = [
        `📊 **Session Stats**`,
        `Messages sent: ${msgCount}`,
        `Agent responses: ${agentMsgs}`,
        `Mode: ${currentMode.toUpperCase()}`,
        seniorAgent ? `Senior Agent: ${profiles?.[seniorAgent]?.name || seniorAgent}` : 'Senior Agent: not assigned',
        originalTask ? `Last task: "${originalTask.slice(0, 60)}" (${currentTaskType})` : 'No tasks run yet',
        hasPipeline ? 'Last pipeline: complete ✅' : '',
        workspaceDir ? `Workspace: ${workspaceDir}` : 'Workspace: default',
      ].filter(Boolean).join('\n')
      addMsg({ type: 'system', content: lines, agent: 'System', isSystem: true })
      return
    }
    if (cmd.cmd === '/agents') {
      setSlashMenuOpen(false); setInputText('')
      const agentKeys = getAgentKeys()
      const lines = [
        `🤖 **Active Agents (${agentKeys.length})**`,
        ...agentKeys.map(key => {
          const p = profiles?.[key]
          const role = key === seniorAgent ? '👑 Senior' : '🔵 Sub-agent'
          const model = selectedModels[key] || p?.defaultModel || '—'
          const exec = executionModes[key] === 'proxy' ? 'Proxy' : 'Native CLI'
          return `${role} ${p?.name || key} — ${model} — ${exec}`
        }),
      ].join('\n')
      addMsg({ type: 'system', content: lines, agent: 'System', isSystem: true })
      return
    }
    setTaskType(cmd.label)
    setInputText(cmd.cmd + ' ')
    setSlashMenuOpen(false)
  }

  const slashCommands = [
    { type: 'header', label: 'TASK TYPES' },
    { icon: '⚡', cmd: '/quick',     label: 'Quick Research',  desc: 'Fast answers, low detail' },
    { icon: '🔍', cmd: '/research',  label: 'Mid Research',    desc: 'Standard research with sources' },
    { icon: '🔬', cmd: '/deep',      label: 'Deep Research',   desc: 'Thorough, multiple sources' },
    { icon: '💻', cmd: '/code',      label: 'Coding Task',     desc: 'Write or modify code' },
    { icon: '👁️', cmd: '/review',   label: 'Code Review',     desc: 'Review existing code' },
    { icon: '🐛', cmd: '/debug',     label: 'Debugging',       desc: 'Find and fix bugs' },
    { icon: '📐', cmd: '/plan',      label: 'Planning',        desc: 'Architecture and design' },
    { icon: '🧪', cmd: '/test',      label: 'Testing',         desc: 'Write unit tests' },
    { icon: '📱', cmd: '/apptest',   label: 'App Testing',     desc: 'E2E browser tests' },
    { icon: '📄', cmd: '/doc',       label: 'Document',        desc: 'Documentation' },
    { icon: '👥', cmd: '/teamcode',  label: 'Team Coding',     desc: 'All agents code simultaneously' },
    { icon: '💬', cmd: '/brainstorm',label: 'Brainstorm',      desc: 'Structured debate' },
    { type: 'header', label: 'ACTIONS' },
    { icon: '🔁', cmd: '/retry',     label: 'Retry Last Task', desc: 'Re-run the previous task' },
    { icon: '👑', cmd: '/senior',    label: 'Change Senior',   desc: 'Assign new lead' },
    { icon: '🎯', cmd: '/model',     label: 'Change Model',    desc: 'Select AI models' },
    { icon: '⚡', cmd: '/mode',      label: 'Toggle Auto/Manual', desc: 'Switch execution mode' },
    { icon: '📊', cmd: '/history',   label: 'Session Info',    desc: 'Show current session stats' },
    { icon: '🤖', cmd: '/agents',    label: 'Agent Status',    desc: 'Show active agents and roles' },
    { icon: '⏹️', cmd: '/stop',     label: 'Stop Agents',     desc: 'Halt execution' },
    { icon: '📁', cmd: '/workspace', label: 'Workspace',       desc: 'Manage local folder' },
    { icon: '🗑️', cmd: '/clear',    label: 'Clear Chat',      desc: 'Delete all messages' },
  ]

  const filteredSlash = (() => {
    if (!slashQuery) return slashCommands
    // Filter matching commands first
    const matches = slashCommands.filter(c => c.type !== 'header' && (c.cmd.includes(slashQuery) || c.label.toLowerCase().includes(slashQuery)))
    if (matches.length === 0) return matches
    // Rebuild with section headers only if they have matching children
    const result = []
    let pendingHeader = null
    for (const item of slashCommands) {
      if (item.type === 'header') { pendingHeader = item; continue }
      if (matches.includes(item)) {
        if (pendingHeader) { result.push(pendingHeader); pendingHeader = null }
        result.push(item)
      }
    }
    return result
  })()

  // ── Select styles for model selector
  const selStyle = {
    background: 'var(--surface-3)', border: '1px solid var(--border-2)',
    color: 'var(--text-1)', borderRadius: 'var(--radius-md)',
    padding: '8px 10px', fontSize: '13px', cursor: 'pointer', outline: 'none', width: '100%',
  }

  // ── RENDER ──────────────────────────────────────────────────
  return (
    <div className="chat-container">
      <ResearchPanel isOpen={showResearch} onClose={() => setShowResearch(false)}
        researchData={researchData} researchValidation={researchValidation} combinedDoc={combinedDoc} />

      {/* Agent bar */}
      <div className="agent-bar">
        {profiles && getAgentKeys().map(key => {
          const profile = profiles[key]
          if (!profile) return null
          const color = AGENT_COLORS[key] || 'var(--text-2)'
          const running = agentStatus[key] === 'running'
          const rawColor = AGENT_COLOR_RAW[key] || '#4361EE'
          return (
            <div key={key} className={`agent-chip ${running ? 'running' : ''}`}
              style={running ? {
                borderColor: rawColor + '55',
                boxShadow: `0 0 12px ${rawColor}22, inset 0 0 8px ${rawColor}08`,
              } : {}}>
              <div className="agent-chip-dot" style={{
                background: color,
                boxShadow: running ? `0 0 6px ${rawColor}99` : 'none',
              }} />
              <span className="agent-chip-name" style={{ color: running ? 'var(--text-1)' : 'var(--text-2)' }}>
                {profile.name}
              </span>
              {seniorAgent === key && <span className="agent-chip-crown">👑</span>}
              {running && <span className="agent-chip-pulse" />}
            </div>
          )
        })}

        {hasResearch && (
          <button onClick={() => setShowResearch(true)} style={{
            marginLeft: 'auto', background: 'transparent',
            border: '1px solid var(--border-2)', borderRadius: 'var(--radius-full)',
            color: 'var(--text-2)', fontSize: 12, padding: '3px 12px', cursor: 'pointer',
            fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            🔬 Research Panel
          </button>
        )}
      </div>

      <BrainstormChatIndicator isActive={brainstormChatActive} profiles={profiles} activeAgents={getAgentKeys()} />

      {/* Messages area */}
      <div className="chat-scroll-area">
        <div className={`mode-badge ${currentMode === 'auto' ? 'auto' : 'manual'}`}>
          {currentMode === 'auto' ? '⚡ AUTO' : '✋ MANUAL'}
        </div>

        {/* Empty state */}
        {messages.length === 0 && !showSeniorPicker && (
          <div className="empty-state">
            <WorldGlobe size={60} style={{ marginBottom: 28 }} />
            <div className="empty-state-title">No. 1 Team</div>
            <div className="empty-state-sub">Your multi-agent AI command center is ready</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
              {['/research', '/code', '/debug', '/plan', '/brainstorm'].map(cmd => (
                <button key={cmd} onClick={() => { setInputText(cmd + ' '); setSlashMenuOpen(false) }}
                  style={{
                    background: 'var(--surface-3)', border: '1px solid var(--border-3)',
                    borderRadius: 'var(--radius-full)', padding: '4px 12px',
                    font: '400 12px var(--font-mono)', color: 'var(--accent)',
                    cursor: 'pointer',
                  }}>
                  {cmd}
                </button>
              ))}
            </div>
            <button className="empty-state-btn" onClick={() => { setInputText('/'); setSlashMenuOpen(true); setSlashQuery('') }}>
              + New Task
            </button>
          </div>
        )}

        {/* Senior Agent picker is shown in the messaging bar — not duplicated here */}

        {messages.map((msg, idx) => {
          const isBoss = msg.agent === 'You' || msg.agent === 'BOSS'
          const isSystem = msg.isSystem || msg.type === 'system'
          const isCheckpoint = msg.type === 'checkpoint'
          const isRoundHeader = msg.type === 'round-header'
          const color = getAgentColor(msg.agentId, msg.agent)

          if (isCheckpoint) {
            return <CheckpointMessage key={msg.id} checkpoint={msg.checkpoint} sessionId={currentSessionId}
              onAction={(action) => { if (action === 'cancelled') setIsRunning(false) }} />
          }

          if (isRoundHeader) {
            return <div key={msg.id} className="round-header">{msg.content}</div>
          }

          if (msg.type === 'error' && msg.error) {
            return <ErrorDisplay key={msg.id} error={msg.error} sessionId={currentSessionId} onAction={() => {}} />
          }

          if (isSystem) {
            // Model selector card
            if (msg.type === 'model-selector') {
              return (
                <div key={msg.id} style={{
                  margin: '16px 0', background: 'var(--surface-2)',
                  border: '1px solid var(--border-3)', borderRadius: 'var(--radius-lg)', padding: 20,
                  maxWidth: 480,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>🎯</span>
                    <span style={{ font: '600 14px var(--font-display)', color: 'var(--text-1)' }}>Change Models</span>
                  </div>
                  <p style={{ font: '400 12px var(--font-body)', color: 'var(--text-3)', margin: '4px 0 18px' }}>
                    Changes apply to the next task.
                  </p>

                  {profiles && getAgentKeys().map(key => {
                    const profile = profiles[key]
                    if (!profile) return null
                    const executionOptions = profile.executionModes || ['native']
                    const currentExec = executionModes[key] || 'native'
                    const proxyActive = currentExec === 'proxy'
                    return (
                      <div key={key} style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border-1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: AGENT_COLORS[key] || 'var(--text-3)' }} />
                          <span style={{ font: '600 13px var(--font-display)', color: 'var(--text-1)' }}>{profile.name}</span>
                        </div>
                        {executionOptions.length > 1 && (
                          <div style={{ marginBottom: 10 }}>
                            <label style={{ display: 'block', font: '500 10px var(--font-body)', color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Execution</label>
                            <select value={currentExec} onChange={e => setExecutionModes(prev => ({ ...prev, [key]: e.target.value }))} style={selStyle}>
                              {executionOptions.map(m => <option key={m} value={m}>{m === 'proxy' ? 'Proxy' : 'Native CLI'}</option>)}
                            </select>
                          </div>
                        )}
                        <label style={{ display: 'block', font: '500 10px var(--font-body)', color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{key === 'codex' ? 'Main Model' : 'Model'}</label>
                        <select value={selectedModels[key] || profile.defaultModel} onChange={e => setSelectedModels(prev => ({ ...prev, [key]: e.target.value }))} style={selStyle}>
                          {profile.models.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        {key === 'codex' && profile.subagentModels && (
                          <div style={{ marginTop: 10 }}>
                            <label style={{ display: 'block', font: '500 10px var(--font-body)', color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subagent Model</label>
                            <select value={selectedSubagentModels?.codex || ''} onChange={e => setSelectedSubagentModels(prev => ({ ...prev, codex: e.target.value }))} style={selStyle}>
                              {profile.subagentModels.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                          </div>
                        )}
                        {key === 'gemini' && <p style={{ font: '400 11px var(--font-body)', color: 'var(--text-3)', margin: '8px 0 0' }}>Uses your Google subscription. No proxy needed.</p>}
                      </div>
                    )
                  })}

                  <button onClick={() => {
                    const summary = getAgentKeys().map(k => {
                      const p = profiles[k]; if (!p) return ''
                      const model = selectedModels[k] || p.defaultModel
                      const label = p.models.find(m => m.value === model)?.label || model
                      let line = `${p.name}: ${label}`
                      if (k === 'codex') line += ` | Sub: ${selectedSubagentModels?.codex || ''}`
                      line += ` | ${executionModes[k] === 'proxy' ? 'Proxy' : 'Native CLI'}`
                      return line
                    }).filter(Boolean).join('\n')
                    addMsg({ type: 'system', content: `✅ Models updated:\n${summary}`, agent: 'System', isSystem: true })
                    setMessages(prev => prev.filter(m => m.id !== msg.id))
                  }} className="btn-accent" style={{ width: '100%', marginTop: 4 }}>
                    Apply Changes
                  </button>
                </div>
              )
            }

            // Workspace panel
            if (msg.type === 'workspace-panel') {
              return (
                <div key={msg.id} style={{ margin: '16px 0', background: 'var(--surface-2)', border: '1px solid var(--border-3)', borderRadius: 'var(--radius-lg)', padding: 20, maxWidth: 400 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <span>📁</span>
                    <span style={{ font: '600 14px var(--font-display)', color: 'var(--text-1)' }}>Workspace Settings</span>
                  </div>
                  <label style={{ display: 'block', font: '500 10px var(--font-body)', color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current Path</label>
                  <code style={{ display: 'block', background: 'var(--surface-3)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)', marginBottom: 14, wordBreak: 'break-all', font: '400 12px var(--font-mono)', color: 'var(--text-2)' }}>
                    {workspaceDir || '~/no1team/workspace'}
                  </code>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button className="btn-secondary" onClick={() => window.teamAPI?.chooseWorkspaceFolder?.().then(dir => dir && setWorkspaceDir(dir))}>Choose Folder</button>
                    <button className="btn-secondary" onClick={() => window.teamAPI?.openWorkspaceInExplorer?.(workspaceDir)}>Open in Explorer</button>
                  </div>
                  <button onClick={() => setMessages(prev => prev.filter(m => m.id !== msg.id))} style={{ marginTop: 14, width: '100%', padding: '7px', background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', font: '400 12px var(--font-body)' }}>Close</button>
                </div>
              )
            }

            // Research notification
            if (msg.type === 'research-notification') {
              return (
                <div key={msg.id} className="research-notification">
                  <div>
                    <div style={{ font: '600 13px var(--font-display)', color: 'var(--accent)' }}>🔬 Research Complete</div>
                    <div style={{ font: '400 12px var(--font-body)', color: 'var(--text-2)', marginTop: 4 }}>
                      {msg.agentCount} agent{msg.agentCount !== 1 ? 's' : ''} submitted research to the Research Panel.
                    </div>
                  </div>
                  <button onClick={() => setShowResearch(true)} style={{
                    background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
                    borderRadius: 'var(--radius-md)', color: 'var(--accent)',
                    font: '500 12px var(--font-body)', padding: '6px 14px', cursor: 'pointer',
                  }}>
                    View Research →
                  </button>
                </div>
              )
            }

            // Generic system message
            return (
              <div key={msg.id} className="sys-message">{msg.content}</div>
            )
          }

          // Normal message (agent or boss)
          return (
            <div key={msg.id} className={`msg-wrapper ${isBoss ? 'msg-boss' : 'msg-agent'} msg-group-start`}>
              {!isBoss && (
                <div className="msg-header">
                  <span className="msg-dot" style={{ background: color }} />
                  <span className="msg-name" style={{ color }}>{msg.agent}</span>
                  {seniorAgent && msg.agentId === seniorAgent && <span className="msg-senior-star">⭐</span>}
                  {msg.inProgress && (
                    <span style={{ font: '400 11px var(--font-body)', color, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ animation: 'pulse 1.2s ease-in-out infinite', display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                      typing
                    </span>
                  )}
                  <span className="msg-time">{formatTime(msg.timestamp)}</span>
                </div>
              )}
              {isBoss && (
                <div className="msg-header-boss">
                  <span className="msg-time">{formatTime(msg.timestamp)}</span>
                  <span className="msg-name" style={{ color: 'var(--agent-boss)' }}>You</span>
                  <span className="msg-dot" style={{ background: 'var(--agent-boss)' }} />
                </div>
              )}
              <div className={`msg-bubble ${isBoss ? 'msg-bubble-boss' : ''}`}
                style={!isBoss ? { borderLeftColor: color + '99' } : {}}>
                <MessageContent content={msg.content} />
              </div>
            </div>
          )
        })}

        {/* Typing indicators for running agents */}
        {Object.entries(agentStatus)
          .filter(([, status]) => status === 'running')
          .filter(([agentId]) => !messages.some(m => m.agentId === agentId && m.inProgress))
          .map(([agentId]) => {
            const color = AGENT_COLORS[agentId] || 'var(--text-3)'
            const name  = profiles?.[agentId]?.name || agentId
            return (
              <div key={agentId} className="typing-indicator" style={{ color }}>
                <span className="msg-dot" style={{ background: color }} />
                <span style={{ font: '400 12px var(--font-body)' }}>{name}</span>
                <div className="typing-dots">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )
          })
        }

        {/* Export options */}
        {pipelineComplete && lastSessionData && (
          <ExportOptions sessionData={lastSessionData} onExported={(filePath) => {
            addMsg({ type: 'system', content: `📤 Exported to: ${filePath}`, agent: 'System', isSystem: true })
          }} />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Messaging bar */}
      <div className="messaging-bar">
        {showSeniorPicker && (
          <div className="slash-menu" style={{ padding: 16 }}>
            <SeniorAgentSelector activeAgents={getAgentKeys()} profiles={profiles} onSelect={handleSeniorSelect} />
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
              <div className="slash-icon">👥</div>
              <div className="slash-desc">All Agents</div>
            </div>
            {Object.keys(profiles || { claude: null, codex: null, gemini: null }).map(id => (
              <div key={id} className="slash-item" onClick={() => { setTarget(id); setTagDropdownOpen(false) }}>
                <div className="slash-icon" style={{ color: AGENT_COLORS[id] || 'var(--text-2)' }}>●</div>
                <div className="slash-desc">{profiles?.[id]?.name || id}</div>
              </div>
            ))}
          </div>
        )}

        <div className="messaging-row">
          <div className="input-wrapper">
            <button className="tag-btn" onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
              title="Target agent" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              {target === 'all' ? '@▾' : `@${target.slice(0,2)}`}
            </button>
            <textarea
              value={inputText}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Type a message or / for commands..."
              className="msg-input"
              rows={1}
            />
            {isRunning ? (
              <button className="btn-stop-inline" onClick={handleStopAll}>⏹ Stop</button>
            ) : (
              <button className="btn-send" onClick={sendMessage} disabled={!inputText.trim() && !taskType}>
                Send →
              </button>
            )}
          </div>
          {taskType && (
            <div className="task-type-tag">
              {taskType}
              <span className="task-type-close" onClick={() => { setTaskType(null); setInputText('') }}>×</span>
            </div>
          )}
          <div className="input-hint">
            <span className="input-hint-item">
              <span className="kbd">↵</span>
              <span>Send</span>
            </span>
            <span className="input-hint-item" style={{ marginLeft: 2 }}>
              <span className="kbd">⇧↵</span>
              <span>New line</span>
            </span>
            <span className="input-hint-item" style={{ marginLeft: 2 }}>
              <span className="kbd">/</span>
              <span>Commands</span>
            </span>
            <span className="input-hint-item" style={{ marginLeft: 2 }}>
              <span className="kbd">@</span>
              <span>Target agent</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
