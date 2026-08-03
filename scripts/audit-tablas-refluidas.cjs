#!/usr/bin/env node
// scripts/audit-tablas-refluidas.cjs — tablas de boletín que se sirven como párrafo corrido.
//
// SOLO LEE. BAJO DEMANDA y sin badge: ver `lib/teoria/detectReflowedTable.cjs` y [T-505].
// Complementa a `detectFlattenedTable`, que solo ve la tabla si conserva las líneas cortas.
//
// Uso:  npm run audit:tablas-refluidas [-- --json]
'use strict'
require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const { detectReflowedTable } = require('../lib/teoria/detectReflowedTable.cjs')

const JSON_OUT = process.argv.includes('--json')

;(async () => {
  const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 })
  const arts = await sql`
    SELECT a.id, a.article_number, a.content, l.short_name AS ley, l.slug,
      (SELECT count(*)::int FROM questions q WHERE q.primary_article_id = a.id AND q.is_active) AS preguntas
    FROM articles a JOIN laws l ON l.id = a.law_id
    WHERE a.is_active AND a.content IS NOT NULL AND length(a.content) > 200`
  await sql.end()

  const hits = []
  for (const a of arts) {
    const r = detectReflowedTable(a.content)
    if (r.detected) hits.push({ id: a.id, ley: a.ley, slug: a.slug, articulo: a.article_number, preguntas: a.preguntas, motivo: r.motivo, cabeceras: r.cabeceras, muestra: r.parrafo })
  }
  hits.sort((x, y) => y.preguntas - x.preguntas)

  if (JSON_OUT) {
    console.log(JSON.stringify({ examinados: arts.length, hallazgos: hits.length, hits }, null, 1))
    process.exit(hits.length ? 2 : 0)
  }
  console.log(`\n━━━ Tablas de boletín servidas como párrafo ━━━`)
  console.log(`  artículos activos examinados: ${arts.length}`)
  console.log(`  marcados: ${hits.length}\n`)
  for (const h of hits) {
    console.log(`  📄 ${h.ley} · art. ${h.articulo} · ${h.preguntas} preguntas activas`)
    console.log(`     ${h.motivo}`)
    console.log(`     cabeceras: ${h.cabeceras.join(', ')}`)
    console.log(`     «${String(h.muestra).slice(0, 160)}…»\n`)
  }
  console.log('  Reparar reconstruyendo la tabla contra el PDF original, y atribuyendo cada celda a su')
  console.log('  fila POR COORDENADAS (pdftotext -bbox-layout). Adivinar a qué fila pertenece un dato es inventar.')
  process.exit(hits.length ? 2 : 0)
})()
