import React, { useState } from 'react'
import WorldGlobe from './WorldGlobe'

const PROVIDERS = [
  { name: 'Claude Code', icon: '🟠', desc: 'Anthropic\'s powerful coding agent' },
  { name: 'Codex',       icon: '⬜', desc: 'OpenAI GPT-based code generation' },
  { name: 'Gemini CLI',  icon: '🔵', desc: 'Google\'s multimodal agent' },
  { name: 'Aider',       icon: '🟢', desc: 'Open-source pair programmer' },
  { name: 'OpenCode',    icon: '🩷', desc: 'Community AI code agent' },
]

const TOUR_SLIDES = [
  {
    icon: '⚡',
    title: 'Give a task — agents work together',
    desc: 'Type any research or coding task. Multiple AI agents collaborate simultaneously, each contributing their best answer.',
  },
  {
    icon: '👑',
    title: 'One senior agent leads the team',
    desc: 'The Senior Agent synthesizes all responses into a single high-quality final answer you can act on immediately.',
  },
  {
    icon: '✋',
    title: 'You stay in full control',
    desc: 'Manual mode lets you approve every checkpoint. Auto mode runs the pipeline hands-free. Switch anytime with /mode.',
  },
]


function StepProgress({ current, total }) {
  return (
    <div className="step-progress">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`step-dot ${i < current ? 'done' : i === current ? 'active' : ''}`} />
      ))}
    </div>
  )
}

