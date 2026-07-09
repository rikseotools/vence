#!/usr/bin/env node
// scripts/backfill-familia.cjs
//
// Backfill (y re-clasificación) de oposiciones.familia usando el ÚNICO clasificador
// (lib/oposiciones/familia.ts) — no duplica lógica: transpila el TS al vuelo con babel.
// Idempotente: recomputa y sobrescribe. Imprime INFORME (distribución + residuo 'otros').
//
// Uso:  node scripts/backfill-familia.cjs
// Requiere DATABASE_URL en .env.local (RDS).

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

// --- cargar el clasificador TS sin ts-node: babel transform → CJS en memoria ---
function loadFamiliaModule() {
  const file = path.resolve(__dirname, '../lib/oposiciones/familia.ts')
  const src = fs.readFileSync(file, 'utf8')
  const { code } = require('@babel/core').transformSync(src, {
    filename: file,
    presets: [
      ['@babel/preset-env', { targets: { node: 'current' } }],
      '@babel/preset-typescript',
    ],
    babelrc: false,
    configFile: false,
  })
  const mod = { exports: {} }
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require)
  return mod.exports
}

async function main() {
  const { classifyFamilia, FAMILIA_KEYS } = loadFamiliaModule()
  if (typeof classifyFamilia !== 'function') throw new Error('classifyFamilia no cargó')

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  try {
    const { rows } = await c.query('SELECT id, nombre, administracion FROM oposiciones')
    // agrupar ids por familia → 1 UPDATE por familia (eficiente)
    const byFam = new Map(FAMILIA_KEYS.map((k) => [k, []]))
    for (const r of rows) byFam.get(classifyFamilia(r.nombre, r.administracion)).push(r.id)

    await c.query('BEGIN')
    for (const [fam, ids] of byFam) {
      if (ids.length) await c.query('UPDATE oposiciones SET familia = $1 WHERE id = ANY($2::uuid[])', [fam, ids])
    }
    await c.query('COMMIT')

    // informe desde la BD (fuente de verdad tras el UPDATE)
    const rep = await c.query(
      "SELECT COALESCE(familia,'(null)') familia, COUNT(*)::int n FROM oposiciones GROUP BY 1 ORDER BY n DESC",
    )
    const total = rows.length
    console.log(`\n=== BACKFILL FAMILIA · ${total} filas ===`)
    rep.rows.forEach((r) =>
      console.log(String(r.n).padStart(5), `${((r.n / total) * 100).toFixed(1)}%`.padStart(7), r.familia),
    )
  } finally {
    await c.end()
  }
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
