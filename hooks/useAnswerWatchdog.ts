// hooks/useAnswerWatchdog.ts
// Watchdog timer que detecta cuando la UI se congela durante la validación
// de respuestas (ExamLayout / TestLayout). Si processingAnswer/isSaving
// lleva más de WATCHDOG_TIMEOUT_MS de tiempo VISIBLE en true, ejecuta el
// recovery (reset estado + log).
//
// Robustez (refactor 31/05/2026):
//   - Cuenta tiempo VISIBLE acumulado, no wall-clock. Las pestañas en
//     background con timer throttling de Chrome (setTimeout puede dispararse
//     1 vez/min) ya NO generan eventos falsos de "UI congelada" de 58 min
//     que veíamos antes (pico 30/05/2026: 4 events con dur >5 min, máximo
//     58 min — todos correspondían a usuarios que dejaron la pestaña en
//     segundo plano, no a problemas reales del servidor).
//   - Tick fijo de 500 ms en lugar de un único setTimeout: insensible al
//     throttling agresivo de Chrome para pestañas hidden (ese throttle
//     afecta a cuándo se dispara, no a si se dispara cuando sí está visible).
//   - Reset del acumulador al cambiar `isProcessing` para evitar arrastrar
//     contadores entre operaciones consecutivas.
//
// Compatibilidad: la firma pública del hook NO cambia, así que los callers
// existentes (ExamLayout / TestLayout) no requieren tocar nada.

import { useEffect, useRef } from 'react'

/**
 * Tiempo VISIBLE acumulado tras el cual el watchdog dispara recovery.
 * 12 s: cubre 1× retry del cliente (10 s) + margen. Por debajo del total
 * de todos los retries en cliente (21 s), de forma que el usuario reciba
 * feedback antes de que el flow completo se rinda.
 */
const WATCHDOG_TIMEOUT_MS = 12_000

/**
 * Frecuencia del tick interno. 500 ms da granularidad de ±0.5 s al medir
 * el tiempo visible — irrelevante frente a un umbral de 12 s.
 */
const WATCHDOG_TICK_MS = 500

export interface WatchdogConfig {
  /** Flag que indica si se está procesando una respuesta. */
  isProcessing: boolean
  /** Función para resetear el estado bloqueado. */
  onReset: () => void
  /** Nombre del componente (para logs). */
  component: string
  /** ID de la pregunta actual (para diagnóstico). */
  questionId?: string | null
  /** ID del usuario (para diagnóstico). */
  userId?: string | null
}

interface VisibilityTarget {
  visibilityState: string
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

function isVisible(target: VisibilityTarget | null): boolean {
  if (!target) return true // SSR — asumimos visible y dejamos al cliente decidir
  return target.visibilityState === 'visible'
}

/**
 * Hook watchdog para detectar UI congelada durante validación de respuestas.
 *
 * Mide tiempo VISIBLE acumulado mientras `isProcessing=true`. Si supera
 * `WATCHDOG_TIMEOUT_MS`, dispara `onReset` y registra el evento. Pausa
 * automáticamente cuando la pestaña va a segundo plano y reanuda al volver
 * (sin sumar el tiempo en background como tiempo visible).
 */
export function useAnswerWatchdog({
  isProcessing,
  onReset,
  component,
  questionId,
  userId,
}: WatchdogConfig): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const visibleMsRef = useRef<number>(0)
  const lastTickRef = useRef<number>(0)
  const startWallRef = useRef<number>(0)
  const firedRef = useRef<boolean>(false)

  useEffect(() => {
    // Si no hay procesamiento, limpiar y salir.
    if (!isProcessing) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      visibleMsRef.current = 0
      firedRef.current = false
      return
    }

    // Iniciar tracking. visibleMsRef arranca en 0 — cada nueva pasada de
    // `isProcessing=true` reinicia el contador.
    visibleMsRef.current = 0
    lastTickRef.current = Date.now()
    startWallRef.current = Date.now()
    firedRef.current = false

    const doc: VisibilityTarget | null =
      typeof document !== 'undefined'
        ? (document as unknown as VisibilityTarget)
        : null

    const tick = () => {
      if (firedRef.current) return
      const now = Date.now()
      if (isVisible(doc)) {
        visibleMsRef.current += now - lastTickRef.current
      }
      lastTickRef.current = now

      if (visibleMsRef.current >= WATCHDOG_TIMEOUT_MS) {
        firedRef.current = true
        const visibleMs = Math.round(visibleMsRef.current)
        const wallMs = now - startWallRef.current
        console.error(
          `🐕 [Watchdog] UI congelada visibleMs=${visibleMs} wallMs=${wallMs} en ${component}. Reseteando estado.`,
        )

        // Log a BD vía API (fire-and-forget). durationMs reporta tiempo
        // visible, NO wall-clock, para evitar los falsos positivos de tab
        // en background que veíamos antes (dur=58 min).
        fetch('/api/validation-error-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: '/api/answer',
            errorType: 'timeout',
            errorMessage: `Watchdog: UI congelada ${visibleMs}ms (wallMs=${wallMs}) en ${component}. processingAnswer no se reseteó.`,
            questionId: questionId || undefined,
            userId: userId || undefined,
            httpStatus: 0,
            durationMs: visibleMs,
          }),
        }).catch(() => {
          /* fire-and-forget */
        })

        onReset()

        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }

    // Al volver de hidden, descartamos el delta acumulado mientras estuvo
    // en background (resetear lastTickRef al instante de visibilidad).
    const handleVisibilityChange = () => {
      lastTickRef.current = Date.now()
    }
    doc?.addEventListener('visibilitychange', handleVisibilityChange)

    intervalRef.current = setInterval(tick, WATCHDOG_TICK_MS)

    return () => {
      doc?.removeEventListener('visibilitychange', handleVisibilityChange)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isProcessing, onReset, component, questionId, userId])
}
