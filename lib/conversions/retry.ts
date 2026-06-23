// lib/conversions/retry.ts
//
// Decisión de reintento del worker de conversiones. Módulo aparte y SIN deps
// (no toca BD ni la librería google-ads-api) → testeable en aislamiento, igual
// que outcome.ts.
//
// PRINCIPIO (raíz del fix 19-23/06): un fallo REINTENTABLE (red/OAuth/5xx) nunca
// debe producir un estado TERMINAL antes de una deadline. El contador de intentos
// solo modula el backoff; lo que decide el DLQ real es la EDAD de la fila, no un
// cap de intentos. Así una caída sostenida de oauth2.googleapis.com (varias horas
// o días, como el "Premature close" del incidente) no pierde la venta de forma
// permanente — se entrega en cuanto el endpoint vuelve, dentro de la ventana de
// importación offline de Google (~90 días). El veredicto TERMINAL de datos
// (no_identifier, partial_failure, config ausente) sigue resolviéndose antes, en
// classifyDeliveryOutcome → 'skip'; aquí solo llegan los reintentables.

/**
 * Ventana máxima durante la que se reintenta una entrega reintentable antes de
 * darla por muerta (DLQ real, status 'failed', requiere intervención humana).
 * 72h: holgado dentro de la ventana de ~90 días de Google y suficiente para
 * sobrevivir a una caída sostenida del endpoint de token OAuth.
 */
export const RETRY_DEADLINE_MS = 72 * 60 * 60 * 1000

/** Backoff exponencial acotado: 2min, 4, 8, 16, … hasta un techo de 30min. */
const BACKOFF_BASE_MS = 2 * 60 * 1000
const BACKOFF_CAP_MS = 30 * 60 * 1000
const BACKOFF_FACTOR = 2

export interface RetryDecision {
  /** true → DLQ real (status 'failed'): la fila superó la ventana de reintentos. */
  giveUp: boolean
  /** Momento del siguiente intento elegible (null si giveUp). */
  nextAttemptAt: Date | null
}

/**
 * Decide, ante un fallo REINTENTABLE, si seguir reintentando con backoff
 * exponencial + jitter o rendirse a DLQ por superar la deadline por edad.
 *
 * @param retryCount  intentos ya realizados (modula solo el backoff).
 * @param createdAt   alta de la fila (ancla de la deadline).
 * @param now         reloj inyectable.
 * @param jitter      [0,1) inyectable para tests; por defecto Math.random().
 */
export function decideRetry(
  retryCount: number,
  createdAt: Date,
  now: Date,
  jitter: number = Math.random(),
): RetryDecision {
  if (now.getTime() - createdAt.getTime() >= RETRY_DEADLINE_MS) {
    return { giveUp: true, nextAttemptAt: null }
  }
  const exp = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * BACKOFF_FACTOR ** retryCount)
  // Jitter ±20% para descorrelacionar reintentos (evita thundering herd cuando
  // se acumulan varias filas atascadas por la misma caída).
  const delay = exp * (0.8 + 0.4 * jitter)
  return { giveUp: false, nextAttemptAt: new Date(now.getTime() + delay) }
}
