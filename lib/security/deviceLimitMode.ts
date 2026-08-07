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

/**
 * ¿El cupo del DISPOSITIVO cuenta para este sujeto, aquí y ahora?
 *
 * Es la MISMA pregunta que se hace el servidor antes de rechazar un guardado, y por eso vive
 * aquí y no en cada endpoint: **la pantalla y el servidor tienen que decidir igual**.
 *
 * ── POR QUÉ EXISTE (T-657, 07/08/2026) ──────────────────────────────────────
 * No lo hacían. El servidor (`/api/v2/answer-and-save`) pasaba por `shouldBlock(modo)` y por la
 * lista de confirmados, así que en `shadow` no cortaba a nadie; pero
 * `/api/v2/daily-question/status` —lo ÚNICO que mira el cliente para levantar el muro— sumaba el
 * consumo del aparato SIEMPRE, sin mirar el modo ni los confirmados. Resultado: la UI le cortaba
 * el paso a quien el servidor habría dejado pasar, y como el muro sale ANTES de responder, el
 * evento del servidor no llegaba a emitirse nunca. Medido ese día: **59 cuentas free topadas sin
 * haber respondido una sola pregunta** (49 con cero), y **cero** eventos que lo contaran.
 *
 * La sombra existe justamente para no cortar mientras se mide (ver la nota de arriba). Una sombra
 * que corta en la pantalla no es una sombra.
 */
export function cuentaElCupoDelDispositivo(
  mode: DeviceLimitMode,
  fraudeConfirmado: boolean,
): boolean {
  if (!shouldEvaluate(mode)) return false
  return shouldBlock(mode) || fraudeConfirmado === true
}

/** Modo vigente en este proceso. */
export function currentDeviceLimitMode(): DeviceLimitMode {
  return resolveDeviceLimitMode(process.env.DEVICE_LIMIT_MODE)
}
