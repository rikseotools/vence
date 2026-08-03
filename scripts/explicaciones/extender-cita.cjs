#!/usr/bin/env node
/**
 * Extiende una cita que se cortó en los DOS PUNTOS para que incluya la enumeración que la sigue,
 * que suele ser lo que realmente sostiene la clave. Escribe el JSON de explicación con la cita nueva
 * en `exp/` para volver a aplicarlo por el camino de siempre (`aplicar-explicacion.ts`), en vez de
 * tocar `explanation_data` a mano: así el texto y la estructura se regeneran coherentes.
 *
 *   node --env-file=.env.local scripts/explicaciones/extiende-citas.cjs <id8> [<id8>...]
 */
const fs = require('fs')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { Client } = require('pg')

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()

async function main() {
  const prefijos = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const c = new Client(pgConfig())
  await c.connect()
  const { rows } = await c.query(
    `SELECT q.id, q.explanation_data, a.content art FROM questions q
       LEFT JOIN articles a ON a.id = q.primary_article_id
      WHERE ${prefijos.map((_, i) => `q.id::text LIKE $${i + 1}`).join(' OR ')}`,
    prefijos.map((p) => p + '%'),
  )
  await c.end()

  for (const row of rows) {
    const d = row.explanation_data
    const cita = norm(d?.cita?.texto)
    const art = norm(row.art)
    const pos = art.indexOf(cita)
    if (pos < 0) { console.log(`⚠️  ${row.id.slice(0, 8)}: la cita no se localiza en el artículo`); continue }
    // Toma desde el inicio de la cita hasta el final de la enumeración: se corta en el primer
    // apartado NUMERADO siguiente («2. »), que es donde acaba el bloque.
    const resto = art.slice(pos + cita.length)
    const fin = resto.search(/\s\d+\.\s+[A-ZÁÉÍÓÚ]/)
    const enumeracion = (fin >= 0 ? resto.slice(0, fin) : resto).trim()
    if (!/\b[a-z]\)/.test(enumeracion)) { console.log(`·  ${row.id.slice(0, 8)}: no hay enumeración detrás, se deja`); continue }
    d.cita.texto = `${cita} ${enumeracion}`.trim()
    fs.writeFileSync(`scripts/explicaciones/exp/${row.id}.json`, JSON.stringify(d, null, 2))
    console.log(`✓  ${row.id.slice(0, 8)}: +${enumeracion.length} caracteres → "…${enumeracion.slice(0, 70)}…"`)
  }
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
