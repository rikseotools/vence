
// hooks/useSessionControl.ts
// Hook para controlar sesiones simultáneas de usuarios específicos
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'

// Lista de emails bajo control de sesiones simultáneas
// Exportada para usar en admin/fraudes
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
  checkActiveSessions: () => Promise<void>
  dismissWarning: () => void
}

export function useSessionControl(
  user: User | null,
  supabase: SupabaseClient | null
): UseSessionControlReturn {
  const [showWarning, setShowWarning] = useState(false)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [isChecking, setIsChecking] = useState(false)

  // Verificar si el usuario está bajo control
  const isControlled = Boolean(user?.email && CONTROLLED_EMAILS.includes(user.email))

  // Función para verificar sesiones activas
  const checkActiveSessions = useCallback(async () => {
    if (!user || !supabase || !isControlled) return

    // Verificar si ya se ignoró en esta sesión
    if (typeof window !== 'undefined') {
      const dismissed = sessionStorage.getItem('session_warning_dismissed')
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10)
        // Si se ignoró hace menos de 1 hora, no mostrar de nuevo
        if (Date.now() - dismissedTime < 60 * 60 * 1000) {
          return
        }
      }
    }

    try {
      setIsChecking(true)

      // Obtener token de sesión
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

      if (data.isControlled && data.hasOtherSessions) {
        setSessions(data.sessions || [])
        setShowWarning(true)
        console.log(`[SessionControl] Usuario ${user.email} tiene ${data.otherSessionsCount} sesiones activas`)

        // Registrar el evento de bloqueo para tracking
        try {
          await fetch('/api/sessions/track-block', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sessionsCount: (data.otherSessionsCount || 0) + 1 // +1 para incluir la sesión actual
            })
          })
          console.log(`[SessionControl] Evento de bloqueo registrado`)
        } catch (trackError) {
          console.warn('[SessionControl] Error registrando evento de bloqueo:', trackError)
        }
      }
    } catch (error) {
      console.error('[SessionControl] Error:', error)
    } finally {
      setIsChecking(false)
    }
  }, [user, supabase, isControlled])

  // Función para cerrar el modal
  const dismissWarning = useCallback(() => {
    setShowWarning(false)
  }, [])

  // Verificar sesiones cuando el usuario hace login
  useEffect(() => {
    if (user && isControlled) {
      // Pequeño delay para asegurar que la sesión esté registrada
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
    checkActiveSessions,
    dismissWarning
  }
}

// Export default para compatibilidad
export default useSessionControl
