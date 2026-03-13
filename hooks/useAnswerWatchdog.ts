// hooks/useAnswerWatchdog.ts
// Watchdog timer que detecta cuando la UI se congela durante la validación de respuestas.
// Si processingAnswer/isAnswering/isSaving lleva más de WATCHDOG_TIMEOUT_MS en true,
// ejecuta la función de recovery (reset estado + log).

import { useEffect, useRef } from 'react'

const WATCHDOG_TIMEOUT_MS = 20_000 // 20 segundos

export interface WatchdogConfig {
  /** Flag que indica si se está procesando una respuesta */
  isProcessing: boolean
  /** Función para resetear el estado bloqueado */
  onReset: () => void
  /** Nombre del componente (para logs) */
  component: string
  /** ID de la pregunta actual (para diagnóstico) */
  questionId?: string | null
  /** ID del usuario (para diagnóstico) */
  userId?: string | null
}

/**
 * Hook watchdog para detectar UI congelada durante validación de respuestas.
 *
 * Cuando isProcessing pasa a true, inicia un timer de 20s.
 * Si isProcessing sigue en true al expirar el timer, ejecuta onReset y logea el evento.
 * Si isProcessing vuelve a false antes, cancela el timer.
 */
export function useAnswerWatchdog({
  isProcessing,
  onReset,
  component,
  questionId,
  userId,
}: WatchdogConfig): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    if (isProcessing) {
      // Iniciar watchdog
      startTimeRef.current = Date.now()
      timerRef.current = setTimeout(() => {
        const durationMs = Date.now() - startTimeRef.current
        console.error(
          `🐕 [Watchdog] UI congelada ${durationMs}ms en ${component}. Reseteando estado.`
        )

        // Log a BD via API (fire-and-forget, no importar server code en client)
        fetch('/api/validation-error-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: '/api/answer',
            errorType: 'timeout',
            errorMessage: `Watchdog: UI congelada ${durationMs}ms en ${component}. processingAnswer no se reseteó.`,
            questionId: questionId || undefined,
            userId: userId || undefined,
            httpStatus: 0,
            durationMs,
          }),
        }).catch(() => { /* fire-and-forget */ })

        // Resetear estado
        onReset()
      }, WATCHDOG_TIMEOUT_MS)
    } else {
      // Cancelar watchdog si isProcessing vuelve a false
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    // Cleanup en unmount
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isProcessing, onReset, component, questionId, userId])
}
