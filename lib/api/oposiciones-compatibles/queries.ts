import { getDb } from '@/db/client'
import { topics, topicScope, articles, laws } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { OPOSICIONES } from '@/lib/config/oposiciones'
import type { OposicionOverlap, LawOverlap } from './types'

// ============================================
// SCOPE EXPANSION: topic_scope → (law_id, article_number) tuples
// ============================================

/**
 * Expande el scope de una oposición a un set plano de (lawId, articleNumber).
 * Maneja NULL article_numbers (toda la ley) expandiendo desde la tabla articles.
 */
async function expandScope(
  db: ReturnType<typeof getDb>,
  positionType: string
): Promise<Map<string, Set<string>>> {
  // 1. Get all topics for this position_type
  const topicRows = await db
    .select({ id: topics.id })
    .from(topics)
    .where(
      and(eq(topics.positionType, positionType), eq(topics.isActive, true))
    )

  if (topicRows.length === 0) return new Map()

  const topicIds = topicRows.map((t) => t.id)

  // 2. Get all scope entries
  const scopeRows = await db
    .select({
      lawId: topicScope.lawId,
      articleNumbers: topicScope.articleNumbers,
    })
    .from(topicScope)
    .where(inArray(topicScope.topicId, topicIds))

  // 3. Group by law, handling NULL = whole law
  const scopeByLaw = new Map<string, string[] | null>()

  for (const row of scopeRows) {
    if (!row.lawId) continue
    const existing = scopeByLaw.get(row.lawId)
    if (row.articleNumbers === null) {
      scopeByLaw.set(row.lawId, null)
    } else if (existing !== null) {
      scopeByLaw.set(row.lawId, [
        ...(existing || []),
        ...row.articleNumbers,
      ])
    }
  }

  // 4. Expand NULL entries by querying articles table
  const result = new Map<string, Set<string>>()

  const expansionPromises = Array.from(scopeByLaw.entries()).map(
    async ([lawId, articleNums]) => {
      if (articleNums === null) {
        // Whole law: get all article_numbers from articles table
        const allArts = await db
          .select({ articleNumber: articles.articleNumber })
          .from(articles)
          .where(and(eq(articles.lawId, lawId), eq(articles.isActive, true)))

        result.set(lawId, new Set(allArts.map((a) => a.articleNumber)))
      } else {
        result.set(lawId, new Set(articleNums))
      }
    }
  )

  await Promise.all(expansionPromises)
  return result
}

// ============================================
// COMPUTE OVERLAP BETWEEN SOURCE AND ALL TARGETS
// ============================================

async function computeOposicionesCompatiblesInternal(
  sourcePositionType: string
): Promise<OposicionOverlap[]> {
  const db = getDb()

  // 1. Expand source scope
  const sourceScope = await expandScope(db, sourcePositionType)
  if (sourceScope.size === 0) return []

  // Flatten source into a Set of "lawId:articleNumber" for fast lookup
  const sourceSet = new Set<string>()
  for (const [lawId, artNums] of sourceScope) {
    for (const artNum of artNums) {
      sourceSet.add(`${lawId}:${artNum}`)
    }
  }

  // 2. Get all other active position types from config
  const targetOposiciones = OPOSICIONES.filter(
    (op) => op.positionType !== sourcePositionType
  )

  // 3. Expand scope for each target and compute overlap
  // Process in parallel batches of 10 to avoid overwhelming DB
  const results: OposicionOverlap[] = []
  const BATCH_SIZE = 10

  for (let i = 0; i < targetOposiciones.length; i += BATCH_SIZE) {
    const batch = targetOposiciones.slice(i, i + BATCH_SIZE)

    const batchResults = await Promise.all(
      batch.map(async (targetOp) => {
        const targetScope = await expandScope(db, targetOp.positionType)
        if (targetScope.size === 0) return null

        let totalArticles = 0
        let coveredArticles = 0
        const lawBreakdown: LawOverlap[] = []

        // Get law names for this target
        const targetLawIds = [...targetScope.keys()]
        if (targetLawIds.length === 0) return null

        const lawRows = await db
          .select({
            id: laws.id,
            shortName: laws.shortName,
            name: laws.name,
          })
          .from(laws)
          .where(inArray(laws.id, targetLawIds))

        const lawMap = new Map(lawRows.map((l) => [l.id, l]))

        for (const [lawId, targetArtNums] of targetScope) {
          const law = lawMap.get(lawId)
          if (!law) continue

          const targetArts = [...targetArtNums]
          const covered: string[] = []
          const missing: string[] = []

          for (const artNum of targetArts) {
            if (sourceSet.has(`${lawId}:${artNum}`)) {
              covered.push(artNum)
            } else {
              missing.push(artNum)
            }
          }

          totalArticles += targetArts.length
          coveredArticles += covered.length

          if (targetArts.length > 0) {
            lawBreakdown.push({
              lawId,
              lawShortName: law.shortName,
              lawName: law.name,
              coveredArticles: covered.length,
              totalArticles: targetArts.length,
              overlapPct: Math.round(
                (covered.length / targetArts.length) * 100
              ),
              coveredArticleNumbers: covered.sort(
                (a, b) => parseInt(a) - parseInt(b)
              ),
              missingArticleNumbers: missing.sort(
                (a, b) => parseInt(a) - parseInt(b)
              ),
            })
          }
        }

        if (totalArticles === 0) return null

        const overlapPct = Math.round(
          (coveredArticles / totalArticles) * 100
        )

        return {
          slug: targetOp.slug,
          nombre: targetOp.name,
          shortName: targetOp.shortName,
          badge: targetOp.badge,
          administracion: targetOp.administracion,
          overlapPct,
          coveredArticles,
          totalArticles,
          // Sort law breakdown by overlap descending
          lawBreakdown: lawBreakdown.sort(
            (a, b) => b.overlapPct - a.overlapPct
          ),
        } satisfies OposicionOverlap
      })
    )

    for (const r of batchResults) {
      if (r && r.totalArticles > 0) results.push(r)
    }
  }

  // Sort by overlap percentage descending
  return results.sort((a, b) => b.overlapPct - a.overlapPct)
}

