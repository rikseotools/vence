#!/usr/bin/env npx tsx
/**
 * sim-estimate-por-leyes.ts — comprueba contra la BD REAL que la estimación del
 * configurador "por leyes" (sin tema) cuenta lo mismo que un SQL escrito aparte.
 *
 * Por qué existe: el conteo que enciende la casilla "🏛️ Preguntas oficiales" en
 * /test/por-leyes (T-326) es el número que el usuario ve antes de decidir. Un contador
 * que miente es peor que no tenerlo, y un test con mocks no lo habría cazado: lo que
 * puede fallar es el criterio (oficiales de SU oposición, no cross), no la aritmética.
 *
 * No escribe nada. Uso:
 *   npx tsx --env-file=.env.local scripts/sim/sim-estimate-por-leyes.ts
 */
import { estimateAvailableQuestions } from '@/lib/api/test-config/queries'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

const POSITION = 'auxiliar_administrativo_estado'
const LEYES = ['Ley 39/2015', 'CE']

type Caso = { nombre: string; obtenido: number; esperado: number }

async function main() {
  const db = getDb()
  const casos: Caso[] = []

  for (const ley of LEYES) {
    // Contraste: SQL escrito aparte, resolviendo la ley igual que el código (la fila
    // con más preguntas activas, porque hay short_names duplicados).
    const [{ law_id }]: any = await db.execute(sql`
      SELECT l.id AS law_id
      FROM laws l
      WHERE l.short_name = ${ley}
      ORDER BY (SELECT count(*) FROM questions q JOIN articles a ON q.primary_article_id = a.id
                WHERE a.law_id = l.id AND q.is_active) DESC, l.id
      LIMIT 1`)
    if (!law_id) { console.log(`⚠️  ley no encontrada: ${ley}`); continue }

    const [{ n: totalSql }]: any = await db.execute(sql`
      SELECT count(*)::int AS n FROM questions q
      JOIN articles a ON q.primary_article_id = a.id
      WHERE q.is_active AND a.law_id = ${law_id}`)

    const [{ n: oficialesSql }]: any = await db.execute(sql`
      SELECT count(*)::int AS n FROM questions q
      JOIN articles a ON q.primary_article_id = a.id
      WHERE q.is_active AND a.law_id = ${law_id} AND q.is_official_exam
        AND q.exam_position IN ('auxiliar administrativo del estado','auxiliar administrativo',
                                'auxiliar_administrativo','auxiliar_administrativo_estado')`)

    const total = await estimateAvailableQuestions({
      topicNumber: null, positionType: POSITION as any, selectedLaws: [ley],
      selectedArticlesByLaw: {}, selectedSectionFilters: [], onlyOfficialQuestions: false,
      difficultyMode: 'random', focusEssentialArticles: false, scopeToPosition: false,
    })
    const oficiales = await estimateAvailableQuestions({
      topicNumber: null, positionType: POSITION as any, selectedLaws: [ley],
      selectedArticlesByLaw: {}, selectedSectionFilters: [], onlyOfficialQuestions: true,
      difficultyMode: 'random', focusEssentialArticles: false, scopeToPosition: false,
    })

    casos.push({ nombre: `${ley} · todas`, obtenido: total.count ?? -1, esperado: Number(totalSql) })
    casos.push({ nombre: `${ley} · solo oficiales propias`, obtenido: oficiales.count ?? -1, esperado: Number(oficialesSql) })
  }

  // Acotar a artículos concretos tiene que MOVER el número (un contador estático mentiría).
  const acotado = await estimateAvailableQuestions({
    topicNumber: null, positionType: POSITION as any, selectedLaws: ['Ley 39/2015'],
    selectedArticlesByLaw: { 'Ley 39/2015': ['13', '14'] }, selectedSectionFilters: [],
    onlyOfficialQuestions: false, difficultyMode: 'random', focusEssentialArticles: false,
    scopeToPosition: false,
  })
  const [{ n: acotadoSql }]: any = await db.execute(sql`
    SELECT count(*)::int AS n FROM questions q
    JOIN articles a ON q.primary_article_id = a.id
    JOIN laws l ON l.id = a.law_id
    WHERE q.is_active AND l.short_name = 'Ley 39/2015' AND a.article_number IN ('13','14')`)
  casos.push({ nombre: 'Ley 39/2015 · arts 13-14', obtenido: acotado.count ?? -1, esperado: Number(acotadoSql) })

  // Oposición sin exámenes oficiales propios: tiene que dar 0, NO el cross-oposición.
  const sinBanco = await estimateAvailableQuestions({
    topicNumber: null, positionType: 'agente_hacienda' as any, selectedLaws: ['Ley 39/2015'],
    selectedArticlesByLaw: {}, selectedSectionFilters: [], onlyOfficialQuestions: true,
    difficultyMode: 'random', focusEssentialArticles: false, scopeToPosition: false,
  })
  casos.push({ nombre: 'agente_hacienda · oficiales (sin banco propio)', obtenido: sinBanco.count ?? -1, esperado: 0 })

  // Sin leyes elegidas no hay nada que contar.
  const vacio = await estimateAvailableQuestions({
    topicNumber: null, positionType: POSITION as any, selectedLaws: [],
    selectedArticlesByLaw: {}, selectedSectionFilters: [], onlyOfficialQuestions: false,
    difficultyMode: 'random', focusEssentialArticles: false, scopeToPosition: false,
  })
  casos.push({ nombre: 'sin leyes seleccionadas', obtenido: vacio.count ?? -1, esperado: 0 })

  let fallos = 0
  for (const c of casos) {
    const ok = c.obtenido === c.esperado
    if (!ok) fallos++
    console.log(`${ok ? '✅' : '❌'} ${c.nombre}: ${c.obtenido}${ok ? '' : ` (esperado ${c.esperado})`}`)
  }
  console.log(fallos === 0 ? '\n✅ estimación por leyes coherente con la BD' : `\n❌ ${fallos} caso(s) divergentes`)
  process.exit(fallos === 0 ? 0 : 1)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
