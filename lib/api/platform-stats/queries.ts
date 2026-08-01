// lib/api/platform-stats/queries.ts — las CIFRAS DE VOLUMEN que la plataforma se atribuye a sí
// misma («+X preguntas», «N oposiciones»), en un solo sitio y sacadas de la BD.
//
// ## Por qué existe (T-460, 01/08/2026)
//
// Estaban clavadas a mano en 13 sitios distintos y ninguna se acercaba a la realidad. La página de
// una pregunta decía «+5000 preguntas» cuando hay **145.206** — 29 veces menos. El footer, que sale
// en TODAS las páginas, decía «Más de 20.000». La sección de leyes, «+3000»: 48 veces menos.
//
// El fallo de fondo no es que un número envejeciera, es que **no había de dónde sacarlo bien**: cada
// pantalla se inventó el suyo el día que se escribió y ahí se quedó. Con una fuente única, envejecer
// deja de ser posible.
//
// Y el daño era comercial además de estético: nos estábamos infravalorando delante del usuario justo
// en el sitio donde le pedimos que se registre.
//
// ## Cacheado, porque esto no cambia de un minuto a otro
//
// Mismo patrón que `law-stats` (`versionedCache` + tag propio), incluida su lección: la variante
// interna LANZA si falla, para que `unstable_cache` **no cachee un error transitorio** — allí un
// timeout de BD envenenó la caché 6 h y generó una tanda de feedbacks de «no cargan los tests».
// Aquí, además, un fallo nunca debe romper la página: se devuelven los mínimos garantizados.

import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { versionedCache } from '@/lib/cache/versionedCache'
import { MINIMOS_GARANTIZADOS, type PlatformStats } from './shared'

// Lo PURO vive en `./shared` porque el hook de cliente lo necesita y este fichero arrastra `postgres`.
export { MINIMOS_GARANTIZADOS, formatVolumen, type PlatformStats } from './shared'


/** TTL 24 h: el volumen se mueve despacio y esto sale en el footer de todas las páginas. */
const TTL_PLATFORM_STATS = 86400

async function queryPlatformStats(): Promise<PlatformStats> {
  const db = getDb()
  const res = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM questions WHERE is_active)
        + (SELECT count(*) FROM psychometric_questions WHERE is_active) AS preguntas,
      (SELECT count(*) FROM oposiciones WHERE is_active)                AS oposiciones,
      (SELECT count(DISTINCT a.law_id)
         FROM questions q JOIN articles a ON a.id = q.primary_article_id
        WHERE q.is_active)                                              AS leyes`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = (Array.isArray(res) ? res[0] : (res as any)?.rows?.[0]) ?? {}
  const n = (v: unknown) => Number(v ?? 0)
  return { preguntas: n(row.preguntas), oposiciones: n(row.oposiciones), leyes: n(row.leyes) }
}

/** Lanza si la cuenta sale vacía, para no cachear un cero. Ver cabecera. */
async function queryPlatformStatsOrThrow(): Promise<PlatformStats> {
  const s = await queryPlatformStats()
  if (!s.preguntas || !s.oposiciones) throw new Error('platform-stats: conteo vacío, no se cachea')
  return s
}

const _cached = versionedCache(queryPlatformStatsOrThrow, {
  tag: 'platform-stats',
  keyParts: ['platform-stats-v1'],
  revalidate: TTL_PLATFORM_STATS,
})

export async function getPlatformStats(): Promise<PlatformStats> {
  try {
    return await _cached()
  } catch {
    return MINIMOS_GARANTIZADOS
  }
}

