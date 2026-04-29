import React from 'react'

export default function ErrorDisplay({ error, sessionId, onAction }) {
  const { type, agent, message, description, buttons } = error

  const handleButton = (btnLabel) => {
    const btn = btnLabel.toLowerCase()
    if (btn.includes('retry') || btn.includes('check proxy')) {
      window.teamAPI?.bossApprove?.(sessionId)
    } else if (btn.includes('save & exit') || btn.includes('cancel')) {
      window.teamAPI?.bossCancel?.(sessionId, 'Error recovery')
    }
    onAction?.(btnLabel)
  }

  return (
    <div className="error-display">
      <div className="error-header">
        <span className="error-icon">⚠️</span>
        <span className="error-title">{message}</span>
      </div>
      {description && <pre className="error-desc">{description}</pre>}
      <div className="error-buttons">
        {(buttons || []).map((btn, i) => (
          <button key={i} onClick={() => handleButton(btn)} className="error-btn">{btn}</button>
        ))}
      </div>
    </div>
  )
}
