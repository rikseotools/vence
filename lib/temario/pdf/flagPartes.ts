/**
 * PDF del temario por PARTES — feature flag de runtime (T-273, piloto).
 *
 * Misma forma que `lib/shuffle/flag.ts` (flag global + scope por oposición), a propósito: el
 * despliegue por lotes ya está resuelto en este repo y no hacía falta inventar otro contrato.
 *
 * ## Qué hace el piloto, y por qué NO puede empeorar nada
 *
 * Se aplica **solo donde hoy el usuario recibe un 413** (`tema_demasiado_grande`, el techo de
 * `PDF_MAX_CHARS`). Es decir: solo a quien ahora mismo **no recibe nada** y el botón le manda a
 * imprimir. Quien hoy descarga su PDF correctamente sigue recibiéndolo idéntico, con el flag
 * encendido o apagado — el camino de generación normal no se toca.
 *
 * Medido antes de construir esto: en 30 días hubo **5 rechazos** por el techo, todos de
 * `auxiliar-administrativo-estado` tema 109 (485.084 caracteres), o sea usuarios reales
 * intentándolo y quedándose sin material.
 *
 * ## Cómo se enciende
 *
 *   FEATURE_TEMARIO_PDF_PARTES=true                          → activo
 *   FEATURE_TEMARIO_PDF_PARTES_SCOPE=auxiliar_administrativo_estado   → solo esa (el piloto)
 *   FEATURE_TEMARIO_PDF_PARTES_SCOPE=all | (vacío)           → todas, una vez validado
 *
 * Default OFF: sin el flag, el 413 se sigue devolviendo tal cual. Revertir es apagar el flag, sin
 * redeploy.
 */

/** ¿Está el troceado de PDFs activo globalmente? (SSM runtime → env). */
export function isPdfPartesEnabled(): boolean {
  return process.env.FEATURE_TEMARIO_PDF_PARTES === 'true'
}

/**
 * Rollout por oposición. Acepta el `position_type` (con guiones bajos) o el slug (con guiones):
 * la ruta pública recibe el slug y el flag se configura en términos de oposición, así que exigir
 * una sola de las dos formas sería una trampa para quien lo encienda.
 */
export function isPdfPartesEnabledFor(oposicion?: string | null): boolean {
  if (!isPdfPartesEnabled()) return false
  const scope = (process.env.FEATURE_TEMARIO_PDF_PARTES_SCOPE || '').trim()
  if (scope === '' || scope.toLowerCase() === 'all') return true
  if (!oposicion) return false
  const norm = (s: string) => s.trim().toLowerCase().replace(/-/g, '_')
  const permitidas = scope.split(',').map(norm).filter(Boolean)
  return permitidas.includes(norm(oposicion))
}
