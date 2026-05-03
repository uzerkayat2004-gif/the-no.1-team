import React, { useState, useEffect } from 'react'
import GeneralTab from './components/GeneralTab'
import OnboardingFlow from './components/OnboardingFlow'
import ToastContainer from './components/ToastNotification'
import WorldGlobe from './components/WorldGlobe'

function ts() { return new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) }
function uid() { return Math.random().toString(36).slice(2) }

export default function App() {
  const [onboardingComplete, setOnboardingComplete] = useState(true) // Default to true to prevent flash
  const [theme, setTheme] = useState(() => localStorage.getItem('no1team_theme') || 'dark')
  const [view, setView] = useState('home')
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Brain file browser state
  const [brainTree, setBrainTree] = useState([])
  const [brainOpen, setBrainOpen] = useState({})
  const [brainFileContent, setBrainFileContent] = useState('')
  const [brainFilePath, setBrainFilePath] = useState(null)
  const [brainEditing, setBrainEditing] = useState(false)
  const [brainSearch, setBrainSearch] = useState('')
  const [brainSearchResults, setBrainSearchResults] = useState([])

  // Settings state
  const [settingsTab, setSettingsTab] = useState('providers')
  const [skillsList, setSkillsList] = useState([])
  const [selectedSkill, setSelectedSkill] = useState('')
  const [skillContent, setSkillContent] = useState('')
  const [skillSaved, setSkillSaved] = useState(false)

  const [proxySettings, setProxySettings] = useState({
    proxyUrl: 'http://localhost:20128',
    apiKey: '',
    claudeBaseUrl: 'http://localhost:20128',
    openaiBaseUrl: 'http://localhost:20128/v1',
    geminiBaseUrl: 'http://localhost:20128/v1',
  })
  const [proxySaved, setProxySaved] = useState(false)

  // Phase 5 state
  const [contextMenu, setContextMenu] = useState(null)
  const [analyticsData, setAnalyticsData] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [notifSettings, setNotifSettings] = useState({ desktopEnabled: true, toastEnabled: true, soundEnabled: false })

  const [defaults, setDefaults] = useState({ defaultMode: 'manual', defaultSeniorAgent: 'auto', timeoutMultiplier: '1x' })
  const [exportDefaults, setExportDefaults] = useState({ format: 'markdown', includeResearch: true, includeBrainstorm: true, includeTimestamps: true, includeAgentNames: true })
  const [activeProviders, setActiveProviders] = useState(['claude', 'codex', 'gemini'])
  const [installStatus, setInstallStatus] = useState({})
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [currentAccent, setCurrentAccent] = useState('#F97316')
  const [fontSize, setFontSize] = useState('14px')
  const [density, setDensity] = useState('normal')
  const [profiles, setProfiles] = useState({})

  const saveDefault = (key, value) => setDefaults(prev => ({ ...prev, [key]: value }))
  const saveExportDefault = (key, value) => setExportDefaults(prev => ({ ...prev, [key]: value }))
  const applyAccentColor = (color) => { document.documentElement.style.setProperty('--accent', color); setCurrentAccent(color) }
  const applyFontSize = (size) => { document.documentElement.style.setProperty('--font-size-base', size); setFontSize(size) }
  const applyDensity = (d) => setDensity(d)
  const testProvider = async (agentId) => {
    setInstallStatus(prev => ({ ...prev, [agentId]: 'testing' }))
    const res = await window.teamAPI?.testProvider?.(agentId)
    setInstallStatus(prev => ({ ...prev, [agentId]: res?.installed === true }))
  }
  const toggleProvider = (agentId) => setActiveProviders(prev => prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId])

  const buttonStyle = { padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-3)', background: 'var(--surface-3)', color: 'var(--text-2)', cursor: 'pointer', font: '400 13px var(--font-body)', transition: 'all 150ms' };
  const activeButtonStyle = { ...buttonStyle, background: 'var(--accent)', borderColor: 'var(--accent)', color: 'white', fontWeight: 500 };
  const selectStyle = { padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)', background: 'var(--surface-3)', color: 'var(--text-1)', width: '100%', marginBottom: 16, font: '400 14px var(--font-body)', outline: 'none', cursor: 'pointer' };
  const ghostButtonStyle = { padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', font: '400 12px var(--font-body)', transition: 'all 150ms' };


  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('no1team_theme', theme)
  }, [theme])

  // Check onboarding
  useEffect(() => {
    const hasOnboarded = localStorage.getItem('no1team_onboarded')
    if (!hasOnboarded) {
      setOnboardingComplete(false)
    }
  }, [])

  const finishOnboarding = () => {
    localStorage.setItem('no1team_onboarded', 'true')
    setOnboardingComplete(true)
  }

  // Load proxy settings
  useEffect(() => {
    if (window.teamAPI?.getProxySettings) {
      window.teamAPI.getProxySettings().then(settings => {
        if (settings) setProxySettings(settings)
      })
    }
    async function loadProfiles() {
      if (!window.teamAPI?.getProviderProfiles) return
      try {
        const p = await window.teamAPI.getProviderProfiles()
        setProfiles(p)
      } catch (e) { console.error('Failed to load profiles:', e) }
    }
    loadProfiles()
  }, [])

  const handleSaveProxy = () => {
    if (window.teamAPI?.saveProxySettings) {
      window.teamAPI.saveProxySettings(proxySettings)
      setProxySaved(true)
      setTimeout(() => setProxySaved(false), 2000)
    }
  }

  // Load sessions on mount (in-memory + Brain)
  useEffect(() => {
    async function loadSessions() {
      const loaded = []

      // 1. Load in-memory sessions from session context
      if (window.teamAPI?.session?.list) {
        const result = await window.teamAPI.session.list()
        if (result.sessions) {
          result.sessions.forEach(s => {
            loaded.push({
              id: `session-${s.number}`,
              number: s.number,
              title: s.task || `Session ${s.number}`,
              createdAt: s.createdAt || s.lastUpdated || '',
              agents: s.agents || [],
              source: 'memory',
            })
          })
        }
      }

      // 2. Load Brain sessions
      if (window.teamAPI?.listBrainSessions) {
        try {
          const brainSessions = await window.teamAPI.listBrainSessions()
          brainSessions.forEach(bs => {
            // Avoid duplicates
            const exists = loaded.some(s => s.title === bs.name)
            if (!exists) {
              loaded.push({
                id: `brain-${bs.id}`,
                title: bs.name,
                createdAt: bs.date || '',
                taskType: bs.taskType,
                status: bs.status,
                senior: bs.senior,
                folderRel: bs.folderRel,
                source: 'brain',
              })
            }
          })
        } catch (e) { /* Brain not available yet */ }
      }

      setSessions(loaded)
    }
    loadSessions()
  }, [])

  // Create new session
  async function createSession() {
    const api = window.teamAPI
    const result = await api?.session?.getNextNumber?.()
    const number = result?.number ?? Math.max(0, ...sessions.map(s => s.number || 0)) + 1
    const newSession = {
      id: `session-${number}`,
      number,
      title: `Session ${number}`,
      createdAt: new Date().toISOString()
    }
    setSessions(prev => [newSession, ...prev])
    setActiveSession(newSession.id)
    setView('session')
  }

  // Phase 5 — Session action handlers
  async function handleSessionAction(action, session) {
    const folderName = session.folderRel?.replace('sessions/', '') || session.id.replace('brain-', '')
    switch(action) {
      case 'pin': await window.teamAPI?.pinSession?.(folderName, true); break
      case 'rename': {
        const newName = prompt('Rename session:', session.title)
        if (newName) {
          await window.teamAPI?.renameSession?.(folderName, newName)
          setSessions(prev => prev.map(s => s.id === session.id ? { ...s, title: newName } : s))
        }
        break
      }
      case 'duplicate': await window.teamAPI?.duplicateSession?.(folderName, `${session.title} (copy)`); break
      case 'archive': await window.teamAPI?.archiveSession?.(folderName); break
      case 'delete': {
        if (confirm('Delete this session permanently?')) {
          await window.teamAPI?.deleteSession?.(folderName)
          setSessions(prev => prev.filter(s => s.id !== session.id))
          if (activeSession === session.id) { setActiveSession(null); setView('home') }
        }
        break
      }
      case 'resume': setActiveSession(session.id); setView('session'); break
    }
  }

  // Phase 5 — Load analytics
  async function loadAnalytics() {
    setAnalyticsLoading(true)
    try {
      const data = await window.teamAPI?.getAnalytics?.()
      setAnalyticsData(data)
    } catch(e) { console.error('Analytics load error:', e) }
    setAnalyticsLoading(false)
  }

  // Load brain tree
  async function loadBrainTree() {
    if (!window.teamAPI?.brain?.listTree) return
    const result = await window.teamAPI.brain.listTree()
    if (result.tree) setBrainTree(result.tree)
  }

  // Open brain file
  async function openBrainFile(filePath) {
    if (!window.teamAPI?.brain?.readFile) return
    const result = await window.teamAPI.brain.readFile(filePath)
    if (result.success) {
      setBrainFileContent(result.content)
      setBrainFilePath(filePath)
      setBrainEditing(false)
    }
  }

  // Save brain file
  async function saveBrainFile() {
    if (!brainFilePath || !window.teamAPI?.brain?.writeFile) return
    await window.teamAPI.brain.writeFile(brainFilePath, brainFileContent)
    setBrainEditing(false)
  }

  // Brain search
  async function searchBrain(query) {
    setBrainSearch(query)
    if (!query || query.length < 2) { setBrainSearchResults([]); return }
    if (!window.teamAPI?.brain?.searchContent) return
    const result = await window.teamAPI.brain.searchContent(query)
    setBrainSearchResults(result.results || [])
  }

  // Load skill files for settings
  async function loadSkillsList() {
    if (!window.teamAPI?.brain?.listSkills) return
    const list = await window.teamAPI.brain.listSkills()
    setSkillsList(list)
    if (list.length > 0) {
      setSelectedSkill(list[0])
      loadSkillContent(list[0])
    }
  }

  async function loadSkillContent(skillId) {
    if (!window.teamAPI?.brain?.readSkill) return
    const content = await window.teamAPI.brain.readSkill(skillId)
    setSkillContent(content)
  }

  // Save skill
  async function saveSkill() {
    if (!window.teamAPI?.brain?.writeSkill || !selectedSkill) return
    await window.teamAPI.brain.writeSkill(selectedSkill, skillContent)
    setSkillSaved(true)
    setTimeout(() => setSkillSaved(false), 2000)
  }

  // Window Controls
  const minimizeWindow = () => window.teamAPI?.window?.minimize()
  const maximizeWindow = () => window.teamAPI?.window?.maximize()
  const closeWindow = () => window.teamAPI?.window?.close()

  // ─── RENDER HELPERS ─────────────────────────
  function renderBrainTreeNode(node, depth = 0) {
    if (node.type === 'folder') {
      const isOpen = brainOpen[node.path]
      return (
        <div key={node.path}>
          <div onClick={() => setBrainOpen(prev => ({ ...prev, [node.path]: !prev[node.path] }))}
               style={{ padding: '4px 8px', paddingLeft: `${12 + depth * 16}px`, cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span style={{ fontSize: '10px' }}>{isOpen ? '▾' : '▸'}</span>
            <span>📁</span> {node.name}
          </div>
          {isOpen && node.children?.map(child => renderBrainTreeNode(child, depth + 1))}
        </div>
      )
    }
    return (
      <div key={node.path}
           onClick={() => openBrainFile(node.path)}
           style={{
             padding: '4px 8px', paddingLeft: `${28 + depth * 16}px`, cursor: 'pointer', fontSize: '13px',
             color: brainFilePath === node.path ? 'var(--text-primary)' : 'var(--text-secondary)',
             background: brainFilePath === node.path ? 'var(--bg-elevated)' : 'transparent',
           }}
      >📄 {node.name}</div>
    )
  }

  const renderSidebar = () => {
    // Group sessions by date
    const today = new Date(); today.setHours(0,0,0,0)
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)

    const groups = { today: [], yesterday: [], older: [] }
    sessions.forEach(s => {
      const d = s.createdAt ? new Date(s.createdAt) : null
      if (!d || isNaN(d)) { groups.older.push(s); return }
      d.setHours(0,0,0,0)
      if (d >= today) groups.today.push(s)
      else if (d >= yesterday) groups.yesterday.push(s)
      else groups.older.push(s)
    })

    const renderGroup = (label, items) => items.length === 0 ? null : (
      <>
        <div className="session-group-label">{label}</div>
        {items.map(s => (
          <div key={s.id}
               className={`session-card ${activeSession === s.id ? 'active' : ''}`}
               onClick={async () => {
                 setActiveSession(s.id); setView('session')
                 if (s.folderRel) {
                   const briefing = await window.teamAPI?.buildResumeBriefing?.(s.folderRel, '');
                   if (briefing) {
                     window.teamAPI?.updateSessionContext?.(s.id, {
                       resumeBriefing: briefing,
                       isResumed: true,
                     });
                   }
                 }
               }}
               onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, session: s }) }}>
            <div className="session-card-line1">
              {s.source === 'brain' ? '🧠' : '💬'} {s.title}
              {s.status && s.status.includes('✅') && <span style={{ marginLeft: 4, fontSize: '10px' }}>✅</span>}
            </div>
            <div className="session-card-line2">
              {s.source === 'brain'
                ? `${s.taskType || 'general'} ${s.senior ? `• Senior: ${s.senior}` : ''}`
                : s.agents && s.agents.length > 0 ? s.agents.join(', ') : 'No agents'}
            </div>
            <div className="session-card-line3">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'Unknown date'}</div>
          </div>
        ))}
      </>
    )

    return (
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-app-name">
            <div className="sidebar-app-dot" />
            No. 1 Team
            {sessions.length > 0 && (
              <span style={{
                marginLeft: 'auto', font: '500 10px var(--font-body)',
                color: 'var(--text-3)', background: 'var(--surface-3)',
                border: '1px solid var(--border-2)', borderRadius: 'var(--radius-full)',
                padding: '1px 7px',
              }}>
                {sessions.length}
              </span>
            )}
          </div>
          <button className="btn-new-session" onClick={createSession}>
            + New Session
          </button>
        </div>

        <div className="sidebar-scroll">
          {sessions.length === 0 && (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-3)', font: '400 12px var(--font-body)', lineHeight: 1.8 }}>
              No sessions yet.<br />
              <span style={{ color: 'var(--text-4)' }}>Click "+ New Session" to begin.</span>
            </div>
          )}
          {renderGroup('TODAY', groups.today)}
          {renderGroup('YESTERDAY', groups.yesterday)}
          {renderGroup('OLDER', groups.older)}
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-bottom-row">
            <div className="sidebar-link" onClick={() => { setView('settings'); loadSkillsList() }}>
              <span>⚙️</span> Settings
            </div>
            <button
              className="theme-toggle-btn"
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? '☀' : '🌙'}
            </button>
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}
               onMouseLeave={() => setContextMenu(null)}>
            {[
              { icon: '📌', label: 'Pin to top', action: 'pin' },
              { icon: '✏️', label: 'Rename', action: 'rename' },
              { icon: '🔁', label: 'Resume session', action: 'resume' },
              { icon: '📋', label: 'Duplicate', action: 'duplicate' },
              { icon: '📦', label: 'Archive', action: 'archive' },
              { icon: '🗑️', label: 'Delete', action: 'delete' },
            ].map(item => (
              <button key={item.action}
                className={`context-menu-item ${item.action === 'delete' ? 'danger' : ''}`}
                onClick={() => { handleSessionAction(item.action, contextMenu.session); setContextMenu(null) }}>
                <span>{item.icon}</span><span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderTitleBar = () => {
    let sessionName = ''
    if (view === 'session' && activeSession) {
      const sess = sessions.find(s => s.id === activeSession)
      if (sess) sessionName = sess.title
    }
    const viewLabel = view === 'settings' ? '⚙️ Settings' : ''

    return (
      <div className="titlebar">
        <div className="titlebar-left">
          <div className="titlebar-dot" />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>No. 1 Team</span>
          {sessionName && (
            <>
              <span className="titlebar-sep">›</span>
              <span className="titlebar-session">💬 {sessionName}</span>
            </>
          )}
          {viewLabel && !sessionName && (
            <>
              <span className="titlebar-sep">›</span>
              <span className="titlebar-session">{viewLabel}</span>
            </>
          )}
        </div>
        <div className="titlebar-right">
          {view !== 'home' && (
            <button
              onClick={() => setView('home')}
              style={{
                background: 'transparent', border: '1px solid var(--border-2)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-3)',
                font: '400 11px var(--font-body)', padding: '3px 10px',
                cursor: 'pointer', marginRight: 8,
              }}
            >
              ← Home
            </button>
          )}
          <div className="titlebar-controls">
            <button className="titlebar-btn" onClick={minimizeWindow} title="Minimize">—</button>
            <button className="titlebar-btn" onClick={maximizeWindow} title="Maximize">□</button>
            <button className="titlebar-btn close" onClick={closeWindow} title="Close">✕</button>
          </div>
        </div>
      </div>
    )
  }

  // ─── VIEWS ───────────────────────────────────

  if (!onboardingComplete) {
    return (
      <div className="app-container">
        {renderTitleBar()}
        <OnboardingFlow onComplete={finishOnboarding} />
        <ToastContainer />
      </div>
    )
  }

  return (
    <div className="app-container">
      {renderTitleBar()}

      <div className="main-content">
        {/* Sidebar always visible except on home view where it's part of the flex layout */}
        {view !== 'home' && renderSidebar()}

        <div className="view-area">
          {/* HOME VIEW */}
          {view === 'home' && (
            <div style={{ display: 'flex', flex: 1, height: '100%' }}>
              {renderSidebar()}
              <div className="welcome-screen">
                <div className="welcome-content">
                  {/* Realistic spinning Earth globe */}
                  <WorldGlobe size={72} style={{ marginBottom: 32 }} />
                  <h1 className="welcome-title">No. 1 Team</h1>
                  <p className="welcome-subtitle">
                    Your multi-agent AI command center.<br />
                    Coordinate Claude, Codex, Gemini and more.
                  </p>
                  <button className="btn-accent welcome-btn" onClick={createSession}>
                    + New Session
                  </button>
                  <div style={{ marginTop: 16, font: '400 12px var(--font-body)', color: 'var(--text-4)' }}>
                    Type <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border-3)', color: 'var(--text-3)' }}>/</span> in chat for commands
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SESSION VIEW */}
          {view === 'session' && (
            <GeneralTab
              sessionId={activeSession}
              onTitleUpdate={(title) =>
                setSessions(prev => prev.map(s => s.id === activeSession ? { ...s, title } : s))
              }
            />
          )}

          {/* SETTINGS VIEW */}
          {view === 'settings' && (
            <div className="settings-container">
              <div className="settings-nav">
                <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border-1)', marginBottom: '8px' }}>
                  <span style={{ font: '600 12px var(--font-display)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Settings</span>
                </div>
                <div className={`settings-nav-item ${settingsTab === 'providers' ? 'active' : ''}`} onClick={() => setSettingsTab('providers')}>🤖 Providers</div>
                <div className={`settings-nav-item ${settingsTab === 'proxy' ? 'active' : ''}`} onClick={() => setSettingsTab('proxy')}>🔌 Proxy</div>
                <div className={`settings-nav-item ${settingsTab === 'skills' ? 'active' : ''}`} onClick={() => setSettingsTab('skills')}>📋 Skills</div>
                <div className={`settings-nav-item ${settingsTab === 'defaults' ? 'active' : ''}`} onClick={() => setSettingsTab('defaults')}>⚙️ Defaults</div>
                <div className={`settings-nav-item ${settingsTab === 'notifs' ? 'active' : ''}`} onClick={() => setSettingsTab('notifs')}>🔔 Notifs</div>
                <div className={`settings-nav-item ${settingsTab === 'appear' ? 'active' : ''}`} onClick={() => setSettingsTab('appear')}>🎨 Appearance</div>
                <div className={`settings-nav-item ${settingsTab === 'export' ? 'active' : ''}`} onClick={() => setSettingsTab('export')}>📤 Export</div>

                <div style={{ margin: '8px 10px', height: 1, background: 'var(--border-1)' }} />
                <div style={{ padding: '6px 16px 4px', font: '600 10px var(--font-body)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Data</div>
                <div className={`settings-nav-item ${settingsTab === 'brain-files' ? 'active' : ''}`}
                  onClick={() => { setSettingsTab('brain-files'); loadBrainTree() }}>🧠 Brain Files</div>
                <div className={`settings-nav-item ${settingsTab === 'analytics' ? 'active' : ''}`}
                  onClick={() => { setSettingsTab('analytics'); loadAnalytics() }}>📊 Analytics</div>
              </div>

              <div className="settings-content"
                style={settingsTab === 'brain-files' ? { padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } : {}}>
                {settingsTab === 'skills' && (
                  <div>
                    <h2 className="settings-title">Agent Task Skills</h2>
                    <p className="settings-desc">
                      Edit the specific instructions injected into agents based on the task type.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      {skillsList.map(skillId => (
                        <div key={skillId}
                             onClick={() => { setSelectedSkill(skillId); loadSkillContent(skillId); }}
                             style={{
                               padding: '8px 12px',
                               borderRadius: '6px',
                               border: selectedSkill === skillId ? '1px solid var(--accent)' : '1px solid var(--border)',
                               background: selectedSkill === skillId ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                               color: selectedSkill === skillId ? 'var(--accent)' : 'var(--text-secondary)',
                               cursor: 'pointer',
                               fontSize: '13px',
                               fontWeight: selectedSkill === skillId ? 'bold' : 'normal',
                             }}>
                          {skillId}
                        </div>
                      ))}
                    </div>
                    {selectedSkill && (
                      <>
                        <textarea value={skillContent} onChange={e => setSkillContent(e.target.value)} className="form-textarea" style={{ minHeight: '300px' }} />
                        <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <button onClick={saveSkill} className="btn-primary">Save {selectedSkill}.md</button>
                          {skillSaved && <span style={{ color: 'var(--status-approved)', fontSize: '13px' }}>✓ Saved!</span>}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {settingsTab === 'proxy' && (
                  <div>
                    <h2 className="settings-title">Proxy Settings (OpenRouter / 9Router)</h2>
                    <p className="settings-desc">
                      Configure your local proxy so agents use your OpenRouter or 9Router models instead of real API servers.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Proxy URL</label>
                        <input
                          value={proxySettings.proxyUrl}
                          onChange={e => setProxySettings(p => ({ ...p, proxyUrl: e.target.value, claudeBaseUrl: e.target.value, geminiBaseUrl: e.target.value + '/v1', openaiBaseUrl: e.target.value + '/v1' }))}
                          placeholder="http://localhost:20128"
                          className="form-input"
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">API Key (from dashboard)</label>
                        <input
                          value={proxySettings.apiKey}
                          onChange={e => setProxySettings(p => ({ ...p, apiKey: e.target.value }))}
                          placeholder="your-proxy-api-key"
                          type="password"
                          className="form-input"
                        />
                      </div>

                      <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button onClick={handleSaveProxy} className="btn-primary">Save Proxy Settings</button>
                        {proxySaved && <span style={{ color: 'var(--status-approved)', fontSize: '13px' }}>✓ Saved!</span>}
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'brain-files' && (
                  <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
                    {/* File tree panel */}
                    <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--border-1)', display: 'flex', flexDirection: 'column', background: 'var(--surface-0)' }}>
                      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ font: '600 12px var(--font-display)', color: 'var(--text-1)' }}>Brain Files</span>
                        <button onClick={() => window.teamAPI?.openWorkspaceInExplorer?.('~/no1team/brain')}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 12, padding: '2px 6px', borderRadius: 4 }}
                          title="Open folder">↗</button>
                      </div>
                      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-1)' }}>
                        <input value={brainSearch} onChange={e => searchBrain(e.target.value)}
                          placeholder="Search files…"
                          style={{ width: '100%', padding: '6px 10px', background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', color: 'var(--text-1)', fontSize: 12, outline: 'none', fontFamily: 'var(--font-body)' }} />
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                        {brainSearch && brainSearchResults.length > 0
                          ? brainSearchResults.map(r => (
                            <div key={r.path} onClick={() => openBrainFile(r.path)}
                              style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-1)' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <div style={{ font: '500 12px var(--font-body)', color: 'var(--accent)' }}>{r.name}</div>
                              <div style={{ font: '400 11px var(--font-body)', color: 'var(--text-3)', marginTop: 2 }}>{r.snippet}</div>
                            </div>
                          ))
                          : brainTree.length > 0
                            ? brainTree.map(node => renderBrainTreeNode(node))
                            : (
                              <div style={{ padding: '24px 16px', font: '400 12px var(--font-body)', color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.7 }}>
                                Brain files appear here<br />when Electron is running.
                              </div>
                            )
                        }
                      </div>
                    </div>

                    {/* File content panel */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface-1)', overflow: 'hidden' }}>
                      {brainFilePath ? (
                        <>
                          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(7,7,13,0.7)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
                            <span style={{ font: '400 12px var(--font-mono)', color: 'var(--text-3)' }}>{brainFilePath}</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {brainEditing
                                ? <button onClick={saveBrainFile} className="btn-accent" style={{ height: 28, padding: '0 14px', fontSize: 12 }}>Save</button>
                                : <button onClick={() => setBrainEditing(true)} className="btn-secondary" style={{ height: 28, padding: '0 14px', fontSize: 12 }}>Edit</button>
                              }
                            </div>
                          </div>
                          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
                            {brainEditing
                              ? <textarea value={brainFileContent} onChange={e => setBrainFileContent(e.target.value)} className="form-textarea" style={{ height: '100%', minHeight: 400 }} />
                              : <pre style={{ font: '400 13px/1.75 var(--font-mono)', color: 'var(--text-1)', whiteSpace: 'pre-wrap', margin: 0 }}>{brainFileContent}</pre>
                            }
                          </div>
                        </>
                      ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                          <div style={{ font: '400 13px var(--font-body)', color: 'var(--text-3)' }}>Select a file to view its contents</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {settingsTab === 'notifs' && (
                  <div>
                    <h2 className="settings-title">Notifications</h2>
                    <p className="settings-desc">Configure how the app alerts you.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                        <input type="checkbox" checked={notifSettings.desktopEnabled} onChange={e => {
                          const n = { ...notifSettings, desktopEnabled: e.target.checked }
                          setNotifSettings(n)
                          window.teamAPI?.updateNotificationSettings?.(n)
                        }} />
                        Enable Desktop Notifications (Background)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                        <input type="checkbox" checked={notifSettings.toastEnabled} onChange={e => {
                          const n = { ...notifSettings, toastEnabled: e.target.checked }
                          setNotifSettings(n)
                          window.teamAPI?.updateNotificationSettings?.(n)
                        }} />
                        Enable In-App Toasts
                      </label>
                    </div>
                  </div>
                )}

                {settingsTab === 'defaults' && (
                  <div>
                    <h2 className="settings-title">Session Defaults</h2>
                    <label className="form-label" style={{ marginTop: 16 }}>Default Mode</label>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      <button
                        onClick={() => saveDefault('defaultMode', 'manual')}
                        style={defaults.defaultMode === 'manual' ? activeButtonStyle : buttonStyle}
                      >
                        ⏸ Manual
                      </button>
                      <button
                        onClick={() => saveDefault('defaultMode', 'auto')}
                        style={defaults.defaultMode === 'auto' ? activeButtonStyle : buttonStyle}
                      >
                        ⚡ Auto
                      </button>
                    </div>

                    <label className="form-label">Default Senior Agent</label>
                    <select
                      value={defaults.defaultSeniorAgent || 'auto'}
                      onChange={e => saveDefault('defaultSeniorAgent', e.target.value)}
                      style={selectStyle}
                    >
                      <option value="auto">⚡ Auto-Select by Task Type</option>
                      <option value="claude">Claude Code</option>
                      <option value="codex">Codex</option>
                      <option value="gemini">Gemini CLI</option>
                      <option value="aider">Aider</option>
                      <option value="opencode">OpenCode</option>
                    </select>

                    <label className="form-label">Agent Timeout</label>
                    <select
                      value={defaults.timeoutMultiplier || '1x'}
                      onChange={e => saveDefault('timeoutMultiplier', e.target.value)}
                      style={selectStyle}
                    >
                      <option value="0.5x">0.5x — Faster (strict)</option>
                      <option value="1x">1x — Standard</option>
                      <option value="2x">2x — Relaxed</option>
                      <option value="none">No Timeout</option>
                    </select>
                  </div>
                )}

                {settingsTab === 'appear' && (
                  <div>
                    <h2 className="settings-title">Appearance</h2>
                    <label className="form-label" style={{ marginTop: 16 }}>Accent Color</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                      {[
                        { color: '#F97316', label: 'Orange (Default)' },
                        { color: '#FB923C', label: 'Amber' },
                        { color: '#4A90D9', label: 'Blue' },
                        { color: '#4CAF50', label: 'Green' },
                        { color: '#FF6B9D', label: 'Pink' },
                        { color: '#A78BFA', label: 'Violet' },
                      ].map(opt => (
                        <button
                          key={opt.color}
                          title={opt.label}
                          onClick={() => applyAccentColor(opt.color)}
                          style={{
                            width: 28, height: 28,
                            borderRadius: '50%',
                            background: opt.color,
                            border: currentAccent === opt.color
                              ? '3px solid white'
                              : '2px solid transparent',
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>

                    <label className="form-label">Font Size</label>
                    <select
                      value={fontSize}
                      onChange={e => applyFontSize(e.target.value)}
                      style={selectStyle}
                    >
                      <option value="13px">Small (13px)</option>
                      <option value="14px">Medium (14px) — Default</option>
                      <option value="15px">Large (15px)</option>
                      <option value="16px">Extra Large (16px)</option>
                    </select>

                    <label className="form-label">Message Density</label>
                    <select
                      value={density}
                      onChange={e => applyDensity(e.target.value)}
                      style={selectStyle}
                    >
                      <option value="compact">Compact</option>
                      <option value="normal">Normal — Default</option>
                      <option value="spacious">Spacious</option>
                    </select>
                  </div>
                )}

                {settingsTab === 'export' && (
                  <div>
                    <h2 className="settings-title">Export Settings</h2>
                    <label className="form-label" style={{ marginTop: 16 }}>Default Export Format</label>
                    <select
                      value={exportDefaults.format || 'markdown'}
                      onChange={e => saveExportDefault('format', e.target.value)}
                      style={selectStyle}
                    >
                      <option value="markdown">Markdown (.md)</option>
                      <option value="plain">Plain Text (.txt)</option>
                      <option value="pdf">PDF (.pdf)</option>
                      <option value="full-report">Full Session Report (.md)</option>
                    </select>

                    <label className="form-label">Include In Export</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      {[
                        { key: 'includeResearch',   label: 'Raw research from agents' },
                        { key: 'includeBrainstorm', label: 'Brainstorm transcript' },
                        { key: 'includeTimestamps', label: 'Timestamps' },
                        { key: 'includeAgentNames', label: 'Agent names' },
                      ].map(opt => (
                        <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={exportDefaults[opt.key] !== false}
                            onChange={e => saveExportDefault(opt.key, e.target.checked)}
                          />
                          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {settingsTab === 'providers' && (
                  <div>
                    <h2 className="settings-title">Providers</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                      Toggle which providers are active for your sessions.
                      Test connection to verify each tool is installed.
                    </p>

                    {Object.entries(profiles).map(([agentId, profile]) => (
                      <div key={agentId} style={{
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'space-between',
                        padding:        '12px 0',
                        borderBottom:   '1px solid var(--border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: profile.color || '#ccc', display: 'inline-block'
                          }} />
                          <div>
                            <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>
                              {profile.name}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                              {profile.installGuide}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {/* Install status indicator */}
                          <span style={{
                            fontSize: 11,
                            color: installStatus[agentId] === true
                              ? 'var(--status-approved)'
                              : installStatus[agentId] === false
                              ? 'var(--status-error)'
                              : 'var(--text-disabled)'
                          }}>
                            {installStatus[agentId] === 'testing' ? 'Testing...'
                              : installStatus[agentId] === true ? '✅ Installed'
                              : installStatus[agentId] === false ? '❌ Not found'
                              : '○ Not checked'}
                          </span>

                          {/* Test button */}
                          <button
                            onClick={() => testProvider(agentId)}
                            style={ghostButtonStyle}
                          >
                            Test
                          </button>

                          {/* Active toggle */}
                          <div
                            onClick={() => toggleProvider(agentId)}
                            style={{
                              width: 36, height: 20, borderRadius: 10,
                              background: activeProviders.includes(agentId)
                                ? 'var(--accent)'
                                : 'var(--border-strong)',
                              cursor: 'pointer',
                              position: 'relative',
                              transition: 'background 200ms',
                            }}
                          >
                            <div style={{
                              width: 14, height: 14,
                              borderRadius: '50%',
                              background: 'white',
                              position: 'absolute',
                              top: 3,
                              left: activeProviders.includes(agentId) ? 19 : 3,
                              transition: 'left 200ms',
                            }} />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => setShowAddProvider(true)}
                      style={{ ...ghostButtonStyle, marginTop: 16 }}
                    >
                      + Add Custom Provider
                    </button>
                  </div>
                )}

                {settingsTab === 'analytics' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div style={{ marginBottom: 28 }}>
                      <h2 className="settings-title">Analytics</h2>
                      <p className="settings-desc">Usage stats and session history</p>
                    </div>

                    {analyticsLoading && <div style={{ color: 'var(--text-3)', padding: '32px 0', textAlign: 'center' }}>Loading analytics…</div>}

                    {!analyticsLoading && analyticsData && (
                      <>
                        <div className="analytics-grid">
                          <div className="stat-card">
                            <div className="stat-value">{analyticsData.overview.totalSessions}</div>
                            <div className="stat-label">Total Sessions</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-value">{analyticsData.overview.approved}</div>
                            <div className="stat-label">Approved</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-value">{analyticsData.overview.approvalRate}%</div>
                            <div className="stat-label">Approval Rate</div>
                            <div className="progress-bar-container">
                              <div className="progress-bar-fill" style={{ width: `${analyticsData.overview.approvalRate}%`, background: 'var(--status-approved)' }} />
                            </div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-value">{analyticsData.overview.sentBack}</div>
                            <div className="stat-label">Sent Back</div>
                          </div>
                        </div>

                        {Object.keys(analyticsData.taskBreakdown).length > 0 && (
                          <div style={{ marginTop: 24 }}>
                            <h3 style={{ font: '600 13px var(--font-display)', color: 'var(--text-2)', marginBottom: 12 }}>Task Type Breakdown</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {Object.entries(analyticsData.taskBreakdown).map(([type, count]) => (
                                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <span style={{ font: '400 13px var(--font-body)', color: 'var(--text-3)', minWidth: 80 }}>{type}</span>
                                  <div className="progress-bar-container" style={{ flex: 1 }}>
                                    <div className="progress-bar-fill" style={{ width: `${Math.min(100, (count / analyticsData.overview.totalSessions) * 100)}%`, background: 'var(--accent)' }} />
                                  </div>
                                  <span style={{ font: '600 13px var(--font-body)', color: 'var(--text-1)', minWidth: 20 }}>{count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {Object.keys(analyticsData.agentStats).length > 0 && (
                          <div style={{ marginTop: 24 }}>
                            <h3 style={{ font: '600 13px var(--font-display)', color: 'var(--text-2)', marginBottom: 12 }}>Agent Performance</h3>
                            <div className="analytics-grid">
                              {Object.entries(analyticsData.agentStats).map(([id, stats]) => (
                                <div key={id} className="stat-card">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: stats.color, display: 'inline-block' }} />
                                    <span style={{ font: '600 13px var(--font-body)', color: 'var(--text-1)' }}>{stats.name}</span>
                                  </div>
                                  <div className="stat-label">{stats.total} tasks · {stats.approvalRate}% approved</div>
                                  <div className="progress-bar-container">
                                    <div className="progress-bar-fill" style={{ width: `${stats.approvalRate}%`, background: stats.color }} />
                                  </div>
                                  <div className="stat-label">Avg send-backs: {stats.avgSendBacks}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {analyticsData.recentSessions?.length > 0 && (
                          <div style={{ marginTop: 24 }}>
                            <h3 style={{ font: '600 13px var(--font-display)', color: 'var(--text-2)', marginBottom: 12 }}>Recent Sessions</h3>
                            {analyticsData.recentSessions.map((s, i) => (
                              <div key={i} style={{ padding: '8px 12px', background: 'var(--surface-3)', border: '1px solid var(--border-1)', borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ font: '500 13px var(--font-body)', color: 'var(--text-1)' }}>{s.name || s.id}</span>
                                <span style={{ font: '400 11px var(--font-body)', color: 'var(--text-3)' }}>{s.taskType} · {s.date}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {analyticsData.overview.totalSessions === 0 && (
                          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-3)', font: '400 13px var(--font-body)' }}>
                            No data yet — complete a session to see stats here.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}


        </div>
      </div>
      <ToastContainer />
    </div>
  )
}
