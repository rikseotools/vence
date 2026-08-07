#!/usr/bin/env node
// scripts/migraciones-rls-pendientes.cjs — [T-645]
//
// Un `.sql` de `supabase/migrations/` mergeado a `main` NO llega solo a RDS: aplicarlo es un
// paso MANUAL y nada en `scripts/deploy-*.sh` ni en `.github/workflows/*.yml` lo hace
// (comprobado por grep, no supuesto). Medido el 07/08: `20260805_rls_test_questions_lector.sql`
// (T-573) y `20260805_rls_ai_verification_results_lector.sql` (T-038) llevaban 2+ días en
// `main` con `pg_policies` en CERO filas para sus tablas — la política que prometían nunca se
// creó en producción.
//
// Este canario detecta, de la familia de migraciones RLS `flota_*_lee`/`flota_*_reclama` (el
// patrón "establecido" documentado en CLAUDE.md), cuáles siguen sin cumplirse: parsea cada
// `.sql` (núcleo puro en `lib/db/migracionesRlsPendientes.cjs`, con tests contra los ficheros
// reales) y contrasta lo que declara contra el CATÁLOGO vivo (`pg_class`+`pg_policies`, legible
// sin GRANT explícito por cualquier rol — mismo mecanismo que `canary-rol-lector.cjs`).
//
// NO es un ledger genérico de "toda migración aplicada": se acota a políticas RLS porque es la
// familia que ha causado los casos confirmados y la única verificable sin escribir nada, con
// la credencial de solo lectura de la flota.
//
// Uso:  VENCE_LECTOR_URL=postgres://vence_lector:…@… npm run migraciones:rls-pendientes

const fs = require('fs')
const path = require('path')
const { extraerDeclaraciones, migracionesRlsPendientes } = require('../lib/db/migracionesRlsPendientes.cjs')

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations')

async function main() {
  const u = process.env.VENCE_LECTOR_URL
  if (!u) {
    console.log('\n⏭️  falta VENCE_LECTOR_URL: no se puede consultar el catálogo vivo.')
    return 0
  }

  const ficheros = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
  const migraciones = ficheros
    .map((archivo) => ({
      archivo,
      declaraciones: extraerDeclaraciones(fs.readFileSync(path.join(MIGRATIONS_DIR, archivo), 'utf8')),
    }))
    .filter((m) => m.declaraciones.length > 0)

  console.log('\nCANARIO — migraciones RLS mergeadas a main, ¿aplicadas contra RDS? (T-645)')
  console.log('='.repeat(78))
  console.log(`${migraciones.length} migración(es) de política RLS encontradas en supabase/migrations/`)

  const tablas = [...new Set(migraciones.flatMap((m) => m.declaraciones.map((d) => d.table)))]
  if (!tablas.length) {
    console.log('\n✅ nada que comprobar (ninguna migración con CREATE POLICY detectada).')
    return 0
  }

  const sql = require('postgres')(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })
  let pendientes = []
  try {
    const catRows = await sql`
      SELECT c.relname AS tabla, c.relrowsecurity AS rowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY(${tablas})`
    const polRows = await sql`
      SELECT tablename AS tabla, cmd, roles
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = ANY(${tablas})`

    const catalogoPorTabla = {}
    for (const r of catRows) catalogoPorTabla[r.tabla] = { rowsecurity: r.rowsecurity, policies: [] }
    for (const r of polRows) {
      if (!catalogoPorTabla[r.tabla]) continue
      catalogoPorTabla[r.tabla].policies.push({ cmd: r.cmd, roles: r.roles })
    }

    pendientes = migracionesRlsPendientes(migraciones, catalogoPorTabla)

    if (!pendientes.length) {
      console.log(`\n✅ ${migraciones.length}/${migraciones.length} aplicadas — pg_policies coincide con lo que cada migración declara.`)
    } else {
      console.log(`\n❌ ${pendientes.length} migración(es) mergeada(s) a main y SIN aplicar contra RDS:\n`)
      for (const p of pendientes) {
        console.log(`   ${p.archivo}`)
        for (const f of p.faltan) console.log(`      · ${f.table} / ${f.role}: ${f.motivo}`)
      }
      console.log('\n   Aplicar es DDL de producción — decisión y ejecución de una persona con la')
      console.log('   credencial adecuada (no de un trabajador de la flota). Ver docs/roadmap/')
      console.log('   tareas-pendientes.md [T-645] para el detalle de cada caso.')
    }
  } finally {
    try { await sql.end({ timeout: 5 }) } catch {}
  }

  return pendientes.length ? 1 : 0
}

main().then((c) => process.exit(c)).catch((e) => { console.error('❌', e); process.exit(1) })
