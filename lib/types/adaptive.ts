// lib/types/adaptive.ts — Tipos compartidos del sistema adaptativo
// Usado por: testFetchers.ts (servidor), TestLayout.tsx (cliente), TestLayout.types.ts

export interface DifficultyBuckets<T> {
  easy: T[]
  medium: T[]
  hard: T[]
  extreme: T[]
}

/**
 * Catálogo adaptativo organizado por tema → dificultad × visto/no-visto.
 *
 * Claves de tema:
 * - "all" → test de un solo tema (backward compatible)
 * - "topic:5" → test multi-tema, preguntas del tema 5
 *
 * Ejemplo con 3 temas:
 * {
 *   neverSeen: { "topic:1": { easy: [...], medium: [...] }, "topic:5": { ... }, "topic:8": { ... } },
 *   answered:  { "topic:1": { easy: [...], medium: [...] }, ... },
 *   topicDistribution: { "topic:1": 8, "topic:5": 9, "topic:8": 8 },
 *   articlesSeen: ["116@CE", "9@CE"]
 * }
 */
export interface AdaptiveCatalog<T = unknown> {
  neverSeen: Record<string, DifficultyBuckets<T>>
  answered: Record<string, DifficultyBuckets<T>>
  /** Proporción inicial de preguntas por tema en el test */
  topicDistribution: Record<string, number>
  /** Artículos ya mostrados al usuario (formato "artNumber@lawShortName") — se actualiza en runtime */
  articlesSeen: string[]
}

/** Resultado de un fetcher adaptativo */
export interface AdaptiveResult<T = unknown> {
  isAdaptive: true
  activeQuestions: T[]
  questionPool: T[]
  adaptiveCatalog: AdaptiveCatalog<T>
}

/** Genera la clave de tema para el catálogo */
export function topicKey(tema: number | string | null | undefined): string {
  if (tema === null || tema === undefined) return 'all'
  return `topic:${tema}`
}

/** Genera la clave de artículo para tracking */
export function articleKey(articleNumber: string | undefined, lawShortName: string | undefined): string {
  return `${articleNumber || 'unknown'}@${lawShortName || 'unknown'}`
}

/** Crea un DifficultyBuckets vacío */
export function emptyBuckets<T>(): DifficultyBuckets<T> {
  return { easy: [], medium: [], hard: [], extreme: [] }
}

/**
 * Selecciona N preguntas sin repetir artículo hasta agotar los disponibles.
 * Agrupa por artículo, baraja los grupos, y toma 1 de cada artículo por ronda.
 * Solo repite artículo cuando no quedan artículos sin cubrir.
 *
 * @param candidates - Pool de preguntas candidatas (ya filtradas por dificultad, etc.)
 * @param count - Número de preguntas a seleccionar
 * @param getArticleKey - Función que extrae la clave de artículo de cada pregunta
 */
export function pickDiverseByArticle<T>(
  candidates: T[],
  count: number,
  getArticleKey: (q: T) => string
): T[] {
  if (candidates.length <= count) return [...candidates]

  // Agrupar por artículo
  const byArticle = new Map<string, T[]>()
  for (const q of candidates) {
    const key = getArticleKey(q)
    if (!byArticle.has(key)) byArticle.set(key, [])
    byArticle.get(key)!.push(q)
  }

  // Barajar el orden de los artículos y las preguntas dentro de cada grupo
  const articleGroups = Array.from(byArticle.values())
    .map(group => group.sort(() => Math.random() - 0.5))
    .sort(() => Math.random() - 0.5)

  // Round-robin: 1 de cada artículo por ronda
  const result: T[] = []
  let round = 0
  while (result.length < count) {
    let pickedThisRound = false
    for (const group of articleGroups) {
      if (result.length >= count) break
      if (round < group.length) {
        result.push(group[round])
        pickedThisRound = true
      }
    }
    if (!pickedThisRound) break // todos los grupos agotados
    round++
  }

  return result
}
