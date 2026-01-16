// hooks/useSentryIssues.ts
// Hook para obtener issues sin resolver de Sentry (solo para admins)

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface SentryIssue {
  id: string
  title: string
  culprit: string
  count: string
  level: string
  lastSeen: string
  permalink: string
}

interface UseSentryIssuesResult {
  issuesCount: number
  issues: SentryIssue[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useSentryIssues(enabled: boolean = true): UseSentryIssuesResult {
  const [issuesCount, setIssuesCount] = useState(0)
  const [issues, setIssues] = useState<SentryIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { supabase, user } = useAuth()

  const fetchIssues = async () => {
    if (!enabled || !user || !supabase) return

    setLoading(true)
    setError(null)

    try {
      // Obtener token de sesión
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('No hay sesión activa')
        return
      }

      const response = await fetch('/api/admin/sentry-issues', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        setIssuesCount(data.count)
        setIssues(data.issues || [])
      } else {
        setError(data.error || 'Error desconocido')
      }
    } catch (err) {
      console.error('Error fetching Sentry issues:', err)
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIssues()

    // Refrescar cada 5 minutos
    const interval = setInterval(fetchIssues, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [enabled, user?.id])

  return {
    issuesCount,
    issues,
    loading,
    error,
    refetch: fetchIssues
  }
}
