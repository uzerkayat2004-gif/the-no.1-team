import React from 'react'

export default function CheckpointMessage({ checkpoint, sessionId, onAction }) {
  const { type, message, description, buttons } = checkpoint

  const handleButton = (buttonLabel) => {
    const lower = buttonLabel.toLowerCase()
    let action = 'approved'
    if (lower.includes('send back') || lower.includes('revise') || lower.includes('retry') || lower.includes('fix') || lower.includes('try again'))
      action = 'sendback'
    else if (lower.includes('cancel')) action = 'cancelled'
    else if (lower.includes('review code') || lower.includes('review')) action = 'review'
    else if (lower.includes('skip')) action = 'skip'

    if (action === 'sendback') {
      window.teamAPI?.bossSendBack(sessionId, null, '')
    } else if (action === 'cancelled') {
      window.teamAPI?.bossCancel(sessionId, '')
    } else {
      window.teamAPI?.bossApprove(sessionId)
    }
    onAction && onAction(action, buttonLabel)
  }

  return (
    <div className="checkpoint-card">
      <div className="checkpoint-header">
        <span className="checkpoint-icon">⏸</span>
        <span className="checkpoint-title">{message}</span>
      </div>
      {description && <p className="checkpoint-desc">{description}</p>}
      <div className="checkpoint-buttons">
        {(buttons || []).map((btnLabel, i) => {
          const isDanger  = btnLabel.toLowerCase().includes('cancel')
          const isPrimary = btnLabel.toLowerCase().includes('approve') || btnLabel.toLowerCase().includes('start')
          return (
            <button key={i} onClick={() => handleButton(btnLabel)}
              className={`checkpoint-btn ${isPrimary ? 'primary' : isDanger ? 'danger' : 'secondary'}`}>
              {btnLabel}
            </button>
          )
        })}
      </div>
    </div>
  )
}
