/**
 * lib/api/filtered-questions/opcionesExamen.ts — cuántas opciones tiene el examen REAL
 * de una oposición (T-267).
 *
 * El dato existe desde siempre en `oposiciones.examen_config` (`{opciones: 3}`), pero
 * hasta ahora solo lo leía la landing: al servir, el número de opciones lo decidía la
 * pregunta. Por eso a Pilar le salían cuatro opciones preparando el Ayuntamiento de
 * Madrid, cuyo examen es de tres. Aquí ese dato entra por fin en el camino del serve.
 *
 * El puente `position_type` ↔ `slug` es necesario porque el serve trabaja con
 * `position_type` (`auxiliar_administrativo_ayuntamiento_madrid`) y la configuración
 * vive en `oposiciones.slug` (`auxiliar-administrativo-ayuntamiento-madrid`). La
 * conversión es mecánica (guiones bajos ↔ guiones) pero se comprueba contra la BD: si no
 * hay fila, no se reduce nada.
 *
 * Caché en proceso porque esto se consulta en CADA serve y cambia como mucho una vez al
 * año (cuando salen unas bases nuevas). TTL de 10 minutos: si alguien corrige el número
 * de opciones de una oposición, entra solo sin esperar a un deploy.
 */
import { sql } from 'drizzle-orm'
import { getDb, getPoolerDb } from '@/db/client'
import { opcionesDeExamen } from '@/lib/shuffle/subsetOrder'

const TTL_MS = 10 * 60 * 1000

interface Entrada {
  valor: number | null
  expira: number
}

const cache = new Map<string, Entrada>()

/** `auxiliar_administrativo_ayuntamiento_madrid` → `auxiliar-administrativo-ayuntamiento-madrid` */
export function positionTypeASlug(positionType: string): string {
  return positionType.trim().toLowerCase().replace(/_/g, '-')
}

function db() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

/**
 * Nº de opciones del examen de esa oposición, o `null` si no consta.
 *
 * `null` significa "servir como siempre". Ante cualquier duda (sin fila, campo ausente,
 * partes que discrepan, error de consulta) se devuelve `null`: recortar opciones de más
 * es un daño silencioso, y no recortar solo mantiene el comportamiento histórico.
 */
export async function opcionesExamenDe(positionType?: string | null): Promise<number | null> {
  if (!positionType) return null
  const clave = String(positionType)
  const ahora = Date.now()
  const cached = cache.get(clave)
  if (cached && cached.expira > ahora) return cached.valor

  let valor: number | null = null
  try {
    const filas = await db().execute(sql`
      SELECT examen_config FROM oposiciones WHERE slug = ${positionTypeASlug(clave)} LIMIT 1
    `)
    const arr = (filas as unknown as { rows?: unknown[] }).rows ?? (filas as unknown as unknown[])
    const row = (arr as Array<{ examen_config?: unknown }>)[0]
    valor = row ? opcionesDeExamen(row.examen_config) : null
  } catch {
    valor = null // fail-safe: nunca dejar de servir preguntas por esto
  }

  cache.set(clave, { valor, expira: ahora + TTL_MS })
  return valor
}

/** Solo para tests: vacía la caché. */
export function _resetCacheOpcionesExamen(): void {
  cache.clear()
}