// ============================================
// CACHED VERSION
// ============================================

export const getOposicionesCompatiblesCached = unstable_cache(
  computeOposicionesCompatiblesInternal,
  ['oposiciones-compatibles-v1'],
  { revalidate: false, tags: ['temario'] }
)

// Direct version (no cache) for testing
export { computeOposicionesCompatiblesInternal as computeOposicionesCompatibles }

// ============================================
// BILATERAL COMPARISON: A ↔ B
// ============================================

import type { TemarioComparison } from './types'

async function compareTemariosBilateralInternal(
  positionTypeA: string,
  positionTypeB: string
): Promise<TemarioComparison> {
  const db = getDb()

  const [scopeA, scopeB] = await Promise.all([
    expandScope(db, positionTypeA),
    expandScope(db, positionTypeB),
  ])

  // Collect all law IDs to fetch names
  const allLawIds = new Set([...scopeA.keys(), ...scopeB.keys()])
  if (allLawIds.size === 0) {
    return {
      shared: [], onlyA: [], onlyB: [],
      totalArticlesA: 0, totalArticlesB: 0, sharedArticles: 0,
      overlapPctAcoversB: 0, overlapPctBcoversA: 0,
    }
  }

  const lawRows = await db
    .select({ id: laws.id, shortName: laws.shortName, name: laws.name })
    .from(laws)
    .where(inArray(laws.id, [...allLawIds]))
  const lawMap = new Map(lawRows.map((l) => [l.id, l]))

  const shared: TemarioComparison['shared'] = []
  const onlyA: TemarioComparison['onlyA'] = []
  const onlyB: TemarioComparison['onlyB'] = []
  let totalArticlesA = 0
  let totalArticlesB = 0
  let sharedArticles = 0

  // Count total articles per scope
  for (const [, artNums] of scopeA) totalArticlesA += artNums.size
  for (const [, artNums] of scopeB) totalArticlesB += artNums.size

  // Process all laws
  for (const lawId of allLawIds) {
    const law = lawMap.get(lawId)
    if (!law) continue

    const artsA = scopeA.get(lawId)
    const artsB = scopeB.get(lawId)

    if (artsA && artsB) {
      // Shared law — compute article overlap
      const covered: string[] = []
      const missingInB: string[] = []
      for (const art of artsB) {
        if (artsA.has(art)) {
          covered.push(art)
        } else {
          missingInB.push(art)
        }
      }
      sharedArticles += covered.length

      shared.push({
        lawId,
        lawShortName: law.shortName,
        lawName: law.name,
        coveredArticles: covered.length,
        totalArticles: artsB.size,
        overlapPct: artsB.size > 0 ? Math.round((covered.length / artsB.size) * 100) : 0,
        coveredArticleNumbers: covered.sort((a, b) => parseInt(a) - parseInt(b)),
        missingArticleNumbers: missingInB.sort((a, b) => parseInt(a) - parseInt(b)),
      })
    } else if (artsA && !artsB) {
      onlyA.push({
        lawId,
        lawShortName: law.shortName,
        lawName: law.name,
        articleCount: artsA.size,
      })
    } else if (!artsA && artsB) {
      onlyB.push({
        lawId,
        lawShortName: law.shortName,
        lawName: law.name,
        articleCount: artsB.size,
      })
    }
  }

  // Sort shared by overlap descending
  shared.sort((a, b) => b.overlapPct - a.overlapPct)

  return {
    shared,
    onlyA,
    onlyB,
    totalArticlesA,
    totalArticlesB,
    sharedArticles,
    overlapPctAcoversB: totalArticlesB > 0 ? Math.round((sharedArticles / totalArticlesB) * 100) : 0,
    overlapPctBcoversA: totalArticlesA > 0 ? Math.round((sharedArticles / totalArticlesA) * 100) : 0,
  }
}

export const compareTemariosCached = unstable_cache(
  compareTemariosBilateralInternal,
  ['compare-temarios-v1'],
  { revalidate: false, tags: ['temario'] }
)
