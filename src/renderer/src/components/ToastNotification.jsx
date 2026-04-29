import React, { useState, useEffect, useCallback } from 'react'

const TYPE_STYLES = {
  success: { border: 'var(--status-approved)', icon: '✅' },
  error:   { border: 'var(--status-error)', icon: '❌' },
  info:    { border: 'var(--accent)', icon: 'ℹ️' },
  warning: { border: 'var(--status-pending)', icon: '⚠️' },
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback(({ message, type = 'info', duration = 3000 }) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type, duration }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  useEffect(() => {
    if (!window.teamAPI?.onToast) return
    const remove = window.teamAPI.onToast(data => addToast(data))
    return () => remove?.()
  }, [addToast])

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map(toast => {
        const s = TYPE_STYLES[toast.type] || TYPE_STYLES.info
        return (
          <div key={toast.id} className="toast-item" style={{ borderColor: s.border }}>
            <span>{s.icon}</span>
            <span>{toast.message}</span>
          </div>
        )
      })}
    </div>
  )
}
