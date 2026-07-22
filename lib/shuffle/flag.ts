/**
 * Barajar opciones — FASE 1: feature flag de runtime.
 *
 * Default OFF: mientras el flag no esté encendido, el fetcher NO permuta nada y todo
 * se sirve en orden natural (comportamiento idéntico al histórico). Se enciende por
 * lotes/canario vía SSM Parameter Store → env `FEATURE_SHUFFLE_OPTIONS`.
 *
 * Orden de despliegue seguro (spec §7): migración → backfill → código con flag off →
 * encender para una oposición/usuario piloto → ampliar.
 */

/** ¿Está el barajado de opciones activo globalmente? (SSM runtime → env). */
export function isShuffleEnabled(): boolean {
  return process.env.FEATURE_SHUFFLE_OPTIONS === 'true'
}

/**
 * Rollout por oposición (opcional, granular). `FEATURE_SHUFFLE_OPTIONS_SCOPE`:
 *   - vacío / 'all'  → aplica a todas cuando isShuffleEnabled() está on.
 *   - lista CSV de position_type → solo esas oposiciones se barajan.
 * Permite un piloto (p.ej. una oposición) sin barajar el resto.
 */
export function isShuffleEnabledFor(positionType?: string | null): boolean {
  if (!isShuffleEnabled()) return false
  const scope = (process.env.FEATURE_SHUFFLE_OPTIONS_SCOPE || '').trim()
  if (scope === '' || scope.toLowerCase() === 'all') return true
  if (!positionType) return false
  const allowed = scope
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return allowed.includes(positionType)
}
