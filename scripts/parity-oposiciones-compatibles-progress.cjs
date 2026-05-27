// Script de paridad para /api/v2/oposiciones-compatibles/progress.
//
// Compara la implementación legacy (GROUP BY runtime sobre test_questions)
// vs la refactorizada (SELECT a user_article_stats con SUM por article_id
// + INNER JOIN articles). Útil para:
//   - Validar paridad pre-deploy de cambios al cómputo de progress overlap.
//   - Detectar drift entre test_questions y user_article_stats si los
//     triggers materializadores se rompen o el backfill queda inconsistente.
//
// Uso: node scripts/parity-oposiciones-compatibles-progress.cjs
// Requiere: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en .env.local.
//
// Exit code: 0 si paridad perfecta, 1 si hay mismatches.
//
// Historia: creado 2026-05-27 durante el refactor que sustituye la
// agregación runtime por la tabla materializada. Verificó 14 casos
// (7 users × 2 sourcePositionType) — todos bit-a-bit.
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'})
const { createClient } = require('/home/manuel/Documentos/github/vence/node_modules/@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)

async function computeProgressOLD(userId, sourcePositionType) {
  const { data: tqRows } = await sb.from('test_questions')
    .select('article_id, is_correct')
    .eq('user_id', userId).not('article_id', 'is', null)
  if (!tqRows || tqRows.length === 0) return []
  const userArticleStats = new Map()
  for (const r of tqRows) {
    if (!userArticleStats.has(r.article_id)) userArticleStats.set(r.article_id, { total: 0, correct: 0 })
    const s = userArticleStats.get(r.article_id)
    s.total++
    if (r.is_correct) s.correct++
  }
  const articleLawMap = new Map()
  const articleIds = [...userArticleStats.keys()]
  for (let i = 0; i < articleIds.length; i += 500) {
    const chunk = articleIds.slice(i, i + 500)
    const { data: arts } = await sb.from('articles').select('id, law_id').in('id', chunk)
    for (const a of arts || []) if (a.law_id) articleLawMap.set(a.id, a.law_id)
  }
  return computeRest(userArticleStats, articleLawMap, sourcePositionType)
}

async function computeProgressNEW(userId, sourcePositionType) {
  // Fix: SUMAR por article_id (uas tiene PK más granular)
  const { data: uasRows } = await sb.from('user_article_stats')
    .select('article_id, total_questions, correct_answers')
    .eq('user_id', userId).not('article_id', 'is', null)
  if (!uasRows || uasRows.length === 0) return []
  const userArticleStats = new Map()
  for (const r of uasRows) {
    const existing = userArticleStats.get(r.article_id) || { total: 0, correct: 0 }
    existing.total += r.total_questions
    existing.correct += r.correct_answers
    userArticleStats.set(r.article_id, existing)
  }
  // Emular INNER JOIN: filtrar article_ids no presentes en articles
  const articleLawMap = new Map()
  const articleIds = [...userArticleStats.keys()]
  for (let i = 0; i < articleIds.length; i += 500) {
    const chunk = articleIds.slice(i, i + 500)
    const { data: arts } = await sb.from('articles').select('id, law_id').in('id', chunk)
    for (const a of arts || []) if (a.law_id) articleLawMap.set(a.id, a.law_id)
  }
  for (const artId of [...userArticleStats.keys()]) {
    if (!articleLawMap.has(artId)) userArticleStats.delete(artId)
  }
  return computeRest(userArticleStats, articleLawMap, sourcePositionType)
}

async function computeRest(userArticleStats, articleLawMap, sourcePositionType) {
  const positionTypes = [
    'auxiliar_administrativo_estado', 'auxiliar_administrativo_extremadura',
    'auxiliar_administrativo_galicia', 'auxiliar_administrativo_clm',
    'auxiliar_administrativo_cyl', 'auxiliar_administrativo_asturias',
    'auxiliar_administrativo_cantabria', 'guardia_civil', 'policia_nacional',
    'tramitacion_procesal', 'auxilio_judicial', 'gestion_procesal',
    'administrativo_estado', 'administrativo_seguridad_social',
  ]
  const targets = positionTypes.filter(p => p !== sourcePositionType)
  const results = []
  for (const positionType of targets) {
    const { data: tps } = await sb.from('topics').select('id').eq('position_type', positionType).eq('is_active', true)
    if (!tps || tps.length === 0) continue
    const { data: scopes } = await sb.from('topic_scope').select('law_id, article_numbers').in('topic_id', tps.map(t => t.id))
    const scopeByLaw = new Map()
    for (const s of scopes || []) {
      if (!s.law_id) continue
      if (s.article_numbers === null) {
        scopeByLaw.set(s.law_id, null)
      } else {
        const existing = scopeByLaw.get(s.law_id)
        if (existing !== null) {
          const merged = new Set([...(existing || []), ...s.article_numbers])
          scopeByLaw.set(s.law_id, merged)
        }
      }
    }
    if (scopeByLaw.size === 0) continue
    let totalArticlesInScope = 0, correctAnswers = 0, totalAnswers = 0, articlesTouched = 0
    const lawProgress = []
    for (const [lawId, artNumsOrNull] of scopeByLaw) {
      let lawCorrect = 0, lawTotal = 0, lawArticlesTouched = 0, lawTotalArticles = 0
      if (artNumsOrNull === null) {
        for (const [artId, stats] of userArticleStats) {
          if (articleLawMap.get(artId) === lawId) { lawCorrect += stats.correct; lawTotal += stats.total; lawArticlesTouched++ }
        }
        lawTotalArticles = -1
      } else {
        lawTotalArticles = artNumsOrNull.size
        for (const [artId, stats] of userArticleStats) {
          if (articleLawMap.get(artId) !== lawId) continue
          lawCorrect += stats.correct; lawTotal += stats.total; lawArticlesTouched++
        }
      }
      if (lawTotalArticles > 0) totalArticlesInScope += lawTotalArticles
      correctAnswers += lawCorrect; totalAnswers += lawTotal; articlesTouched += lawArticlesTouched
      if (lawTotal > 0) lawProgress.push({ lawId, lawCorrect, lawTotal, lawArticlesTouched, lawTotalArticles })
    }
    if (totalAnswers === 0) continue
    results.push({
      positionType, correctAnswers, totalAnswers,
      accuracy: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
      articlesTouched, totalArticles: totalArticlesInScope,
      lawProgress: lawProgress.sort((a, b) => a.lawId.localeCompare(b.lawId)),
    })
  }
  results.sort((a, b) => {
    if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers
    return a.positionType.localeCompare(b.positionType)
  })
  return results
}

const TARGET_USERS = [
  '00ed34ee-9b2e-462d-bcbc-a90ed1aab69c',
  '000514d5-7fe8-49d7-a253-97c20fabc373',
  '002c9aa5-f2a0-49ba-9619-a32f01a2f78c',
  '004b954f-d6cd-49b2-9bc3-fc3a6c8d2128',
  '00b67913-2b9c-4d2e-8c8e-f5b9e8c7e0fa',
  '1fbbe78c-0b27-4cae-bea9-b4cb46b80587',
  '7683ca9a-1f70-4c84-9c43-c3ec0d33e7f6',
]
const POSITION_TYPES = ['auxiliar_administrativo_estado', 'tramitacion_procesal']

;(async () => {
  let totalCases = 0, mismatches = 0
  for (const uid of TARGET_USERS) {
    for (const sourcePositionType of POSITION_TYPES) {
      totalCases++
      const t1 = Date.now()
      const oldR = await computeProgressOLD(uid, sourcePositionType)
      const oldMs = Date.now() - t1
      const t2 = Date.now()
      const newR = await computeProgressNEW(uid, sourcePositionType)
      const newMs = Date.now() - t2
      const oldJson = JSON.stringify(oldR)
      const newJson = JSON.stringify(newR)
      const match = oldJson === newJson
      console.log(`[${match ? '✓' : '✗'}] ${uid.slice(0, 8)} src=${sourcePositionType.padEnd(35)} | OLD ${String(oldMs).padStart(5)}ms (${oldR.length} ops) | NEW ${String(newMs).padStart(5)}ms (${newR.length} ops)`)
      if (!match) {
        mismatches++
        // Mostrar primer diff específico
        for (let i = 0; i < Math.max(oldR.length, newR.length); i++) {
          if (JSON.stringify(oldR[i]) !== JSON.stringify(newR[i])) {
            console.log(`  diff @${i}:`)
            console.log(`    OLD: ${JSON.stringify(oldR[i])}`)
            console.log(`    NEW: ${JSON.stringify(newR[i])}`)
            break
          }
        }
      }
    }
  }
  console.log(`\n=== ${mismatches} mismatches de ${totalCases} casos ===`)
  process.exit(mismatches === 0 ? 0 : 1)
})()
