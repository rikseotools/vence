#!/usr/bin/env node
/**
 * Paso 5 del manual (`revisar-preguntas-con-agente.md`): la cita en blockquote tiene que ser copia
 * LITERAL del artículo vinculado. Usa el criterio ÚNICO (`citaNoLiteral` de
 * `scripts/impugnaciones/validar-explicacion.cjs`), no una copia propia.
 *
 * Dos modos:
 *   node scripts/explicaciones/gate-citas.cjs --pre  <lote.json> <dirExp>   (antes de aplicar: JSON escritos)
 *   node scripts/explicaciones/gate-citas.cjs --post <lote.json>            (después: lee la fila viva)
 *
 * Sale con código 1 si alguna cita no es literal.
 */
const fs = require('fs')
const path = require('path')
const { citaNoLiteral } = require('../impugnaciones/validar-explicacion.cjs')
const { diagnosticaRecorte } = require('../../lib/health/citaRecortada.cjs')

async function main() {
  const modo = process.argv[2]
  const lotePath = process.argv[3]
  const lote = JSON.parse(fs.readFileSync(lotePath, 'utf8'))
  const porId = new Map(lote.map((q) => [q.id, q]))
  const fallos = []
  let revisadas = 0

  const cortadas = []
  const comprueba = (id, cita, articulo) => {
    if (!cita || !cita.texto) return
    revisadas++
    const r = citaNoLiteral(cita.texto, articulo || '')
    if (r) fallos.push([id, r.fallo.slice(0, 120)])
    // Una cita puede ser LITERAL y estar mal: los CUATRO modos de recorte viven en el núcleo puro
    // `lib/health/citaRecortada.cjs`, testeado con casos reales. Aquí solo se recogen sus avisos.
    // Ninguno bloquea —hay recortes legítimos— pero se cantan todos.
    for (const a of diagnosticaRecorte(cita.texto, articulo || '')) cortadas.push([id, `[${a.modo}] ${a.detalle}`])
  }

  if (modo === '--pre') {
    const dir = process.argv[4]
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const id = path.basename(f, '.json')
      const q = porId.get(id)
      if (!q) { fallos.push([id, 'NO está en este lote']); continue }
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      comprueba(id, data.cita, q.article_content)
    }
  } else {
    const { pgConfig } = require('../../lib/db/pgSsl.cjs')
    const { Client } = require('pg')
    const c = new Client(pgConfig())
    await c.connect()
    const r = await c.query(
      `SELECT q.id, q.explanation_data, a.content art
         FROM questions q LEFT JOIN articles a ON a.id = q.primary_article_id
        WHERE q.id = ANY($1::uuid[])`,
      [lote.map((q) => q.id)],
    )
    for (const row of r.rows) comprueba(row.id, row.explanation_data?.cita, row.art)
    await c.end()
  }

  console.log(`gate citas (${modo}): ${revisadas} citas comprobadas · ${fallos.length} no literales · ${cortadas.length} cortadas a mitad de frase`)
  for (const [id, tramo] of fallos) console.log(`  ❌ ${id}: no aparece literal → "${tramo}…"`)
  for (const [id, fin] of cortadas) console.log(`  ⚠️  ${id}: la cita no cierra la frase → "…${fin}"`)
  if (fallos.length) process.exit(1)
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
