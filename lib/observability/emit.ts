// lib/observability/emit.ts
//
// Helpers `emit()` y `emitFireAndForget()` — delegan en el sink
// inyectable (ver `lib/observability/sink.ts`).
//
// FILOSOFÍA: el código de la app no conoce DÓNDE se escribe el evento.
// Eso lo decide `getSink()` por env/config. Migración Vercel→AWS = swap
// del sink en UNA línea, cero cambios en callers.
//
// Patrón fire-and-forget: NUNCA bloquea la respuesta del usuario. Si el
// sink falla, el evento se pierde (aceptable — el path principal va antes).
// El error se loguea a `console.warn` dentro del sink.

import { getSink } from './sink'

// Re-exportamos los tipos para que callers existentes no se rompan
// (back-compat: `import { ObservableEvent, EventSeverity } from
// '@/lib/observability/emit'` sigue funcionando).
export type {
  ObservableEvent,
  ObservableSink,
  EventSeverity,
  EventSource,
} from './sink'
import type { ObservableEvent } from './sink'

/**
 * Emite un evento — delega en el sink activo (`getSink()`). El sink se
 * encarga de la persistencia y del error handling interno; esta función
 * NUNCA propaga errores al caller.
 *
 * Uso típico:
 *   await emit({ source: 'vercel', severity: 'error', eventType: 'http_5xx',
 *                endpoint: '/api/foo', httpStatus: 503, errorMessage: '...' })
 */
export async function emit(event: ObservableEvent): Promise<void> {
  await getSink().emit(event)
}

/**
 * Variant fire-and-forget — no espera la promise. Para callers que no
 * pueden o no quieren `await emit(...)`.
 *
 * IMPORTANTE: cuando estés dentro de una promise que SÍ se awaita desde
 * fuera (path 5xx por ejemplo), prefiere `await emit(...)` para garantizar
 * que el evento persiste antes de que Vercel suspenda la lambda.
 *
 * El race del 47% pérdida (2026-05-26) venía de usar esta variante en un
 * path que internamente sí awaitaba otra operación — el INSERT del emit
 * quedaba huérfano y a veces no completaba. Si necesitas sincronización
 * con otra operación await en el mismo flujo, usa `await emit(...)`.
 */
export function emitFireAndForget(event: ObservableEvent): void {
  void emit(event)
}
