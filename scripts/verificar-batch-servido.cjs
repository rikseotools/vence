#!/usr/bin/env node
/**
 * CIERRE DE LOTE: comprobar que las preguntas nuevas **se están sirviendo de
 * verdad**, preguntándoselo a producción por HTTP — no mirando la BD.
 *
 * Por qué existe (incidente documentado en `generar-preguntas-con-ia.md` §Paso 11,
 * 01/06/2026): se añadieron 160 preguntas IA, en BD estaban las 50 del tema…
 * y `/api/topics` seguía devolviendo 10-28 porque solo se habían invalidado los
 * tags de Next y no la materialized view. **Aprobar un lote y verificarlo contra
 * la misma BD que acabas de escribir no demuestra nada**: hay tres capas de
 * caché (MV Postgres → Redis/ElastiCache → ISR+tags) entre la fila y el opositor.
 *
 * Uso:
 *   node scripts/verificar-batch-servido.cjs <batch_id> [--muestra 5] [--base https://www.vence.es]
 *
 * exit 0 = producción sirve al menos las preguntas que la BD dice para cada tema
 *          de la muestra · exit 2 = alguna capa de caché no propagó (o el tema
 *          no las escopa realmente).
 */
const fs = require('fs')
const path = require('path')
const pg = require('postgres')
const { estadoCierre } = require(path.join(__dirname, '..', 'lib', 'generacion', 'cierreLote'))

const argv = process.argv.slice(2)
const BATCH = argv[0]
const val = (n, d) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d)
const MUESTRA = Number(val('--muestra', 5))
const BASE = val('--base', 'https://www.vence.es')

if (!BATCH) {
  console.error('uso: node scripts/verificar-batch-servido.cjs <batch_id> [--muestra N] [--base URL]')
  process.exit(1)
}

const envPath = path.join(__dirname, '..', '.env.local')
const url = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })

;(async () => {
  // Temas donde el lote DEBE ser visible: los que escopan sus artículos.
  const temas = await s`
    SELECT DISTINCT o.slug, t.topic_number AS tema, t.id AS topic_id
    FROM questions q
    JOIN articles a ON a.id = q.primary_article_id
    JOIN topic_scope ts ON ts.law_id = a.law_id
        AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
    JOIN topics t ON t.id = ts.topic_id AND t.is_active AND t.disponible
    JOIN oposiciones o ON o.is_active AND replace(o.slug, '-', '_') = t.position_type
    WHERE ${BATCH} = ANY(q.tags) AND q.is_active
    ORDER BY o.slug, t.topic_number`

  if (!temas.length) {
    console.error(`❌ el lote ${BATCH} no es visible en ningún tema activo de una oposición activa.`)
    await s.end()
    process.exit(2)
  }

  console.log(`${temas.length} tema(s) sirven este lote · comprobando ${Math.min(MUESTRA, temas.length)} contra ${BASE}\n`)

  let fallos = 0
  for (const t of temas.slice(0, MUESTRA)) {
    // Verdad recomputada desde `questions`, con la MISMA semántica que la
    // materialized view `topic_law_question_summary` que lee la app. El matiz
    // que importa: la MV excluye `exam_case_id IS NOT NULL` (preguntas de
    // supuesto práctico). Contar "parecido" en vez de "igual" daba un desfase
    // fijo de 3-5 preguntas por tema y convertía el canary en un falso positivo
    // permanente — el mismo error que documenta `audit-served-questions.ts`
    // (una auditoría que reimplementa la lógica de producción, deriva).
    const bd = (await s`
      SELECT count(q.id)::int n
      FROM topic_scope ts
      LEFT JOIN articles a ON a.law_id = ts.law_id
          AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
      LEFT JOIN questions q ON q.primary_article_id = a.id AND q.is_active AND q.exam_case_id IS NULL
      WHERE ts.topic_id = ${t.topic_id}`)[0].n

    let api
    try {
      const r = await fetch(`${BASE}/api/topics/${t.tema}?oposicion=${t.slug}&_t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      api = (await r.json()).totalQuestions
    } catch (e) {
      fallos++
      console.log(`  ❌ ${t.slug} T${t.tema}: no se pudo consultar producción (${e.message})`)
      continue
    }

    // La API puede servir MÁS (otras leyes del tema), nunca menos que su propio scope.
    if (api >= bd) {
      console.log(`  ✅ ${t.slug} T${t.tema}: producción sirve ${api} (BD ${bd})`)
    } else {
      fallos++
      console.log(`  ❌ ${t.slug} T${t.tema}: producción sirve ${api} y la BD dice ${bd} → falta propagar (MV → Redis → tags)`)
    }
  }

  console.log(`\n${Math.min(MUESTRA, temas.length) - fallos}/${Math.min(MUESTRA, temas.length)} temas sirviendo lo esperado`)
  if (fallos) {
    console.log('→ refresca la MV (`SELECT refresh_topic_question_summary()`) e invalida tags con /api/admin/revalidate, y vuelve a correrlo.')
  }

  // ── Cierre según el MANUAL, no solo según la caché ───────────────────────────
  // El Paso 9 dice literalmente «sin este paso el lote NO se cierra», pero hasta el
  // 26/07/2026 nada lo comprobaba: se aprobaron 69 preguntas de T-146 sin él, y la
  // re-verificación posterior encontró 15 defectos que las 12 auditorías ciegas del
  // Paso 7 no vieron. Un paso obligatorio que solo vive en un markdown se salta, así
  // que lo verifica el comando que el propio manual señala como cierre obligatorio.
  const filas = await s`SELECT q.id::text AS "questionId", v.ai_provider AS provider
                          FROM questions q
                          LEFT JOIN ai_verification_results v ON v.question_id = q.id
                         WHERE ${BATCH} = ANY(q.tags)`
  const ids = [...new Set(filas.map((f) => f.questionId))]
  const cierre = estadoCierre(filas.filter((f) => f.provider), ids)
  if (cierre.cerrado) {
    console.log(`✅ verificación registrada: las ${ids.length} preguntas tienen Paso 7 (auditoría ciega) y Paso 9 (re-verificación)`)
  } else {
    console.log(`\n❌ LOTE NO CERRADO — ${cierre.motivo}`)
    console.log('   El manual (§Paso 9) es explícito: «Sin este paso el lote NO se cierra».')
    console.log('   Lanza el agente que falte, y registra el veredicto en `ai_verification_results`')
    console.log("   con ai_provider='claude_code' (Paso 7) o 'claude_code_recheck' (Paso 9).")
    if (cierre.sinPaso9.length && cierre.sinPaso9.length <= 5) console.log('   sin Paso 9: ' + cierre.sinPaso9.map((i) => i.slice(0, 8)).join(', '))
  }

  await s.end()
  if (fallos || !cierre.cerrado) process.exit(2)
})().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
