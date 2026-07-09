#!/usr/bin/env node
// scripts/canary-familia.cjs
//
// CANARY post-deploy de la familia (contra RDS). Falla (exit 1) si:
//  1. la vista oposiciones_ssot no expone familia (readers rotos),
//  2. hay familia fuera de la taxonomía (CHECK saltado / dato corrupto),
//  3. la cobertura de catalogadas ABIERTAS mostrables cae por debajo del umbral
//     (el banner personalizado se quedaría sin material y caería al teaser general),
//  4. el clasificador YA NO reproduce lo persistido (keywords cambiadas sin reconcile).
//
// Uso:  node scripts/canary-familia.cjs   (DATABASE_URL en .env.local)

const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })
const loadFamiliaModule = require('./_load-familia.cjs')

const COVERAGE_MIN = 0.8
const CONSISTENCY_SAMPLE = 300

async function main() {
  const { classifyFamilia, FAMILIA_KEYS } = loadFamiliaModule()
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const fails = []
  try {
    // 1) vista expone familia
    const v = await c.query('SELECT familia FROM oposiciones_ssot LIMIT 1')
    if (!v.fields.some((f) => f.name === 'familia')) fails.push('oposiciones_ssot NO expone familia')

    // 2) taxonomía válida
    const bad = await c.query('SELECT DISTINCT familia FROM oposiciones WHERE familia IS NOT NULL')
    for (const r of bad.rows) if (!FAMILIA_KEYS.includes(r.familia)) fails.push(`familia inválida: ${r.familia}`)

    // 3) cobertura de abiertas mostrables
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
    const cov = await c.query(
      `SELECT familia FROM oposiciones WHERE is_active=false AND seguimiento_url IS NOT NULL
         AND inscription_start::text <= $1 AND inscription_deadline::text >= $1`,
      [today],
    )
    if (cov.rows.length) {
      const ok = cov.rows.filter((o) => o.familia && o.familia !== 'otros').length / cov.rows.length
      if (ok < COVERAGE_MIN) fails.push(`cobertura abiertas ${(ok * 100).toFixed(0)}% < ${COVERAGE_MIN * 100}%`)
    }

    // 4) consistencia clasificador ↔ BD
    const s = await c.query(
      `SELECT nombre, administracion, familia FROM oposiciones WHERE familia IS NOT NULL ORDER BY id LIMIT $1`,
      [CONSISTENCY_SAMPLE],
    )
    const mism = s.rows.filter((o) => classifyFamilia(o.nombre, o.administracion) !== o.familia)
    if (mism.length) fails.push(`${mism.length}/${s.rows.length} desincronizados (¿keywords sin reconcile?)`)
  } finally {
    await c.end()
  }

  if (fails.length) {
    console.error('❌ CANARY familia FALLA:')
    fails.forEach((f) => console.error('  -', f))
    process.exit(1)
  }
  console.log('✅ CANARY familia OK (vista, taxonomía, cobertura, consistencia)')
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
