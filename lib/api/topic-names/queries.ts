// lib/api/topic-names/queries.ts
// Fuente única de verdad para nombres de temas: tabla topics de BD.
// Reemplaza el uso de oposiciones.ts blocks[].themes[].name
import { getDb } from '@/db/client'
import { topics } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

// Cache en memoria (server-side, se limpia con cada deploy)
const cache = new Map<string, Record<number, string>>()

/**
 * Devuelve mapa {topic_number → title} para una oposición.
 * Cacheado en memoria del servidor — se invalida con cada deploy.
 */
export async function getTopicNamesMap(positionType: string): Promise<Record<number, string>> {
  if (cache.has(positionType)) return cache.get(positionType)!

  const db = getDb()
  const rows = await db
    .select({ topicNumber: topics.topicNumber, title: topics.title })
    .from(topics)
    .where(and(
      eq(topics.positionType, positionType),
      eq(topics.isActive, true),
    ))
    .orderBy(topics.topicNumber)

  const map: Record<number, string> = {}
  for (const r of rows) {
    map[r.topicNumber] = r.title
  }

  cache.set(positionType, map)
  return map
}

/**
 * Devuelve el nombre de un tema específico desde BD.
 */
export async function getTopicName(positionType: string, topicNumber: number): Promise<string | null> {
  const map = await getTopicNamesMap(positionType)
  return map[topicNumber] ?? null
}

/**
 * Devuelve nombres de múltiples temas desde BD.
 */
export async function getTopicNames(positionType: string, topicNumbers: number[]): Promise<Record<number, string>> {
  const map = await getTopicNamesMap(positionType)
  const result: Record<number, string> = {}
  for (const num of topicNumbers) {
    if (map[num]) result[num] = map[num]
  }
  return result
}
