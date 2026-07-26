#!/usr/bin/env node
/**
 * registrar-paso9.cjs — registrar en `ai_verification_results` el veredicto de la
 * RE-VERIFICACIÓN POST-APLICACIÓN (Paso 9 del manual `generar-preguntas-con-ia.md`).
 *
 * ## Por qué existe (26/07/2026)
 *
 * [T-155] midió que 327 preguntas activas se habían aprobado sin el Paso 9 y construyó el
 * GUARDARRAÍL (`npm run batch:servido` bloquea si falta). Pero la causa de fondo estaba una capa
 * más abajo: **el Paso 9 no tenía herramienta**. El manual lo documentaba como un `insert` a mano
 * copiado de un snippet —y con el cliente de Supabase, obsoleto tras el cutover a RDS—, así que
 * REGISTRAR el paso costaba más trabajo que hacerlo.
 *
 * Se ve en los datos: los 11 lotes ATC del 26/07 tenían el Paso 7 registrado y **ninguno el Paso
 * 9**, aunque el re-check se corrió de verdad en siete de ellos. El trabajo se hizo; el registro
 * no existía, así que para el sistema no había ocurrido — y el guardarraíl nuevo los bloquea a
 * todos, con razón.
 *
 * ## Uso
 *
 *   node scripts/registrar-paso9.cjs <batch_id> <veredictos.json> [--apply] [--modelo X]
 *
 * `veredictos.json`: `[{ "questionId": "<uuid|prefijo8>", "limpia": true|false, "hallazgo": "…" }]`
 * El `hallazgo` es OBLIGATORIO y con longitud mínima: lo que se guarda tiene que decir qué miró el
 * auditor, no solo que miró. Acepta prefijos de 8 caracteres (es como los reporta el gate).
 *
 * ## Qué NO hace
 *
 * No toca `lifecycle_state` ni el contenido de la pregunta: solo acredita una auditoría ya hecha.
 * No inventa veredictos — si no has corrido el re-check, esto no es el atajo: corre el Paso 9.
 * Registro PARCIAL permitido (útil cuando el re-check solo mira las reparadas), pero avisa
 * siempre de las que quedan sin acreditar.
 */
require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')
const sql = require('postgres')(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 })
// El criterio (qué acredita un Paso 9, y qué veredicto es escribible) vive en el núcleo PURO que
// ya decide el cierre del lote. Una segunda definición aquí dejaría al guardarraíl sin mandar.
const { validarVeredictosPaso9, PROVIDER_PASO7 } = require('../lib/generacion/cierreLote')

const [BATCH, FICHERO] = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const APPLY = process.argv.includes('--apply')
const val = (f, d) => {
  const i = process.argv.indexOf(f)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const MODELO = val('--modelo', 'claude-sonnet-4-6')
const PROVIDER = 'claude_code_recheck'

if (!BATCH || !FICHERO) {
  console.error('uso: node scripts/registrar-paso9.cjs <batch_id> <veredictos.json> [--apply] [--modelo X]')
  process.exit(1)
}

;(async () => {
  const preguntas = await sql`
    SELECT q.id, q.primary_article_id AS article_id, a.law_id
    FROM questions q LEFT JOIN articles a ON a.id = q.primary_article_id
    WHERE ${BATCH} = ANY(q.tags) ORDER BY q.created_at`
  if (!preguntas.length) {
    console.error(`❌ el lote ${BATCH} no existe (0 preguntas con ese tag)`)
    process.exit(2)
  }
  const ids = preguntas.map((p) => p.id)
  const meta = new Map(preguntas.map((p) => [p.id, p]))

  const p7 = new Set(
    (await sql`SELECT DISTINCT question_id FROM ai_verification_results
      WHERE question_id = ANY(${ids}) AND ai_provider = ${PROVIDER_PASO7}`).map((r) => r.question_id),
  )

  // Los prefijos de 8 chars se expanden aquí (I/O), no en el núcleo puro.
  const crudos = JSON.parse(fs.readFileSync(path.resolve(FICHERO), 'utf8'))
  const veredictos = crudos.map((v) => {
    const q = String(v.questionId || '')
    if (q.length === 8) {
      const coincide = ids.filter((id) => id.startsWith(q))
      if (coincide.length === 1) return { ...v, questionId: coincide[0] }
    }
    return v
  })

  const r = validarVeredictosPaso9(veredictos, ids, p7)
  console.log(`\n━━━ Paso 9 · ${BATCH} — ${preguntas.length} preguntas del lote ━━━`)
  console.log(`  veredictos escribibles: ${r.escribibles.length}`)
  if (r.errores.length) {
    console.log(`  ❌ ${r.errores.length} rechazado(s):`)
    r.errores.forEach((e) => console.log(`     ❌ ${e}`))
  }
  if (r.faltantes.length) {
    console.log(`  🟡 ${r.faltantes.length} sin acreditar (registro parcial):`)
    r.faltantes.forEach((id) => console.log(`     🟡 ${id.slice(0, 8)}`))
  }
  if (!r.ok) {
    console.log('\n  → NO se escribe nada. Corrige los veredictos rechazados.')
    await sql.end()
    process.exit(2)
  }
  if (!APPLY) {
    console.log('\n  → DRY-RUN. Repite con --apply para registrar.')
    await sql.end()
    return
  }

  let n = 0
  for (const v of r.escribibles) {
    const m = meta.get(v.questionId)
    await sql`
      INSERT INTO ai_verification_results
        (question_id, article_id, law_id, is_correct, article_ok, answer_ok, explanation_ok,
         confidence, explanation, ai_provider, ai_model, review_method_version, verified_at)
      VALUES (${v.questionId}, ${m.article_id}, ${m.law_id}, ${v.limpia}, ${v.limpia}, ${v.limpia},
         ${v.limpia}, ${v.limpia ? 'high' : 'medium'},
         ${`Paso 9 (re-verificación post-aplicación) del lote ${BATCH}, agente independiente del Paso 7. ${v.hallazgo}`},
         ${PROVIDER}, ${MODELO}, 'paso9-v1', now())
      ON CONFLICT (question_id, ai_provider) DO UPDATE SET
        is_correct = EXCLUDED.is_correct, article_ok = EXCLUDED.article_ok,
        answer_ok = EXCLUDED.answer_ok, explanation_ok = EXCLUDED.explanation_ok,
        confidence = EXCLUDED.confidence, explanation = EXCLUDED.explanation,
        ai_model = EXCLUDED.ai_model, verified_at = now()`
    n++
  }
  // Verificar DENTRO del proceso lo escrito: un 200 no es un registro.
  const escritas = (await sql`SELECT count(*)::int c FROM ai_verification_results
    WHERE question_id = ANY(${r.escribibles.map((x) => x.questionId)}) AND ai_provider = ${PROVIDER}`)[0].c
  console.log(`\n✅ registradas ${n} · verificadas en BD: ${escritas}/${r.escribibles.length}`)
  if (escritas !== r.escribibles.length) {
    console.error('❌ el recuento en BD no cuadra')
    await sql.end()
    process.exit(2)
  }
  console.log(`→ comprueba el cierre con: npm run batch:servido -- ${BATCH}`)
  await sql.end()
})()
