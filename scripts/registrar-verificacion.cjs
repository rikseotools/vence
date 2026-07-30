#!/usr/bin/env node
/**
 * Registra en `ai_verification_results` el veredicto de una auditoría del pipeline
 * de generación (`docs/maintenance/generar-preguntas-con-ia.md`).
 *
 *   node scripts/registrar-verificacion.cjs <batch_id> <paso7|paso9|paso9v2|paso9v3> "<nota>"
 *
 * Por qué existe (26/07/2026): el manual manda registrar el Paso 7 con
 * `ai_provider='claude_code'` y el Paso 9 con `claude_code_recheck` —y avisa de no
 * reutilizar el primero, porque machacaría el registro anterior—, pero no había
 * herramienta: se hacía a mano con un `INSERT` improvisado, o directamente no se
 * hacía. Medido ese día: **327 preguntas activas sin Paso 9 registrado**, en 24
 * lotes y de varias sesiones (T-155).
 *
 * Va de la mano del guardarraíl de `npm run batch:servido`, que desde esa fecha se
 * niega a dar un lote por cerrado si le falta cualquiera de los dos registros. Uno
 * comprueba, el otro rellena: sin el segundo, el primero solo sabe dar malas
 * noticias.
 *
 * IMPORTANTE — esto registra un veredicto LIMPIO. Si la auditoría encontró
 * defectos, primero se reparan y se vuelve a pasar (el manual manda iterar con un
 * agente aún más nuevo: `paso9v2`, `paso9v3`), y se registra la pasada que salió
 * limpia. Registrar una auditoría con hallazgos sin repararlos es peor que no
 * registrarla: deja una traza que dice que todo estaba bien.
 */
const fs = require('fs')
const path = require('path')
const pg = require('postgres')

const PROVIDERS = {
  paso7: 'claude_code',
  paso9: 'claude_code_recheck',
  paso9v2: 'claude_code_recheck_v2',
  paso9v3: 'claude_code_recheck_v3',
}
const DESCRIPCION = {
  paso7: 'Paso 7: doble auditoría ciega e independiente (checks + adversarial) sobre el borrador insertado en draft.',
  paso9: 'Paso 9: re-verificación POST-aplicación con agente NUEVO e independiente del Paso 7, leyendo la pregunta VIVA desde BD.',
  paso9v2: 'Paso 9 (2.ª pasada): re-verificación con un agente aún más nuevo tras reparar los defectos de la anterior.',
  paso9v3: 'Paso 9 (3.ª pasada): re-verificación con un agente aún más nuevo tras reparar los defectos de la anterior.',
}

const [BATCH, PASO, NOTA = ''] = process.argv.slice(2)
if (!BATCH || !PROVIDERS[PASO]) {
  console.error('uso: node scripts/registrar-verificacion.cjs <batch_id> <paso7|paso9|paso9v2|paso9v3> "<nota>"')
  process.exit(1)
}

const url = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })

;(async () => {
  const filas = await s`SELECT q.id, q.primary_article_id AS aid, a.law_id
                          FROM questions q JOIN articles a ON a.id = q.primary_article_id
                         WHERE ${BATCH} = ANY(q.tags)`
  if (!filas.length) {
    console.error(`❌ el batch "${BATCH}" no tiene preguntas`)
    await s.end()
    process.exit(2)
  }
  const explicacion = `${DESCRIPCION[PASO]} Batch ${BATCH}. Veredicto LIMPIO.${NOTA ? ' ' + NOTA : ''}`
  for (const q of filas) {
    await s`INSERT INTO ai_verification_results
              (question_id, article_id, law_id, article_ok, answer_ok, options_ok, enunciado_ok, explanation_ok,
               is_correct, confidence, explanation, ai_provider, ai_model, review_method_version, verified_at)
            VALUES (${q.id}, ${q.aid}, ${q.law_id}, true, true, true, true, true,
                    true, 'high', ${explicacion}, ${PROVIDERS[PASO]}, 'claude-sonnet-4-6', ${PASO + '_v1'}, now())
            ON CONFLICT (question_id, ai_provider)
            DO UPDATE SET explanation = EXCLUDED.explanation, verified_at = now()`
  }
  console.log(`📋 ${PASO} registrado para ${filas.length} preguntas de ${BATCH} (ai_provider=${PROVIDERS[PASO]})`)
  console.log('   Cierra el lote con: npm run batch:servido -- ' + BATCH)
  await s.end()
})().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
