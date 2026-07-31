#!/usr/bin/env node
// scripts/backfill-familia.cjs
//
// Backfill (y re-clasificación) de oposiciones.familia usando el ÚNICO clasificador
// (lib/oposiciones/familia.ts) — no duplica lógica: transpila el TS al vuelo con babel.
// Idempotente: recomputa y sobrescribe. Imprime INFORME (distribución + residuo 'otros').
//
// Uso:  node scripts/backfill-familia.cjs --dry-run  → NO escribe: enseña el diff exacto
//       node scripts/backfill-familia.cjs            → re-clasifica TODO (idempotente)
//       node scripts/backfill-familia.cjs --only-null → solo filas SIN familia (RECONCILE
//         del ingest: clasifica lo nuevo del feed SIN pisar correcciones manuales).
//         Llamar tras cada pasada del feed pag-empleo (cron) = "nace con familia".
// Requiere DATABASE_URL en .env.local (RDS).
//
// ⚠️ La pasada COMPLETA sobrescribe TODAS las filas, así que **pisa las correcciones
// manuales**: lo que el clasificador no sepa clasificar vuelve a 'otros'. Por eso existe
// el --dry-run (añadido 31/07, T-377): antes solo se podía elegir entre no correrlo o
// correrlo a ciegas sobre 2.500 filas. Mirar el diff ANTES, siempre.

const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')
const { degradaFamilia } = require('../lib/oposiciones/familiaBackfill.cjs')
require('dotenv').config({ path: '.env.local' })
const loadFamiliaModule = require('./_load-familia.cjs')

async function main() {
  const { classifyFamilia, FAMILIA_KEYS } = loadFamiliaModule()
  if (typeof classifyFamilia !== 'function') throw new Error('classifyFamilia no cargó')

  const onlyNull = process.argv.includes('--only-null')
  const dryRun = process.argv.includes('--dry-run')
  const c = new Client(pgConfig())
  await c.connect()
  try {
    const { rows } = await c.query(
      `SELECT id, nombre, administracion, familia FROM oposiciones${onlyNull ? ' WHERE familia IS NULL' : ''}`,
    )
    if (onlyNull) console.log(`[reconcile] ${rows.length} fila(s) sin familia`)
    // NO DEGRADAR (regla en lib/oposiciones/familiaBackfill.cjs, con tests): 'otros' es el
    // comodín del clasificador, no un veredicto, así que no puede pisar una familia concreta.
    // Medido el 31/07 (T-377): sin esto la pasada completa degradaba 6 filas.
    const degrada = (r, nueva) => degradaFamilia(r.familia, nueva)

    // agrupar ids por familia → 1 UPDATE por familia (eficiente)
    const byFam = new Map(FAMILIA_KEYS.map((k) => [k, []]))
    for (const r of rows) {
      const nueva = classifyFamilia(r.nombre, r.administracion)
      if (degrada(r, nueva)) continue
      byFam.get(nueva).push(r.id)
    }

    if (dryRun) {
      // Diff exacto: solo las filas que CAMBIARÍAN, agrupadas por transición.
      const cambios = new Map()
      let protegidas = 0
      for (const r of rows) {
        const nueva = classifyFamilia(r.nombre, r.administracion)
        const vieja = r.familia ?? '(null)'
        if (nueva === r.familia) continue
        if (degrada(r, nueva)) { protegidas++; continue }  // no se tocaría: ver `degrada`
        const k = `${vieja} → ${nueva}`
        if (!cambios.has(k)) cambios.set(k, [])
        cambios.get(k).push(r.nombre)
      }
      const total = [...cambios.values()].reduce((s2, v) => s2 + v.length, 0)
      console.log(`\n=== DRY-RUN · ${rows.length} miradas · ${total} cambiarían (0 escrituras) ===`)
      const orden = [...cambios.entries()].sort((a, b) => b[1].length - a[1].length)
      for (const [k, nombres] of orden) {
        const pierde = k.endsWith('→ otros') ? '  ⚠️ PIERDE detalle' : ''
        console.log(`\n${String(nombres.length).padStart(5)}  ${k}${pierde}`)
        for (const n of nombres.slice(0, 4)) console.log('         ·', n.slice(0, 78))
        if (nombres.length > 4) console.log(`         … y ${nombres.length - 4} más`)
      }
      if (protegidas) console.log(`\n  🛡️  ${protegidas} fila(s) PROTEGIDA(S): el clasificador las mandaría a 'otros' y ya tienen familia concreta (no se degradan)`)
      if (!total) console.log('  (nada que cambiar: BD y clasificador están sincronizados)')
      return
    }

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
