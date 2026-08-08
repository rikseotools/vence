#!/usr/bin/env node
/**
 * scripts/audit-verificacion-cosmetica.cjs — preguntas que figuran VERIFICADAS apoyándose solo en un
 * pase COSMÉTICO [T-465].
 *
 * Uso:
 *   npm run audit:verificacion-cosmetica            # informe
 *   npm run audit:verificacion-cosmetica -- --json  # para tratar
 *
 * SOLO LEE. Limpiar esas firmas (poner `article_ok`/`answer_ok` a NULL) es una decisión aparte:
 * hacerlo devuelve 1.240 preguntas a la cola de revisión de golpe.
 *
 * Por qué importa: ver la cabecera de `lib/calidad/verificacionCosmetica.cjs`. En corto — un pase
 * cuyo trabajo era reescribir explicaciones firmó `article_ok=true` con confianza alta, y con eso
 * siete preguntas inestudiables quedaron marcadas como comprobadas hasta que un usuario las impugnó
 * una a una.
 *
 * Runbook: `docs/maintenance/revisar-preguntas-con-agente.md` §3.4.
 */
const path = require('path')
const REPO = path.resolve(__dirname, '..')
require(path.join(REPO, 'node_modules', 'dotenv')).config({ path: path.join(REPO, '.env.local') })
const pgMod = require(path.join(REPO, 'node_modules', 'postgres'))
const postgres = pgMod.default || pgMod
const { clasificarFirma, soloVerificadaPorPasesCosmeticos } = require(
  path.join(REPO, 'lib', 'calidad', 'verificacionCosmetica.cjs'),
)
// [T-624] SOLO LEE (ver cabecera) — un trabajador de la flota con únicamente `VENCE_LECTOR_URL`
// tiene que poder correrlo. Leía `DATABASE_URL` a pelo (medido 08/08: "permission denied for
// table ai_verification_results" con el rol de coordinación), el mismo gotcha que
// `verificar-articulos-vs-boe.cjs`/`huerfanos-plan.cjs` ya habían corregido.
const { urlLecturaNegocio } = require(path.join(REPO, 'lib', 'db', 'negocioSoloLectura.cjs'))

const JSON_OUT = process.argv.includes('--json')

async function main() {
  const sql = postgres(urlLecturaNegocio(), { max: 1, prepare: false, ssl: { rejectUnauthorized: false } })

  // Solo preguntas ACTIVAS: una retirada ya no engaña a nadie.
  const filas = await sql`
    SELECT v.question_id, v.explanation, v.article_ok, v.answer_ok, v.explanation_ok,
           v.ai_model, v.verified_at, l.short_name AS ley, a.article_number
    FROM ai_verification_results v
    JOIN questions q ON q.id = v.question_id AND q.is_active
    LEFT JOIN articles a ON a.id = q.primary_article_id
    LEFT JOIN laws l ON l.id = a.law_id`

  const porPregunta = new Map()
  for (const f of filas) {
    if (!porPregunta.has(f.question_id)) porPregunta.set(f.question_id, [])
    porPregunta.get(f.question_id).push(f)
  }

  const infractoras = filas.filter((f) => clasificarFirma(f).infractora)
  const soloCosmeticas = []
  for (const [qid, lista] of porPregunta) {
    if (soloVerificadaPorPasesCosmeticos(lista)) soloCosmeticas.push({ qid, lista })
  }

  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        {
          filasInfractoras: infractoras.length,
          preguntasSoloCosmeticas: soloCosmeticas.map((x) => x.qid),
        },
        null,
        2,
      ),
    )
    await sql.end()
    return
  }

  console.log(`\n🔎 verificaciones de preguntas activas: ${filas.length}`)
  console.log(`   🔴 firmas COSMÉTICAS que afirman fondo (article_ok/answer_ok=true): ${infractoras.length}`)
  console.log(`   🔴 preguntas cuya ÚNICA verificación es cosmética: ${soloCosmeticas.length}`)

  const porLey = {}
  soloCosmeticas.forEach(({ lista }) => {
    const k = lista[0].ley || '(sin ley)'
    porLey[k] = (porLey[k] || 0) + 1
  })
  console.log('\n── por ley (top 10) ──')
  Object.entries(porLey)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${k}`))

  console.log(
    '\nQué hacer: NO son necesariamente preguntas malas — es que nadie ha mirado su contenido.\n' +
      'Pasarlas por una verificación de VERDAD (o por `npm run audit:instrumento-derivado` y sus\n' +
      'hermanos deterministas) antes de darlas por buenas.\n',
  )
  await sql.end()
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
