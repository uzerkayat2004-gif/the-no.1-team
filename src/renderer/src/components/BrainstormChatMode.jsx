import React from 'react'

export function BrainstormChatIndicator({ isActive, profiles, activeAgents }) {
  if (!isActive) return null
  return (
    <div className="brainstorm-indicator">
      <span>💬</span>
      <span>Brainstorm Chat Mode — All agents in group chat</span>
      <span style={{ color: 'var(--text-disabled)', marginLeft: 4, fontSize: 11 }}>
        Tag anyone with @Name
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
        {activeAgents.map(id => (
          <span key={id} style={{ width: 8, height: 8, borderRadius: '50%',
            background: profiles?.[id]?.color || '#888', display: 'inline-block' }}
            title={profiles?.[id]?.name || id} />
        ))}
      </div>
    </div>
  )
}

export function AgentTagDropdown({ profiles, activeAgents, onSelect, isOpen, onClose }) {
  if (!isOpen) return null
  return (
    <div className="tag-dropdown" style={{ bottom: 'calc(100% + 8px)', left: 0 }}>
      <div className="slash-item" onClick={() => { onSelect(null); onClose() }}>
        <div className="slash-icon">👥</div><div className="slash-desc">Everyone</div>
      </div>
      {activeAgents.map(id => {
        const p = profiles?.[id]
        if (!p) return null
        return (
          <div key={id} className="slash-item" onClick={() => { onSelect([id]); onClose() }}>
            <div className="slash-icon"><span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} /></div>
            <div className="slash-desc">{p.name}</div>
          </div>
        )
      })}
    </div>
  )
}