export default function OnboardingFlow({ onComplete }) {
  const [step, setStep]         = useState(1)
  const [installed, setInstalled] = useState({ 'Claude Code': true })
  const [proxyType, setProxyType] = useState('9router')
  const [proxyUrl, setProxyUrl]   = useState('http://localhost:20128')
  const [proxyKey, setProxyKey]   = useState('')
  const [testStatus, setTestStatus] = useState('')
  const [tourSlide, setTourSlide]   = useState(0)

  const toggleInstalled = name => setInstalled(p => ({ ...p, [name]: !p[name] }))

  const testConnection = () => {
    setTestStatus('Testing...')
    setTimeout(() => setTestStatus('✅ Connection successful'), 1200)
  }

  const nextTour = () => {
    if (tourSlide < TOUR_SLIDES.length - 1) setTourSlide(t => t + 1)
    else setStep(5)
  }

  /* ── Step 1: Welcome ── */
  if (step === 1) return (
    <div className="onboarding-screen">
      <div className="onboarding-content center-content">
        <WorldGlobe size={148} interactive style={{ marginBottom: 36 }} />
        <h1 className="onboarding-title">Welcome to No. 1 Team</h1>
        <p className="onboarding-subtitle">
          Your multi-agent AI command center.<br />
          Coordinate Claude Code, Codex, Gemini CLI,<br />
          and more — all from one place.
        </p>
        <button className="btn-primary onboarding-btn-large" onClick={() => setStep(2)}>
          Get Started →
        </button>
        <div style={{ marginTop: 20, font: '400 12px var(--font-body)', color: 'var(--text-3)' }}>
          Takes about 2 minutes
        </div>
      </div>
    </div>
  )

  /* ── Step 2: Providers ── */
  if (step === 2) return (
    <div className="onboarding-screen">
      <div className="onboarding-content">
        <StepProgress current={1} total={4} />
        <h2 className="onboarding-heading">Which AI tools are installed?</h2>

        <div className="provider-list">
          {PROVIDERS.map(p => (
            <div key={p.name} className="provider-item">
              <span className="provider-icon">{p.icon}</span>
              <div style={{ flex: 1 }}>
                <div className="provider-name">{p.name}</div>
                <div className="provider-sub">{p.desc}</div>
              </div>
              <div className="provider-actions">
                <div
                  className={`toggle-switch ${installed[p.name] ? '' : 'off'}`}
                  onClick={() => toggleInstalled(p.name)}
                />
                <a href="#" className="install-link" onClick={e => e.preventDefault()}>Guide</a>
              </div>
            </div>
          ))}
        </div>

        <button className="btn-ghost" style={{ marginTop: 10 }}>+ Add Custom Provider</button>

        <div className="onboarding-footer">
          <button className="btn-ghost" onClick={() => setStep(1)}>← Back</button>
          <button className="btn-primary" onClick={() => setStep(3)}>Continue →</button>
        </div>
      </div>
    </div>
  )

  /* ── Step 3: Proxy ── */
  if (step === 3) return (
    <div className="onboarding-screen">
      <div className="onboarding-content">
        <StepProgress current={2} total={4} />
        <h2 className="onboarding-heading">Using a proxy or router?</h2>

        <div className="radio-group">
          <label className="radio-label">
            <input type="radio" name="proxy" checked={proxyType === '9router'} onChange={() => setProxyType('9router')} />
            <span>Yes — 9Router or OpenRouter</span>
          </label>
          <label className="radio-label">
            <input type="radio" name="proxy" checked={proxyType === 'other'} onChange={() => setProxyType('other')} />
            <span>Yes — Different proxy</span>
          </label>
          <label className="radio-label">
            <input type="radio" name="proxy" checked={proxyType === 'none'} onChange={() => setProxyType('none')} />
            <span>No — Direct connections only</span>
          </label>
        </div>

        {proxyType !== 'none' && (
          <div className="proxy-form">
            <div className="form-group">
              <label className="form-label">Proxy URL</label>
              <input type="text" value={proxyUrl} onChange={e => setProxyUrl(e.target.value)}
                placeholder="http://localhost:20128" className="form-input" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">API Key</label>
              <input type="password" value={proxyKey} onChange={e => setProxyKey(e.target.value)}
                placeholder="your-proxy-api-key" className="form-input" />
            </div>
          </div>
        )}

        {proxyType !== 'none' && (
          <button className="btn-secondary" style={{ marginBottom: 8 }} onClick={testConnection}>
            {testStatus || 'Test Connection'}
          </button>
        )}

        <div className="onboarding-footer">
          <button className="btn-ghost" onClick={() => setStep(2)}>← Back</button>
          <button className="btn-primary" onClick={() => setStep(4)}>Continue →</button>
        </div>
      </div>
    </div>
  )

  /* ── Step 4: Tour ── */
  if (step === 4) {
    const slide = TOUR_SLIDES[tourSlide]
    return (
      <div className="onboarding-screen">
        <div className="onboarding-content center-content">
          <StepProgress current={3} total={4} />

          <div style={{
            width: 88, height: 88, fontSize: 42,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface-3)', borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border-3)',
            marginBottom: 28, flexShrink: 0,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            {slide.icon}
          </div>

          <h2 className="tour-title">{slide.title}</h2>
          <p className="tour-desc">{slide.desc}</p>

          <div className="tour-dots">
            {TOUR_SLIDES.map((_, i) => (
              <span key={i} className={`dot ${i === tourSlide ? 'active' : ''}`}
                onClick={() => setTourSlide(i)} />
            ))}
          </div>

          <div className="onboarding-footer" style={{ width: '100%', marginTop: 28 }}>
            <button className="btn-ghost"
              onClick={() => tourSlide > 0 ? setTourSlide(t => t - 1) : setStep(3)}>
              ← Back
            </button>
            <button className="btn-primary" onClick={nextTour}>
              {tourSlide < TOUR_SLIDES.length - 1 ? 'Next →' : 'Finish Tour →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Step 5: Ready ── */
  if (step === 5) return (
    <div className="onboarding-screen">
      <div className="onboarding-content center-content">
        <StepProgress current={4} total={4} />
        <div style={{
          width: 88, height: 88, fontSize: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))',
          borderRadius: 'var(--radius-xl)', border: '1px solid rgba(34,197,94,0.3)',
          marginBottom: 28, flexShrink: 0,
        }}>
          🚀
        </div>
        <h1 className="onboarding-title">You're all set.</h1>
        <p className="onboarding-subtitle">
          Your team is ready to work.<br />
          Type <code style={{ background: 'var(--surface-3)', padding: '2px 7px', borderRadius: 5, fontSize: 14, border: '1px solid var(--border-3)' }}>/</code> in the chat to see all commands.
        </p>
        <button className="btn-primary onboarding-btn-large" onClick={onComplete}>
          Launch No. 1 Team →
        </button>
      </div>
    </div>
  )

  return null
}
