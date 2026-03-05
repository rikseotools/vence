// hooks/useMedalChecker.ts
// Hook para verificar y otorgar medallas automaticamente

import { useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

export function useMedalChecker() {
  const { user } = useAuth() as any

  const checkMedalsAfterTest = useCallback(async () => {
    if (!user) return []

    try {
      const res = await fetch('/api/medals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const data = await res.json()

      if (data.success && data.newMedals?.length > 0) {
        console.log(`🏆 ¡${data.newMedals.length} nueva(s) medalla(s) conseguida(s)!`)
        return data.newMedals
      }
    } catch (error) {
      console.error('Error checking medals after test:', error)
    }

    return []
  }, [user])

  const checkMedalsNow = useCallback(async () => {
    return await checkMedalsAfterTest()
  }, [checkMedalsAfterTest])

  return {
    checkMedalsAfterTest,
    checkMedalsNow
  }
}

export function useTestMedalIntegration() {
  const { checkMedalsAfterTest } = useMedalChecker()

  const onTestCompleted = useCallback(async () => {
    setTimeout(async () => {
      try {
        await checkMedalsAfterTest()
      } catch (error) {
        console.error('Error in medal integration:', error)
      }
    }, 2000)
  }, [checkMedalsAfterTest])

  return {
    onTestCompleted
  }
}
