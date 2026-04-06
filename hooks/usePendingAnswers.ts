// hooks/usePendingAnswers.ts — Hook para mostrar respuestas pendientes de sincronizar
import { useState, useEffect } from 'react'
import { getPendingCount, onPendingChange, hasAuthFailure } from '@/utils/answerSaveQueue'

/**
 * Devuelve el número de respuestas pendientes de sincronizar
 * y si hay un fallo de auth persistente.
 */
export function usePendingAnswers(): { pending: number; authFailed: boolean } {
  const [pending, setPending] = useState(0)
  const [authFailed, setAuthFailed] = useState(false)

  useEffect(() => {
    setPending(getPendingCount())
    setAuthFailed(hasAuthFailure())

    const unsubscribe = onPendingChange((count) => {
      setPending(count)
      setAuthFailed(hasAuthFailure())
    })
    return unsubscribe
  }, [])

  return { pending, authFailed }
}
