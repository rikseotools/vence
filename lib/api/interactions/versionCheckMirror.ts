// lib/api/interactions/versionCheckMirror.ts — espejo de eventos version_check_* hacia
// observable_events. (T-168)
//
// `user_interactions` (donde aterrizan estos eventos) tiene RLS activo con CERO políticas
// para el rol de lectura de la flota — mismo patrón que T-573/T-038/T-220/T-638: cualquier
// SELECT devuelve 0 filas SIN error, indistinguible de "no hay eventos". Es justo la tabla
// donde vive `version_check_reload_immediate`, la señal que delata cuándo un deploy corta un
// test a un usuario real (incidente 26/07, ficha T-168: un usuario perdió su test y se dio de
// baja). Mientras la migración que abre esa tabla siga sin aplicar
// (`supabase/migrations/20260807_rls_user_interactions_lector.sql`), el próximo incidente
// igual de invisible que el anterior.
//
// En vez de esperar a esa migración, se espejan SOLO estos 3 eventos hacia
// `observable_events`, que ya es legible hoy — mismo patrón que
// `lib/api/topic-data/queries.ts` (evento `topic_mv_hueco`). NO se espeja el resto de
// `user_interactions`: eso reabriría el problema que RLS resuelve a propósito (mucho más
// ancho, con datos de negocio), y ningún otro `eventType` tiene esta urgencia.

import type { EventSeverity } from '@/lib/observability/sink'

const EVENTOS_A_ESPEJAR = new Set([
  'version_check_reload_immediate',
  'version_check_reload_deferred',
  'version_check_reload_suppressed',
])

/**
 * ¿Este `eventType` debe espejarse a `observable_events`? Si sí, con qué severidad.
 * Pura — sin I/O, testeable sin mockear el sink.
 *
 * `reload_immediate` es la señal de DAÑO (recarga sin avisar, puede cortar un test) → warn.
 * `deferred`/`suppressed` son las dos mitigaciones ya funcionando → info.
 */
export function severidadEspejoVersionCheck(eventType: string): EventSeverity | null {
  if (!EVENTOS_A_ESPEJAR.has(eventType)) return null
  return eventType === 'version_check_reload_immediate' ? 'warn' : 'info'
}

interface DatosEventoParaEspejo {
  eventType: string
  userId?: string | null
  pageUrl?: string | null
  deployVersion?: string | null
  sessionId?: string | null
  value?: Record<string, unknown> | null
}

export interface EventoEspejoVersionCheck {
  source: 'frontend'
  severity: EventSeverity
  eventType: string
  endpoint: string | null
  userId: string | null
  deployVersion: string | null
  metadata: Record<string, unknown>
}

/**
 * Construye el `ObservableEvent` a emitir para un evento `version_check_*` — o `null` si
 * este `eventType` no se espeja. Pura: separa la DECISIÓN de la ESCRITURA para poder
 * testear la primera sin un sink real.
 */
export function construirEventoEspejo(
  datos: DatosEventoParaEspejo
): EventoEspejoVersionCheck | null {
  const severity = severidadEspejoVersionCheck(datos.eventType)
  if (!severity) return null
  return {
    source: 'frontend',
    severity,
    eventType: datos.eventType,
    endpoint: datos.pageUrl || null,
    userId: datos.userId || null,
    deployVersion: datos.deployVersion || null,
    metadata: { ...(datos.value || {}), sessionId: datos.sessionId || null },
  }
}
