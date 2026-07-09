#!/usr/bin/env node
// scripts/backfill-familia.cjs
//
// Backfill (y re-clasificación) de oposiciones.familia usando el ÚNICO clasificador
// (lib/oposiciones/familia.ts) — no duplica lógica: transpila el TS al vuelo con babel.
// Idempotente: recomputa y sobrescribe. Imprime INFORME (distribución + residuo 'otros').
//
// Uso:  node scripts/backfill-familia.cjs            → re-clasifica TODO (idempotente)
//       node scripts/backfill-familia.cjs --only-null → solo filas SIN familia (RECONCILE
//         del ingest: clasifica lo nuevo del feed SIN pisar correcciones manuales).
//         Llamar tras cada pasada del feed pag-empleo (cron) = "nace con familia".
// Requiere DATABASE_URL en .env.local (RDS).

const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })
const loadFamiliaModule = require('./_load-familia.cjs')

async function main() {
  const { classifyFamilia, FAMILIA_KEYS } = loadFamiliaModule()
  if (typeof classifyFamilia !== 'function') throw new Error('classifyFamilia no cargó')

  const onlyNull = process.argv.includes('--only-null')
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  try {
    const { rows } = await c.query(
      `SELECT id, nombre, administracion FROM oposiciones${onlyNull ? ' WHERE familia IS NULL' : ''}`,
    )
    if (onlyNull) console.log(`[reconcile] ${rows.length} fila(s) sin familia`)
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
    const total = rep.rows.reduce((s, r) => s + r.n, 0) // total real de la tabla (no el nº actualizado)
    console.log(`\n=== FAMILIA · ${rows.length} clasificada(s), ${total} en tabla ===`)
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
