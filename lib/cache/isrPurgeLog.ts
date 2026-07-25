// lib/cache/isrPurgeLog.ts
//
// Registro compartido de purgas del ISR de PÁGINA, para que una purga alcance a
// TODAS las instancias ECS y no solo a la que atiende la petición.
//
// POR QUÉ (medido, 25/07/2026):
// `revalidatePath()` de Next.js standalone limpia el ISR del PROCESO que lo ejecuta.
// Con N tasks de Fargate detrás del ALB, un POST a /api/purge-cache llega a UNA
// instancia: las demás siguen sirviendo el HTML viejo hasta que expire (hasta 24 h).
// Medido tras una purga: 1 de cada 6 peticiones servía lo nuevo. El parche era
// repetir el POST 15-20 veces y cruzar los dedos con el balanceo del ALB.
//
// EL PATRÓN, EL MISMO QUE YA RESOLVIÓ EL DATA CACHE:
// `lib/cache/versionStore` hace cross-instancia el `unstable_cache` metiendo una
// versión leída del KV compartido DENTRO de la clave. En el ISR de página no se
// puede: la clave es la ruta y la fija Next. Así que se invierte el mecanismo —
// en vez de que la versión entre en la clave, cada instancia OBSERVA el registro
// compartido y se auto-purga cuando ve que una ruta cambió de contador.
//
// Estructura en el KV (hash `isr_purge_log`): field = ruta, value = nº de purgas.
// Purgar = `hincrby(ruta, 1)`, que es atómico e idempotente frente a carreras: dos
// purgas concurrentes de la misma ruta dejan el contador en +2 y todas las
// instancias convergen igual. No hay epochs globales que sincronizar ni relojes.
//
// Se apoya en el sink AGNÓSTICO de `lib/cache/redis.ts` (Upstash hoy, ElastiCache
// en VPC mañana por `CACHE_PROVIDER`), así que cambiar de proveedor no toca esto.
//
// DEGRADACIÓN GRACEFUL: si el KV está caído, registrar y leer son no-ops silenciosos
// (el sink ya devuelve null / traga el error). Se pierde el alcance cross-instancia
// hasta que vuelva — exactamente el comportamiento de hoy, nunca peor.

import { incrementHashField, readHashCounters } from '@/lib/cache/redis'

/** Hash compartido: field = ruta ISR, value = contador de purgas. */
export const ISR_PURGE_LOG_KEY = 'isr_purge_log'

/**
 * TTL del hash, renovado en cada purga. Acota el crecimiento del registro sin
 * necesidad de podarlo: una ruta que nadie purga en 30 días desaparece con él, y
 * su desaparición NO provoca purgas espurias (ver `diffIsrPurgeLog`: una ruta que
 * baja o se va no dispara nada).
 */
export const ISR_PURGE_LOG_TTL_SECONDS = 30 * 24 * 3600

/** Snapshot {ruta: contador} del registro compartido. */
export type IsrPurgeSnapshot = Record<string, number>

/**
 * Deja constancia de la purga de estas rutas para el resto de instancias.
 * Best-effort: nunca lanza (una purga local válida no debe fallar porque el KV
 * esté caído). Devuelve las rutas efectivamente registradas.
 */
export async function recordIsrPurge(paths: string[]): Promise<string[]> {
  const limpias = [...new Set(paths.filter((p) => typeof p === 'string' && p.startsWith('/')))]
  if (!limpias.length) return []
  const ok = await Promise.all(
    limpias.map((p) => incrementHashField(ISR_PURGE_LOG_KEY, p, ISR_PURGE_LOG_TTL_SECONDS))
  )
  return limpias.filter((_, i) => ok[i])
}

/**
 * Lee el registro compartido. `null` si el KV no responde o no hay registro —
 * el observador distingue "no pude leer" (no hacer nada) de "leí un hash vacío".
 */
export async function readIsrPurgeLog(): Promise<IsrPurgeSnapshot | null> {
  return readHashCounters(ISR_PURGE_LOG_KEY)
}

/**
 * NÚCLEO PURO — qué rutas debe purgar ESTA instancia al comparar lo que vio la
 * última vez con lo que hay ahora en el registro compartido.
 *
 * Reglas, y el porqué de cada una:
 *  - `previo === null` (primera lectura tras arrancar) → NO purga nada, solo hace
 *    baseline. Una instancia recién arrancada tiene el ISR frío: purgar el
 *    histórico entero sería trabajo inútil y un pico de recomputación en cada
 *    despliegue o escalado, justo cuando la instancia es más frágil.
 *  - contador MAYOR que el visto (o ruta nueva) → purgar. Cubre el caso normal y
 *    el de una instancia que estuvo un rato sin poder leer el KV.
 *  - contador IGUAL, MENOR o ruta desaparecida → no purgar. Un contador que baja
 *    solo puede venir del TTL del hash o de un FLUSH del KV, y en ninguno de esos
 *    casos hay contenido nuevo que servir: purgar ahí sería tirar el ISR de todas
 *    las instancias a la vez por un evento de infraestructura.
 */
export function diffIsrPurgeLog(
  previo: IsrPurgeSnapshot | null,
  actual: IsrPurgeSnapshot
): string[] {
  if (previo === null) return []
  const pendientes: string[] = []
  for (const [path, contador] of Object.entries(actual)) {
    const visto = previo[path]
    if (visto === undefined || contador > visto) pendientes.push(path)
  }
  return pendientes.sort()
}
