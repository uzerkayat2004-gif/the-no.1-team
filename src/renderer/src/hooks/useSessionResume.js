import { useState, useCallback } from 'react'

export function useSessionResume() {
  const [resumeContext, setResumeContext] = useState(null)
  const [isResuming, setIsResuming] = useState(false)

  const resumeSession = useCallback(async (folderRel, newTask) => {
    setIsResuming(true)
    try {
      const ctx = await window.teamAPI?.loadSessionContext(folderRel)
      const briefing = await window.teamAPI?.buildResumeBriefing(folderRel, newTask || '')
      setResumeContext({ folderRel, ...ctx, briefing, loadedAt: new Date() })
      return { ctx, briefing }
    } catch (err) {
      console.error('Resume error:', err)
      return null
    } finally {
      setIsResuming(false)
    }
  }, [])

  const clearResume = useCallback(() => { setResumeContext(null) }, [])

  return { resumeContext, isResuming, resumeSession, clearResume }
}
