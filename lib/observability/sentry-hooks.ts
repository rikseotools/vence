// lib/observability/sentry-hooks.ts
// Hooks compartidos para sentry.server.config.ts y sentry.edge.config.ts.
// Extraído para tener algo testeable — Sentry init no se puede llamar 2
// veces en tests, pero las funciones puras sí.
//
// Phase 3 hardening: tagDbTimeoutEvent marca eventos provocados por
// DbTimeoutError (lib/db/timeout.ts) con tag específico para filtrar
// en el panel Sentry y medir frecuencia de saturación del pooler.

import type { ErrorEvent, EventHint } from '@sentry/nextjs'

/**
 * beforeSend hook para Sentry. Si el evento se originó por un
 * DbTimeoutError, lo etiqueta como warning con tag quick_fail=db_timeout
 * y añade el timeoutMs al contexto extra.
 *
 * Otros eventos pasan sin tocar.
 *
 * Tipos: la signatura de `beforeSend` en Sentry SDK es
 *   (event: ErrorEvent, hint: EventHint) => ErrorEvent | PromiseLike<ErrorEvent | null> | null
 * (el tipo genérico `Event` cubre transactions/feedback además de errores).
 *
 * @param event Evento que Sentry está a punto de enviar (solo errores —
 *              `beforeSendTransaction` es separado)
 * @param hint Datos auxiliares (incluye originalException si aplica)
 * @returns El evento (potencialmente modificado) o null para descartar
 */
export function tagDbTimeoutEvent(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  const error = hint?.originalException
  if (!error || typeof error !== 'object') return event
  if (!('name' in error) || (error as { name?: string }).name !== 'DbTimeoutError') {
    return event
  }

  // Marcar como warning (no fatal) con tags + extra para filtros
  event.level = 'warning'
  event.tags = {
    ...event.tags,
    quick_fail: 'db_timeout',
    component: 'db_timeout',
  }

  if ('timeoutMs' in error) {
    event.extra = {
      ...event.extra,
      timeoutMs: (error as { timeoutMs: number }).timeoutMs,
    }
  }

  return event
}
