// useAgentMessages.js
// React hook for receiving agent messages from main process
// NOTE: This hook is available for future use. GeneralTab currently
// manages its own message state inline for simplicity.

import { useState, useEffect, useCallback } from 'react'

export function useAgentMessages(sessionId) {
  const [messages,    setMessages]    = useState([])
  const [isRunning,   setIsRunning]   = useState(false)
  const [taskType,    setTaskType]    = useState(null)
  const [agentStatus, setAgentStatus] = useState({})

  const addMessage = useCallback((msg) => {
    setMessages(prev => [...prev, {
      id:        Date.now() + Math.random(),
      timestamp: new Date(),
      ...msg,
    }])
  }, [])

  const sendTask = useCallback((message, agents, models, mode = 'manual') => {
    if (!sessionId || !message.trim()) return

    addMessage({
      sender: 'BOSS',
      agent:  'You',
      content: message,
      type:   'boss',
    })

    setIsRunning(true)
    const newStatus = {}
    agents.forEach(a => { newStatus[a] = 'running' })
    setAgentStatus(newStatus)

    if (window.teamAPI?.sendTask) {
      window.teamAPI.sendTask({
        message,
        sessionId,
        agents,
        models,
        mode,
      })
    }
  }, [sessionId, addMessage])

  const stopAll = useCallback(() => {
    if (window.teamAPI?.stopAllAgents) {
      window.teamAPI.stopAllAgents(sessionId)
    }
    setIsRunning(false)
  }, [sessionId])

  useEffect(() => {
    if (!sessionId || !window.teamAPI) return

    const onTaskType = (data) => {
      if (data.sessionId !== sessionId) return
      setTaskType(data.taskType)
      addMessage({
        sender: 'SYSTEM', agent: 'System',
        content: `Task type: ${data.taskType.icon} ${data.taskType.label}`,
        type: 'system',
      })
    }

    const onChunk = (data) => {
      if (data.sessionId !== sessionId) return
      setMessages(prev => {
        const lastMsg = [...prev].reverse().find(m => m.agentId === data.agentId && m.inProgress)
        if (lastMsg) {
          return prev.map(m => m.id === lastMsg.id ? { ...m, content: m.content + data.content } : m)
        }
        return [...prev, {
          id: Date.now() + Math.random(), sender: data.agent, agent: data.agent,
          agentId: data.agentId, content: data.content, inProgress: true,
          type: 'agent', timestamp: new Date(),
        }]
      })
    }

    const onDone = (data) => {
      if (data.sessionId !== sessionId) return
      setMessages(prev => prev.map(m =>
        m.agentId === data.agentId && m.inProgress ? { ...m, inProgress: false } : m
      ))
      setAgentStatus(prev => {
        const updated = { ...prev, [data.agentId]: 'done' }
        if (Object.values(updated).every(s => s === 'done' || s === 'error' || s === 'idle')) setIsRunning(false)
        return updated
      })
    }

    const onError = (data) => {
      if (data.sessionId !== sessionId) return
      addMessage({ sender: data.agent, agent: data.agent, agentId: data.agentId, content: `⚠️ ${data.error}`, type: 'error' })
      setAgentStatus(prev => ({ ...prev, [data.agentId]: 'error' }))
    }

    const onStopped = (data) => {
      if (data.sessionId !== sessionId) return
      setIsRunning(false)
      setAgentStatus({})
    }

    const removeTaskType = window.teamAPI.onTaskTypeDetected(onTaskType)
    const removeChunk    = window.teamAPI.onAgentChunk(onChunk)
    const removeDone     = window.teamAPI.onAgentDone(onDone)
    const removeError    = window.teamAPI.onAgentError(onError)
    const removeStopped  = window.teamAPI.onSessionStopped(onStopped)

    return () => {
      removeTaskType?.()
      removeChunk?.()
      removeDone?.()
      removeError?.()
      removeStopped?.()
    }
  }, [sessionId, addMessage])

  return { messages, isRunning, taskType, agentStatus, sendTask, stopAll, setMessages }
}
