#!/usr/bin/env node
/**
 * scripts/audit-instrumento-derivado.cjs — runner BAJO DEMANDA del detector
 * `pregunta_instrumento_derivado`: preguntas que piden el CONTENIDO de un Plan / Estrategia / Informe
 * colgadas del artículo que solo ordena que ese instrumento exista.
 *
 * Uso:
 *   npm run audit:instrumento-derivado                  # todo el banco
 *   npm run audit:instrumento-derivado -- --ley 12/2007  # acotado a una ley
 *   npm run audit:instrumento-derivado -- --json         # salida para tratar
 *
 * SOLO LEE. No escribe nada: el arreglo (retirar la pregunta o importar el instrumento) lo decide una
 * persona con la fuente delante, igual que en el detector hermano `audit:vinculo-vecino`.
 *
 * Por qué no pinga el badge: ver la cabecera de `lib/health/instrumentoDerivado.cjs`.
 * Runbook: `docs/runbooks/salud-contenido.md`.
 */
const path = require('path')
const REPO = path.resolve(__dirname, '..')
require(path.join(REPO, 'node_modules', 'dotenv')).config({ path: path.join(REPO, '.env.local') })
const pgMod = require(path.join(REPO, 'node_modules', 'postgres'))
const postgres = pgMod.default || pgMod
const { clasificarInstrumentoDerivado } = require(path.join(REPO, 'lib', 'health', 'instrumentoDerivado.cjs'))

const arg = (n) => {
  const i = process.argv.indexOf(n)
  return i > -1 ? process.argv[i + 1] : null
}
const JSON_OUT = process.argv.includes('--json')
const LEY = arg('--ley')

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } })

  // Prefiltro en SQL: solo preguntas ACTIVAS de leyes REALES (con boe_url) cuyo enunciado u opción
  // correcta nombre un instrumento. Sin este corte se traería el banco entero a memoria.
  const filas = await sql`
    SELECT q.id, q.question_text, q.correct_option, q.is_official_exam,
           q.option_a, q.option_b, q.option_c, q.option_d,
           a.id AS art_id, a.article_number, a.content AS art_content,
           l.id AS law_id, l.short_name AS ley
    FROM questions q
    JOIN articles a ON a.id = q.primary_article_id
    JOIN laws l ON l.id = a.law_id
    WHERE q.is_active
      AND l.boe_url IS NOT NULL
      AND (q.question_text ~* '(plan estrat|plan de igualdad|plan nacional|plan director|estrategia (nacional|andaluza|estatal)|informe de evaluaci)')
      ${LEY ? sql`AND l.short_name ILIKE ${'%' + LEY + '%'}` : sql``}`

  // Los artículos de cada ley implicada, una sola vez (el discriminante necesita TODA la ley).
  const lawIds = [...new Set(filas.map((f) => f.law_id))]
  const porLey = new Map()
  for (const id of lawIds) {
    const arts = await sql`SELECT id, article_number, content FROM articles WHERE law_id=${id} AND is_active`
    porLey.set(id, arts)
  }

  const hallazgos = []
  const motivos = {}
  for (const f of filas) {
    const opciones = [f.option_a, f.option_b, f.option_c, f.option_d]
    const r = clasificarInstrumentoDerivado({
      enunciado: f.question_text,
      opcionCorrecta: opciones[f.correct_option] || '',
      articuloVinculado: { id: f.art_id, content: f.art_content },
      articulosDeLaLey: porLey.get(f.law_id) || [],
      esOficial: f.is_official_exam,
    })
    motivos[r.motivo] = (motivos[r.motivo] || 0) + 1
    if (r.hallazgo) {
      hallazgos.push({
        id: f.id,
        ley: f.ley,
        articulo: f.article_number,
        banda: r.banda,
        motivo: r.motivo,
        enunciado: f.question_text.slice(0, 130),
        clave: (opciones[f.correct_option] || '').slice(0, 90),
      })
    }
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ examinadas: filas.length, hallazgos, motivos }, null, 2))
    await sql.end()
    return
  }

  console.log(`\n🔎 preguntas activas que nombran un instrumento derivado: ${filas.length}`)
  console.log(`   hallazgos: ${hallazgos.length}\n`)
  const err = hallazgos.filter((h) => h.banda === 'error')
  const warn = hallazgos.filter((h) => h.banda === 'warn')

  const pinta = (lista, titulo) => {
    if (!lista.length) return
    console.log(`── ${titulo} (${lista.length}) ──`)
    // Agrupado por ley+artículo: el defecto es de LOTE (nueve preguntas del mismo artículo), así que
    // verlas juntas es lo que enseña que hay que revisar el artículo entero, no una pregunta.
    const g = {}
    lista.forEach((h) => {
      const k = `${h.ley} · art ${h.articulo}`
      ;(g[k] = g[k] || []).push(h)
    })
    Object.entries(g)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([k, hs]) => {
        console.log(`\n  ${k}  — ${hs.length} pregunta(s)`)
        hs.forEach((h) => {
          console.log(`    · ${h.id.slice(0, 8)} ${h.enunciado}`)
          console.log(`      clave: ${h.clave}   [${h.motivo}]`)
        })
      })
    console.log('')
  }
  pinta(err, '🔴 el artículo solo ORDENA el instrumento y nadie contiene la respuesta')
  pinta(warn, '🟡 no concluyente — clave corta o el artículo ni nombra el instrumento: LEER')

  console.log('── por qué se descartó el resto ──')
  Object.entries(motivos)
    .sort((a, b) => b[1] - a[1])
    .forEach(([m, n]) => console.log(`   ${String(n).padStart(5)}  ${m}`))
  console.log(
    '\nCada línea es una SOSPECHA. Abre el artículo y decide: importar el instrumento como contenido,\n' +
      'o retirar la pregunta. NUNCA cambiar la clave para que encaje con el artículo.\n',
  )
  await sql.end()
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
