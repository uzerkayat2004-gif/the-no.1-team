import React, { useState } from 'react'

export default function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState(1)
  const [installedProviders, setInstalledProviders] = useState({ 'Claude Code': true })
  const [proxyType, setProxyType] = useState('9router')
  const [testStatus, setTestStatus] = useState('')

  const toggleProvider = (name) => {
    setInstalledProviders(prev => ({ ...prev, [name]: !prev[name] }))
  }

  // Step 1: Welcome
  if (step === 1) {
    return (
      <div className="onboarding-screen">
        <div className="onboarding-content center-content">
          <div className="onboarding-globe">🌍</div>
          <h1 className="onboarding-title">Welcome to No. 1 Team</h1>
          <p className="onboarding-subtitle">
            Your multi-agent AI command center.<br/>
            Coordinate Claude Code, Codex, Gemini,<br/>
            and more — all from one place.
          </p>
          <button className="btn-primary onboarding-btn-large" onClick={() => setStep(2)}>
            Get Started →
          </button>
        </div>
      </div>
    )
  }

  // Step 2: Providers
  if (step === 2) {
    return (
      <div className="onboarding-screen">
        <div className="onboarding-content">
          <h2 className="onboarding-heading">Which AI tools do you have installed?</h2>
          
          <div className="provider-list">
            {['Claude Code', 'Codex', 'Gemini CLI', 'Aider', 'OpenCode'].map((name, i) => (
              <div key={name} className="provider-item">
                <span className="provider-icon">{['🟠', '⬜', '🔵', '🟢', '🩷'][i]}</span>
                <span className="provider-name">{name}</span>
                <div className="provider-actions">
                  {installedProviders[name] ? (
                    <span className="installed-badge" onClick={() => toggleProvider(name)} style={{ cursor: 'pointer' }}>Installed ✓</span>
                  ) : (
                    <div className="toggle-switch off" onClick={() => toggleProvider(name)}></div>
                  )}
                  <a href="#" className="install-link">Install Guide</a>
                </div>
              </div>
            ))}
          </div>

          <button className="btn-ghost" style={{ marginTop: '16px' }}>+ Add Custom Provider</button>

          <div className="onboarding-footer">
            <button className="btn-ghost" onClick={() => setStep(3)}>Skip</button>
            <button className="btn-primary" onClick={() => setStep(3)}>Test & Continue →</button>
          </div>
        </div>
      </div>
    )
  }

  // Step 3: Proxy
  if (step === 3) {
    return (
      <div className="onboarding-screen">
        <div className="onboarding-content">
          <h2 className="onboarding-heading">Are you using a proxy or router?</h2>
          
          <div className="radio-group">
            <label className="radio-label">
              <input type="radio" name="proxy" checked={proxyType === '9router'} onChange={() => setProxyType('9router')} />
              <span>Yes — I use 9Router or OpenRouter</span>
            </label>
            <label className="radio-label">
              <input type="radio" name="proxy" checked={proxyType === 'other'} onChange={() => setProxyType('other')} />
              <span>Yes — I use a different proxy</span>
            </label>
            <label className="radio-label">
              <input type="radio" name="proxy" checked={proxyType === 'none'} onChange={() => setProxyType('none')} />
              <span>No — direct connections</span>
            </label>
          </div>

          {proxyType !== 'none' && (
            <div className="proxy-form">
              <div className="form-group">
                <label className="form-label">Proxy URL:</label>
                <input type="text" defaultValue="http://localhost:20128" className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">API Key:</label>
                <input type="password" placeholder="your-proxy-api-key" className="form-input" />
              </div>
            </div>
          )}

          <button className="btn-secondary" onClick={() => {
            setTestStatus('Testing...')
            setTimeout(() => setTestStatus('Connection Successful! ✅'), 1000)
          }}>
            {testStatus || 'Test Connection'}
          </button>

          <div className="onboarding-footer">
            <button className="btn-ghost" onClick={() => setStep(2)}>Back</button>
            <button className="btn-primary" onClick={() => setStep(4)}>Continue →</button>
          </div>
        </div>
      </div>
    )
  }

  // Step 4: Tour
  if (step === 4) {
    return (
      <div className="onboarding-screen">
        <div className="onboarding-content center-content">
          <div className="tour-slide">
            <h2 className="tour-title">Give a task → Agents work together → Best answer delivered</h2>
            <p className="tour-desc">No. 1 Team automates the research and coding pipeline for you.</p>
          </div>
          
          <div className="tour-dots">
            <span className="dot active"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>

          <div className="onboarding-footer">
            <button className="btn-ghost" onClick={() => setStep(3)}>Back</button>
            <button className="btn-primary" onClick={() => setStep(5)}>Next →</button>
          </div>
        </div>
      </div>
    )
  }

  // Step 5: Ready
  if (step === 5) {
    return (
      <div className="onboarding-screen">
        <div className="onboarding-content center-content">
          <div className="ready-icon">✅</div>
          <h1 className="onboarding-title">You're all set.</h1>
          <p className="onboarding-subtitle">
            Your team is ready to work.<br/>
            Type / in the chat to see all commands.
          </p>
          <button className="btn-primary onboarding-btn-large" onClick={onComplete}>
            Start Using No. 1 Team
          </button>
        </div>
      </div>
    )
  }

  return null
}
