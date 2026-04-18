// hooks/useSessionControl.ts
// Hook para detectar uso simultáneo desde IPs distintas y bloquear
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'

export const CONTROLLED_EMAILS: string[] = [
  'edu77santoyo@gmail.com'
]

export interface SessionInfo {
  id: string
  startedAt: string
  ip: string | null
  city: string
  device: string
}

interface CheckActiveResponse {
  isControlled: boolean
  hasOtherSessions: boolean
  sessions?: SessionInfo[]
  currentSessionId?: string
  otherSessionsCount?: number
}

interface UseSessionControlReturn {
  showWarning: boolean
  sessions: SessionInfo[]
  isChecking: boolean
  isControlled: boolean
  isClosingOthers: boolean
  checkActiveSessions: () => Promise<void>
  closeOtherSessions: () => Promise<void>
}

export function useSessionControl(
  user: User | null,
  supabase: SupabaseClient | null
): UseSessionControlReturn {
  const [showWarning, setShowWarning] = useState(false)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const [isClosingOthers, setIsClosingOthers] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  const isControlled = Boolean(user?.email && CONTROLLED_EMAILS.includes(user.email))

  const checkActiveSessions = useCallback(async () => {
    if (!user || !supabase || !isControlled) return

    try {
      setIsChecking(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/sessions/check-active', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        console.error('[SessionControl] Error verificando sesiones:', response.status)
        return
      }

      const data: CheckActiveResponse = await response.json()

      if (data.currentSessionId) {
        setCurrentSessionId(data.currentSessionId)
      }

      if (data.isControlled && data.hasOtherSessions) {
        setSessions(data.sessions || [])
        setShowWarning(true)
        console.log(`[SessionControl] Simultaneidad detectada: ${user.email} con ${data.otherSessionsCount} sesiones desde otra IP`)

        try {
          await fetch('/api/sessions/track-block', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sessionsCount: (data.otherSessionsCount || 0) + 1
            })
          })
        } catch (trackError) {
          console.warn('[SessionControl] Error registrando evento:', trackError)
        }
      } else {
        setShowWarning(false)
        setSessions([])
      }
    } catch (error) {
      console.error('[SessionControl] Error:', error)
    } finally {
      setIsChecking(false)
    }
  }, [user, supabase, isControlled])

  const closeOtherSessions = useCallback(async () => {
    if (!user || !supabase || !currentSessionId) return

    try {
      setIsClosingOthers(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/sessions/close-others', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentSessionId })
      })

      if (response.ok) {
        console.log('[SessionControl] Sesiones remotas cerradas')
        setShowWarning(false)
        setSessions([])
        // Re-check tras un breve delay
        setTimeout(() => checkActiveSessions(), 3000)
      }
    } catch (error) {
      console.error('[SessionControl] Error cerrando sesiones:', error)
    } finally {
      setIsClosingOthers(false)
    }
  }, [user, supabase, currentSessionId, checkActiveSessions])

  useEffect(() => {
    if (user && isControlled) {
      const timer = setTimeout(() => {
        checkActiveSessions()
      }, 2000)

      return () => clearTimeout(timer)
    }
    return undefined
  }, [user, isControlled, checkActiveSessions])

  return {
    showWarning,
    sessions,
    isChecking,
    isControlled,
    isClosingOthers,
    checkActiveSessions,
    closeOtherSessions
  }
}

export default useSessionControl
