// hooks/usePendingAnswers.ts — Hook para mostrar respuestas pendientes de sincronizar
import { useState, useEffect } from 'react'
import { getPendingCount, onPendingChange } from '@/utils/answerSaveQueue'

/**
 * Devuelve el número de respuestas pendientes de sincronizar.
 * Se actualiza automáticamente cuando cambia la cola.
 */
export function usePendingAnswers(): number {
  const [pending, setPending] = useState(0)

  useEffect(() => {
    // Valor inicial
    setPending(getPendingCount())

    // Suscribirse a cambios
    const unsubscribe = onPendingChange(setPending)
    return unsubscribe
  }, [])

  return pending
}
