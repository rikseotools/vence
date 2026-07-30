// lib/security/deviceLimitMode.ts
//
// En qué modo está el límite por dispositivo: apagado, observando o cortando.
//
// ── POR QUÉ EXISTE (T-304, 30/07/2026) ──────────────────────────────────────
// El ancla nueva (huella de hardware v2) agrupa cuentas que ANTES no se agrupaban. Eso es
// exactamente lo que se buscaba… y también el riesgo: si la huella junta a dos personas que no
// tienen nada que ver, les cortamos el servicio sin haberlo comprobado. Y de eso ya hay
// precedente en este mismo subsistema — la huella v1 llegó a agrupar 83 cuentas bajo un solo
// valor por culpa de un hash corto.
//
// Por eso el enforcement no se enciende a ciegas: primero MIDE lo que habría hecho, sobre tráfico
// real y durante uno o dos días, y solo después se activa con los datos delante. El `shadow` no es
// una fase de pruebas de laboratorio: corre en producción, con usuarios reales, sin consecuencias
// para ellos.
//
//   off      · ni se evalúa. Rollback total sin desplegar.
//   shadow   · se evalúa y se REGISTRA lo que habría pasado. NADIE se bloquea. ← por defecto
//   enforce  · se bloquea de verdad.
//
// El defecto es `shadow` a propósito: si alguien despliega sin decidir, el resultado es medir, no
// cortar. Un fallo de configuración no puede dejar a un usuario legítimo sin servicio.

export type DeviceLimitMode = 'off' | 'shadow' | 'enforce'

export const DEVICE_LIMIT_MODE_DEFAULT: DeviceLimitMode = 'shadow'

/**
 * Resuelve el modo desde el entorno.
 *
 * Tolerante con el formato (espacios, mayúsculas) y estricta con el contenido: un valor que no
 * reconoce NO se interpreta como `enforce`. Un typo en una variable de entorno no puede acabar
 * cortándole el servicio a nadie.
 */
export function resolveDeviceLimitMode(
  raw: string | undefined | null,
): DeviceLimitMode {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'off' || v === 'false' || v === '0') return 'off'
  if (v === 'enforce' || v === 'on' || v === 'true' || v === '1') return 'enforce'
  if (v === 'shadow') return 'shadow'
  return DEVICE_LIMIT_MODE_DEFAULT
}

/** ¿Hay que consultar el uso del dispositivo? (en `off` ni se gasta la consulta) */
export function shouldEvaluate(mode: DeviceLimitMode): boolean {
  return mode !== 'off'
}

/** ¿Se corta de verdad? Solo en `enforce`. */
export function shouldBlock(mode: DeviceLimitMode): boolean {
  return mode === 'enforce'
}

/** Modo vigente en este proceso. */
export function currentDeviceLimitMode(): DeviceLimitMode {
  return resolveDeviceLimitMode(process.env.DEVICE_LIMIT_MODE)
}
