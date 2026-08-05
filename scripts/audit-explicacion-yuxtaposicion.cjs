#!/usr/bin/env node
/**
 * Explicaciones que reproducen la opción FALSA casi carácter por carácter, con la palabra
 * corregida pegada y SIN decir en ningún momento que la opción es incorrecta (T-525). SOLO LEE.
 *
 *   npm run audit:explicacion-yuxtaposicion                # informe (top por exposición)
 *   npm run audit:explicacion-yuxtaposicion -- --json       # para health-sweep (badge)
 *   npm run audit:explicacion-yuxtaposicion -- --muestra 20 # muestra aleatoria, para re-calibrar
 *
 * El juicio lo pone el núcleo puro `lib/health/explicacionYuxtaposicion.cjs`; aquí solo se traen
 * las filas y se agrupa. CLI-only a propósito (como `cita_no_literal`/`barrido-citas.cjs`): el
 * criterio compara, por CADA opción falsa de CADA pregunta, su segmento de explicación contra el
 * texto de la opción — eso no cabe en un `WHERE` de Postgres, y el backend NestJS (proyecto
 * aparte, sin acceso a `lib/`) tampoco puede correr la comparación fila a fila.
 */
const { pgConfig } = require('../lib/db/pgSsl.cjs')
const { Client } = require('pg')
const { clasificaPregunta } = require('../lib/health/explicacionYuxtaposicion.cjs')

async function main() {
  const json = process.argv.includes('--json')
  const iMuestra = process.argv.indexOf('--muestra')
  const muestra = iMuestra >= 0 ? Number(process.argv[iMuestra + 1] || 20) : 0

  const c = new Client(pgConfig())
  await c.connect()
  const { rows } = await c.query(`
    SELECT q.id, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.correct_option,
           q.explanation, q.is_official_exam, l.short_name AS ley,
           coalesce(e.impresiones, 0)::int AS impresiones
      FROM questions q
      LEFT JOIN articles a ON a.id = q.primary_article_id
      LEFT JOIN laws l ON l.id = a.law_id
      LEFT JOIN (
        SELECT question_id, count(*) AS impresiones FROM test_questions
         WHERE created_at > now() - interval '90 days' GROUP BY 1
      ) e ON e.question_id = q.id
     WHERE q.is_active
       AND (q.explanation LIKE '%- A)%' OR q.explanation LIKE '%- A.%')`)
  await c.end()

  const hits = []
  for (const r of rows) {
    const v = clasificaPregunta(r)
    if (v.yuxtapuesta) {
      hits.push({
        id: r.id, ley: r.ley, oficial: !!r.is_official_exam, impresiones: r.impresiones,
        hallazgos: v.hallazgos.map((h) => ({ letra: h.letra, opcion: h.opcion, segmento: h.segmento, ratio: h.ratio })),
      })
    }
  }
  hits.sort((a, b) => b.impresiones - a.impresiones)
  const oficiales = hits.filter((h) => h.oficial)
  const vistas = hits.filter((h) => h.impresiones > 0)

  if (json) {
    process.stdout.write(JSON.stringify({
      revisadas: rows.length,
      yuxtaposicion: hits.length,
      oficiales: oficiales.length,
      vistas: vistas.length,
      sample: hits.slice(0, 10).map((h) => ({ id: h.id, ley: h.ley, impresiones: h.impresiones, letras: h.hallazgos.map((x) => x.letra) })),
    }))
    return
  }

  console.log(`\n🧩 Explicaciones que reproducen una opción FALSA sin veredicto (T-525)`)
  console.log(`   revisadas: ${rows.length} activas con plantilla de viñetas`)
  console.log(`   con el defecto: ${hits.length}  (${oficiales.length} de examen oficial, ${vistas.length} ya vistas por usuarios)\n`)

  if (muestra) {
    const mez = hits.slice()
    for (let i = mez.length - 1; i > 0; i--) { const j = (i * 7919) % (i + 1); [mez[i], mez[j]] = [mez[j], mez[i]] }
    console.log(`— MUESTRA ALEATORIA DE ${muestra} para juzgar precisión a mano —`)
    mez.slice(0, muestra).forEach((h, n) => {
      const primero = h.hallazgos[0]
      console.log(`${String(n + 1).padStart(2)}. ${h.id.slice(0, 8)} [${primero.letra}] opción: ${primero.opcion.slice(0, 90)}`)
      console.log(`    segmento: ${primero.segmento.slice(0, 110)}`)
    })
    return
  }

  console.log('— las 15 de más exposición —')
  hits.slice(0, 15).forEach((h) => {
    const primero = h.hallazgos[0]
    console.log(`  ${String(h.impresiones).padStart(5)} impr · ${h.id.slice(0, 8)} · ${h.ley || '—'} [${primero.letra}] …${primero.segmento.slice(-70)}`)
  })
  console.log('\n(solo lee; para re-calibrar: --muestra 20; para health-sweep: --json)')
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
