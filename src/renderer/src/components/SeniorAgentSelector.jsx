import React from 'react'

export default function SeniorAgentSelector({ activeAgents, profiles, onSelect }) {
  return (
    <div className="checkpoint-card">
      <p className="checkpoint-title" style={{ marginBottom: 6 }}>👑 Select Senior Agent for this session</p>
      <p className="checkpoint-desc">
        The Senior Agent combines research, leads brainstorm, and writes the final answer.
      </p>
      <div className="checkpoint-buttons">
        {activeAgents.map(agentId => {
          const profile = profiles?.[agentId]
          const color = profile?.color || '#888'
          return (
            <button key={agentId} onClick={() => onSelect(agentId)}
              className="checkpoint-btn secondary"
              style={{ borderColor: `${color}44`, background: `${color}11`, color }}>
              ⭐ {profile?.name || agentId}
            </button>
          )
        })}
        <button onClick={() => onSelect('auto')}
          className="checkpoint-btn primary">
          ⚡ Auto-Select
        </button>
      </div>
    </div>
  )
}
