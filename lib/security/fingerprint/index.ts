// lib/security/fingerprint/index.ts
//
// Punto de entrada de la huella de dispositivo v2. Lo usa el cliente para poner la cabecera
// `X-Hw-Fingerprint` en las llamadas que cuentan cupo.
//
// ── LA CACHÉ ES CACHÉ, NO IDENTIDAD ─────────────────────────────────────────
// Se guarda en `localStorage` solo para no recalcular canvas+WebGL+audio en cada carga (~15-30 ms).
// Si el usuario la borra —que es justo lo que hace quien rota cuentas— se RECALCULA IDÉNTICA a
// partir del hardware. Ahí está la diferencia con el `device_id`, que ERA la identidad y por eso
// bastaba con borrarlo para estrenar cupo.
//
// Que borrar el almacén no cambie la huella es el invariante central de este módulo, y está fijado
// por test.

import { safeGet, safeSet } from '@/lib/storage/safeLocalStorage'
import { collectSignals, serializeSignals, strongSignalCount, hardwareLooksConsistent } from './signals'
import { buildFingerprint, isValidFingerprint, FP_VERSION } from './hash'

const CACHE_KEY = 'vence_fp2'

export interface FingerprintResult {
  /** `fp2_<hash>` o null si no se pudo calcular (sin Web Crypto). */
  fingerprint: string | null
  /** Señales fuertes disponibles (canvas, WebGL, audio): 0-3. Es la CALIDAD de la huella. */
  strength: number
  /** ¿CPU y RAM declaradas son coherentes? `false` = entorno probablemente manipulado. */
  consistent: boolean
  /** ¿Vino de caché? (para telemetría; no cambia el valor) */
  cached: boolean
}

let enVuelo: Promise<FingerprintResult> | null = null

/**
 * Calcula (o recupera) la huella del dispositivo.
 *
 * Coalescencia de llamadas concurrentes: al cargar una página varias piezas pueden pedirla a la vez
 * y el canvas+audio no son gratis. Se comparte la misma promesa.
 */
export async function getDeviceFingerprint(): Promise<FingerprintResult> {
  if (typeof window === 'undefined') {
    return { fingerprint: null, strength: 0, consistent: true, cached: false }
  }
  const cached = safeGet(CACHE_KEY)
  if (isValidFingerprint(cached)) {
    return { fingerprint: cached, strength: -1, consistent: true, cached: true }
  }
  if (enVuelo) return enVuelo
  enVuelo = computar().finally(() => { enVuelo = null })
  return enVuelo
}

async function computar(): Promise<FingerprintResult> {
  const signals = await collectSignals()
  const fingerprint = await buildFingerprint(serializeSignals(signals))
  const strength = strongSignalCount(signals)
  const consistent = hardwareLooksConsistent(signals.cores, signals.memory)

  // Solo se cachea una huella VÁLIDA. Guardar `null` o basura convertiría un fallo transitorio
  // (Web Crypto no disponible durante un instante) en una identidad rota permanente.
  if (fingerprint) safeSet(CACHE_KEY, fingerprint)

  return { fingerprint, strength, consistent, cached: false }
}

/**
 * Versión síncrona para caminos que no pueden esperar (interceptores de cabeceras).
 * Devuelve la huella cacheada si la hay; si no, `null` y dispara el cálculo en segundo plano
 * para que la siguiente llamada ya la tenga.
 */
export function getCachedFingerprint(): string | null {
  if (typeof window === 'undefined') return null
  const cached = safeGet(CACHE_KEY)
  if (isValidFingerprint(cached)) return cached
  void getDeviceFingerprint()
  return null
}

/**
 * La huella que va en la cabecera `X-Hw-Fingerprint`.
 *
 * Convivencia v1↔v2 DURANTE LA MIGRACIÓN, y por eso es una sola función y no una copia en cada
 * llamante: mientras el parque no tenga v2 calculada, seguir mandando la v1 conserva lo poco que
 * ya funcionaba (v1 sobrevive al borrado de `localStorage`, aunque colisione). El servidor
 * distingue una de otra por el prefijo — `fp2_…` frente a `hw_…` — sin ambigüedad.
 *
 * Es SÍNCRONA a propósito: se llama al montar cabeceras, donde no se puede esperar a canvas+audio.
 * La primera visita manda v1 y deja la v2 calculándose; a partir de la siguiente, v2.
 */
export function getFingerprintHeader(): string | null {
  if (typeof window === 'undefined') return null
  const v2 = getCachedFingerprint()   // dispara el cálculo en segundo plano si aún no existe
  if (v2) return v2
  const v1 = safeGet('vence_hw_fingerprint')
  return v1 || null
}

export { FP_VERSION, isValidFingerprint }
