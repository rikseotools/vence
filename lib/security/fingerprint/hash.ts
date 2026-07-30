// lib/security/fingerprint/hash.ts
//
// El hash de la huella de dispositivo. Separado de la recolección a propósito: esto se puede
// testear sin DOM, y la recolección sin criptografía.
//
// POR QUÉ NO VALE EL HASH DE v1: era casero de 32 bits (`hash = ((hash<<5)-hash)+char; hash |= 0`)
// y en base36 daba ~6 caracteres. Con 6.248 dispositivos observados eso colisiona por diseño, y se
// notó: huellas con 83 cuentas distintas. Un identificador que fusiona a 83 personas no sirve ni
// para bloquear (bloquearía a 82 inocentes) ni para medir.
//
// SHA-256 vía Web Crypto, que está en todos los navegadores que soportamos y no añade dependencias.

/** Prefijo versionado. Cambiarlo invalida el corpus: hacerlo SOLO si cambian las señales. */
export const FP_VERSION = 'fp2'

/**
 * Longitud del hash que se guarda. 32 hex = 128 bits.
 *
 * Sobra para no colisionar jamás a esta escala (millones de dispositivos) y evita almacenar el
 * SHA-256 entero, que no aporta nada aquí. NO bajar de esto por "ahorrar": el problema de v1 fue
 * exactamente ese ahorro.
 */
export const FP_HASH_LEN = 32

/**
 * SHA-256 del material, en hexadecimal.
 *
 * Devuelve `null` si el entorno no tiene Web Crypto (contexto inseguro, navegador antiguo). `null`
 * es un resultado legítimo que el llamante debe manejar: NUNCA se inventa una huella, porque una
 * huella inventada agruparía dispositivos que no tienen nada que ver.
 */
export async function sha256Hex(material: string): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle
    if (!subtle) return null
    const bytes = new TextEncoder().encode(material)
    const digest = await subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return null
  }
}

/**
 * Huella final: `fp2_<32 hex>`, o `null` si no se pudo calcular.
 *
 * El prefijo permite convivir con las huellas v1 (`hw_…`) durante la migración y saber de un
 * vistazo, en BD y en los logs, con qué versión se generó cada una.
 */
export async function buildFingerprint(material: string): Promise<string | null> {
  const hex = await sha256Hex(material)
  if (!hex) return null
  return `${FP_VERSION}_${hex.slice(0, FP_HASH_LEN)}`
}

/** ¿Es una huella v2 bien formada? Lo usan el servidor y los tests para no tragar basura. */
export function isValidFingerprint(fp: unknown): fp is string {
  return typeof fp === 'string' && new RegExp(`^${FP_VERSION}_[0-9a-f]{${FP_HASH_LEN}}$`).test(fp)
}
