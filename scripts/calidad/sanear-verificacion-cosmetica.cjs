#!/usr/bin/env node
// scripts/calidad/sanear-verificacion-cosmetica.cjs — el APLICAR de [T-465]. (08/08/2026)
//
// `audit-verificacion-cosmetica.cjs` es SOLO LECTURA a propósito: ese script mide, este limpia.
// Existía el hueco porque la decisión ("¿limpiar los flags o dejarlos?") era de producto, no
// técnica — Manuel la resolvió el 08/08 (pregunta #111 del embudo): OPCIÓN A, limpiar.
//
// ## Qué hace, y por qué es SEGURO (las dos condiciones de Manuel, verificadas antes de escribir
// este script — ver docs/roadmap/tareas-pendientes.md → T-465)
//
//   1. `article_ok`/`answer_ok` viven en `ai_verification_results`, NO en `questions`. No hay
//      NINGÚN trigger en `ai_verification_results` (comprobado: `information_schema.triggers`
//      da 0 filas) y `questions.is_active` es GENERATED solo desde `lifecycle_state` — nulear
//      estos dos flags no puede desactivar ni jubilar ninguna pregunta por sí solo. El único cron
//      que degrada preguntas por antigüedad sin verificar (`lifecycle_grandfather_expire`, aún
//      SIN programar) mira `questions.verified_at`, un campo distinto que esto no toca.
//   2. Deja rastro: por cada fila que limpia, inserta un `observable_events` con el MISMO
//      `event_type` que ya usa el trigger de prevención (`verificacion_cosmetica_firmaba_fondo`)
//      — no un tipo nuevo, para que el saneamiento retroactivo y la prevención en vivo compartan
//      serie temporal. Así dentro de tres meses un NULL se lee como "se detectó y saneó", no
//      como "nunca se miró".
//
// Mismo criterio que la auditoría (reutilizado, no reimplementado):
// `lib/calidad/verificacionCosmetica.cjs` → `clasificarFirma` (fila) + `soloVerificadaPorPasesCosmeticos`
// (pregunta). Solo se tocan las preguntas ACTIVAS cuya ÚNICA verificación es un pase cosmético —
// una pregunta con una verificación real ADEMÁS de la cosmética no se toca (ya está comprobada).
//
// Uso:
//   node scripts/calidad/sanear-verificacion-cosmetica.cjs                # SIMULA (por defecto)
//   node scripts/calidad/sanear-verificacion-cosmetica.cjs --aplicar      # escribe, en transacción
//
// NUNCA toca `explanation`/`review_method_version`/etc.: esos campos son la FIRMA ORIGINAL del
// pase cosmético (qué modelo, qué día, qué dijo) y son la evidencia de qué pasó — borrarlos sería
// perder el porqué. Solo se nulean `article_ok`/`answer_ok`, y solo en las filas clasificadas
// `infractora` por el núcleo puro ya testeado.

const path = require('path')
const REPO = path.resolve(__dirname, '..', '..')
require(path.join(REPO, 'node_modules', 'dotenv')).config({ path: path.join(REPO, '.env.local') })
const pgMod = require(path.join(REPO, 'node_modules', 'postgres'))
const postgres = pgMod.default || pgMod
const { calcularSaneamiento } = require(
  path.join(REPO, 'lib', 'calidad', 'verificacionCosmetica.cjs'),
)

const APLICAR = process.argv.includes('--aplicar')

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } })

  // Mismo SELECT que la auditoría, a propósito: dos consultas distintas para "lo mismo" es como
  // empiezan a divergir estos criterios.
  const filas = await sql`
    SELECT v.id, v.question_id, v.explanation, v.article_ok, v.answer_ok, v.ai_model,
           l.short_name AS ley
    FROM ai_verification_results v
    JOIN questions q ON q.id = v.question_id AND q.is_active
    LEFT JOIN articles a ON a.id = q.primary_article_id
    LEFT JOIN laws l ON l.id = a.law_id`

  const { aLimpiar, preguntasAfectadas } = calcularSaneamiento(filas)

  console.log(`\n🔎 preguntas activas verificadas SOLO por pase cosmético: ${preguntasAfectadas.size}`)
  console.log(`   filas de ai_verification_results a limpiar: ${aLimpiar.length}`)
  const porLey = {}
  for (const { fila } of aLimpiar) porLey[fila.ley || '(sin ley)'] = (porLey[fila.ley || '(sin ley)'] || 0) + 1
  console.log('\n── por ley (top 10) ──')
  Object.entries(porLey).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([ley, n]) => console.log(`   ${String(n).padStart(5)}  ${ley}`))

  if (!APLICAR) {
    console.log('\n(simulación: no se ha escrito nada. Repite con --aplicar)')
    await sql.end()
    return
  }

  await sql.begin(async (tx) => {
    let limpiadas = 0
    for (const { fila, flags } of aLimpiar) {
      await tx`
        INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
        VALUES (gen_random_uuid(), NOW(), 'db:ai_verification_results', 'warn',
                'verificacion_cosmetica_firmaba_fondo',
                ${tx.json({
                  questionId: fila.question_id,
                  aiModel: fila.ai_model,
                  articleOk: fila.article_ok,
                  answerOk: fila.answer_ok,
                  proposito: String(fila.explanation || '').slice(0, 120),
                  saneamiento: true,
                  saneadoEn: 'T-465',
                })},
                NOW())`
      const upd = {}
      if (flags.includes('article_ok')) upd.article_ok = null
      if (flags.includes('answer_ok')) upd.answer_ok = null
      await tx`UPDATE ai_verification_results SET ${tx(upd)} WHERE id = ${fila.id}`
      limpiadas++
    }
    console.log(`\n✅ ${limpiadas} fila(s) saneadas (article_ok/answer_ok → NULL) + su traza en observable_events.`)
  })

  await sql.end()
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
