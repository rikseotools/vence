#!/usr/bin/env node
/**
 * Paso 8 del manual `generar-preguntas-con-ia.md`: transiciona un batch de
 * `draft` a `approved` y deja trazabilidad en `ai_verification_results`.
 *
 * Uso:
 *   node scripts/aprobar-batch-generado.cjs <batch_id> "<resumen de auditoría>"
 *
 * GUARDARRAÍLES (aborta sin transicionar nada si falla alguno):
 *   1. La verificación mecánica del batch debe estar limpia — se ejecuta
 *      `verificar-batch-generado.cjs` y se exige exit 0.
 *   2. Se exige un resumen de auditoría no trivial (≥ 80 chars): aprobar sin
 *      dejar constancia de QUIÉN auditó y QUÉ encontró es un falso verde.
 *   3. Se informa de dónde quedarán VISIBLES las preguntas (oposición/tema) para
 *      que aprobar nunca exponga contenido por sorpresa.
 *
 * La transición se hace SIEMPRE por `transition_question_state`: es la única vía
 * válida. `is_active` es GENERATED y un UPDATE directo falla por diseño.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const pg = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))

const [BATCH, RESUMEN] = process.argv.slice(2)
if (!BATCH || !RESUMEN) {
  console.error('uso: node scripts/aprobar-batch-generado.cjs <batch_id> "<resumen de auditoría>"')
  process.exit(1)
}
if (RESUMEN.length < 80) {
  console.error('❌ El resumen de auditoría es demasiado corto. Describe quién auditó, qué se encontró y qué se reparó.')
  process.exit(1)
}

const envPath = path.join(__dirname, '..', '.env.local')
const url = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })

;(async () => {
  // --- Guardarraíl 1: verificación mecánica limpia ---
  try {
    execFileSync('node', [path.join(__dirname, 'verificar-batch-generado.cjs'), BATCH], { stdio: 'inherit' })
  } catch {
    console.error('\n❌ La verificación mecánica NO está limpia. Repara antes de aprobar.')
    await s.end()
    process.exit(2)
  }

  // --- Guardarraíl 3: ¿dónde se volverán visibles? ---
  const alcance = await s`
    SELECT DISTINCT t.position_type, t.topic_number, t.disponible
    FROM questions q
    JOIN articles a ON a.id = q.primary_article_id
    JOIN topic_scope ts ON ts.law_id = a.law_id
    JOIN topics t ON t.id = ts.topic_id
    WHERE ${BATCH} = ANY(q.tags)`
  console.log('\nAlcance de visibilidad tras aprobar:')
  if (!alcance.length) console.log('   (ningún tema escopa esta ley — no se servirán en ningún test)')
  alcance.forEach((x) => console.log(`   · ${x.position_type} T${x.topic_number} — tema disponible=${x.disponible}`))

  const Q = await s`
    SELECT q.id, a.id AS article_id, a.law_id
    FROM questions q JOIN articles a ON a.id = q.primary_article_id
    WHERE ${BATCH} = ANY(q.tags) AND q.lifecycle_state = 'draft'`
  if (!Q.length) {
    console.log('\nNo hay preguntas en draft con ese tag. Nada que hacer.')
    await s.end()
    return
  }

  console.log(`\nTransicionando ${Q.length} preguntas draft → approved…`)
  const NOW = new Date().toISOString()
  let ok = 0
  const errores = []
  for (const q of Q) {
    try {
      await s`
        INSERT INTO ai_verification_results
          (question_id, article_id, law_id, article_ok, answer_ok, explanation_ok,
           confidence, explanation, ai_provider, ai_model, verified_at)
        VALUES (${q.id}, ${q.article_id}, ${q.law_id}, true, true, true, 'alta',
           ${RESUMEN}, 'claude_code', 'claude-opus-4-8', ${NOW})
        ON CONFLICT (question_id, ai_provider) DO UPDATE SET verified_at = ${NOW}`
      await s`SELECT transition_question_state(${q.id}::uuid, 'draft', 'approved',
        'ai_verified_perfect', NULL, NULL, ${'Batch ' + BATCH})`
      await s`UPDATE questions SET topic_review_status='perfect', verification_status='ok', verified_at=${NOW}
              WHERE id = ${q.id}`
      ok++
    } catch (e) {
      errores.push(`${q.id.slice(0, 8)}: ${e.message.slice(0, 100)}`)
    }
  }

  const f = (await s`SELECT count(*) tot,
      count(*) FILTER (WHERE lifecycle_state='approved') apr,
      count(*) FILTER (WHERE is_active) act
    FROM questions WHERE ${BATCH} = ANY(tags)`)[0]
  console.log(`\n✅ transicionadas: ${ok}/${Q.length}`)
  errores.forEach((e) => console.log(`   ❌ ${e}`))
  console.log(`   estado final → total=${f.tot} approved=${f.apr} is_active=${f.act}`)

  await s.end()
  if (errores.length) process.exit(2)
})().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
