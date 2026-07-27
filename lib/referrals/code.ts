// lib/referrals/code.ts — normalización PURA del código de referido (sin BD, sin I/O → testeable).
//
// POR QUÉ EXISTE (27/07/2026, medido): un embajador pegó su enlace en WhatsApp seguido de
// puntos suspensivos y texto sin espacio ("…/r/7d5f7ed7fe83..................esto es una
// plataforma de estudio…"). WhatsApp linkifica hasta el final del token, así que el enlace
// que circuló por el grupo llevaba la basura DENTRO del path. `/r/[code]` pasaba esa cadena
// tal cual al resolvedor, no encontraba nada, y el visitante aterrizaba en /embajadores
// SIN cookie y SIN `?ref=`: ni descuento para él, ni comisión para el embajador, y en
// silencio. Fueron 21 de los 216 clicks del sistema (10%), todos de la misma usuaria.
//
// La respuesta correcta no es pedirle al usuario que escriba mejor: es aceptar la entrada
// sucia en la frontera y canonizarla. Lo que NO se hace es adivinar (ver `ambiguo` abajo).

/** 6 bytes hex (ver `generateReferralCode` en logic.ts) → 12 caracteres [0-9a-f]. */
export const REFERRAL_CODE_LENGTH = 12
export const REFERRAL_CODE_RE = /^[0-9a-f]{12}$/
const HEX_PREFIX_RE = /^[0-9a-f]+/

export interface NormalizedReferralCode {
  /** Código canónico listo para resolver, o null si la entrada no contiene uno usable. */
  code: string | null
  /** true si hubo que limpiar basura pegada (la entrada NO era ya canónica). */
  sanitized: boolean
}

/**
 * Devuelve el código canónico contenido en `raw`, o null.
 *
 * - Acepta el código exacto (`sanitized: false`).
 * - Recupera el código cuando lleva basura pegada detrás (`sanitized: true`), **incluso si esa
 *   basura empieza por un carácter hexadecimal** (`…fe83entra aquí`: la `e` es hex). Esto es
 *   seguro porque los códigos son de **longitud FIJA** (12): un código de 13+ no existe, así que
 *   el prefijo de 12 es el ÚNICO candidato posible, y quien valida de verdad es la BD — si el
 *   prefijo no es un código activo, `resolveActiveReferralCode` devuelve null igual.
 *   (La primera versión de este fix rechazaba ese caso "por si acaso" y se dejaba fuera justo
 *   el patrón más común al pegar un enlace seguido de texto: escribir sin espacio.)
 */
export function normalizeReferralCode(raw: string | null | undefined): NormalizedReferralCode {
  if (!raw) return { code: null, sanitized: false }

  // El path puede venir percent-encoded (WhatsApp/clientes escapan espacios y puntos suspensivos).
  let s = raw
  try {
    s = decodeURIComponent(raw)
  } catch {
    // secuencia percent inválida → seguimos con el crudo, no es motivo para descartar
  }
  s = s.trim().toLowerCase()

  if (REFERRAL_CODE_RE.test(s)) return { code: s, sanitized: false }

  const hex = HEX_PREFIX_RE.exec(s)?.[0] ?? ''
  // Sin 12 hex por delante no hay código que rescatar (y NO rebuscamos en medio del texto:
  // el código va SIEMPRE al principio del path de /r/<code>).
  if (hex.length < REFERRAL_CODE_LENGTH) return { code: null, sanitized: false }

  return { code: hex.slice(0, REFERRAL_CODE_LENGTH), sanitized: true }
}
