// lib/conversions/outcome.ts
// Decisión de enrutado del worker de conversiones. Módulo aparte y SIN deps
// pesadas (no importa los destinos / google-ads-api) → testeable en aislamiento.

/**
 * Dado el resultado de entrega, decide qué hacer con la fila del outbox:
 * - `deliver`: entregada (o validada en dryRun).
 * - `skip`: fallo TERMINAL en modo real → marcar `skipped`, NO reintentar
 *   (no atribuible / datos inválidos / config ausente; reintentar es inútil).
 * - `retry`: fallo reintentable (red/OAuth/5xx) o cualquier fallo en dryRun → retry/DLQ.
 */
export function classifyDeliveryOutcome(
  res: { ok: boolean; terminal?: boolean },
  dryRun: boolean,
): 'deliver' | 'skip' | 'retry' {
  if (res.ok) return 'deliver'
  if (res.terminal && !dryRun) return 'skip'
  return 'retry'
}
