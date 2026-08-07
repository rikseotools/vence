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
// APLICAR (T-658): detectar y aplicar viven en la MISMA herramienta a propósito. Tenerlas
// separadas es lo que produjo el hueco: el canario decía «pendiente» y el paso siguiente era una
// consola a mano que nadie daba. Con `--aplicar <fichero.sql>` el fichero tiene que (a) estar en
// la lista de PENDIENTES que se acaba de calcular, y (b) pasar la lista blanca de sentencias
// (`esAplicableSinRiesgo`) — un fichero ancho como `20260502_security_advisor_fixes.sql` se
// rechaza aunque el canario lo liste. Se aplica en UNA transacción y, al terminar, se RECALCULA
// el pendiente contra el catálogo: el veredicto sale de mirar la BD otra vez, no de que el
// comando no lanzara error.
//
// Uso:  VENCE_LECTOR_URL=… npm run migraciones:rls-pendientes                 (solo mira)
//       VENCE_LECTOR_URL=… DATABASE_URL=… npm run migraciones:rls-pendientes -- --aplicar <f.sql> […]

const fs = require('fs')
const path = require('path')
const { extraerDeclaraciones, migracionesRlsPendientes, esAplicableSinRiesgo, partirPorAccionabilidad } = require('../lib/db/migracionesRlsPendientes.cjs')

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations')

async function main() {
  // La consulta es SOLO de catálogo (`pg_class`/`pg_policies`), legible por cualquier rol, así
  // que sirve tanto la credencial del lector como la general. Aceptar las dos es lo que permite
  // que esto corra en CI (donde el secret que hay es el de BD) sin provisionar nada nuevo — antes
  // se saltaba en silencio por falta de `VENCE_LECTOR_URL` y por eso nunca corría en ningún sitio.
  const u = process.env.VENCE_LECTOR_URL || process.env.DATABASE_URL
  if (!u) {
    console.log('\n⏭️  falta VENCE_LECTOR_URL (o DATABASE_URL): no se puede consultar el catálogo vivo.')
    return 0
  }
  console.log(`\n(catálogo leído con ${process.env.VENCE_LECTOR_URL ? 'VENCE_LECTOR_URL' : 'DATABASE_URL'})`)

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

    const { accionables, legacy } = partirPorAccionabilidad(pendientes)
    if (legacy.length) {
      console.log(`\n🗂  ${legacy.length} de la era Supabase (rol \`authenticated\`, que ya no inicia sesión):`)
      console.log('    se imprimen para que no desaparezcan, pero NO fijan el veredicto — decidirlas')
      console.log('    es trabajo aparte y un gate rojo a diario se deja de mirar. Ver [T-659].')
      for (const p of legacy) {
        console.log(`      ${p.archivo}`)
        for (const f of p.faltan) console.log(`         · ${f.table} / ${f.role}: ${f.motivo}`)
      }
    }

    if (!accionables.length) {
      console.log(`\n✅ ${migraciones.length - legacy.length}/${migraciones.length - legacy.length} aplicadas — pg_policies coincide con lo que cada migración declara.`)
    } else {
      console.log(`\n❌ ${accionables.length} migración(es) mergeada(s) a main y SIN aplicar contra RDS:\n`)
      for (const p of accionables) {
        console.log(`   ${p.archivo}`)
        for (const f of p.faltan) console.log(`      · ${f.table} / ${f.role}: ${f.motivo}`)
      }
      console.log('\n   Aplicar es DDL de producción — decisión y ejecución de una persona con la')
      console.log('   credencial adecuada (no de un trabajador de la flota). Ver docs/roadmap/')
      console.log('   tareas-pendientes.md [T-645] para el detalle de cada caso.')
      console.log('   Para aplicar una: … --aplicar <fichero.sql>  (necesita DATABASE_URL)')
    }

    const pedidas = argv('--aplicar')
    if (pedidas.length) {
      const aplicadas = await aplicar(pedidas, pendientes)
      if (aplicadas) {
        // El veredicto se recalcula MIRANDO LA BD otra vez, no dando por bueno que el UPDATE no
        // lanzó: es la misma regla que el resto de la casa (verificar, no declarar).
        const rehecho = await recalcular(sql, migraciones, tablas)
        console.log(`\n▸ RECOMPROBADO contra el catálogo: ${rehecho.length} pendiente(s) (antes ${pendientes.length}).`)
        pendientes = rehecho
      }
    }
  } finally {
    try { await sql.end({ timeout: 5 }) } catch {}
  }

  // El código de salida (el que fija el gate de CI) lo deciden SOLO las accionables.
  return partirPorAccionabilidad(pendientes).accionables.length ? 1 : 0
}

/** Valores de un flag repetible (`--aplicar a.sql --aplicar b.sql` o `--aplicar a.sql b.sql`). */
function argv(flag) {
  const out = []
  const a = process.argv.slice(2)
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== flag) continue
    for (let j = i + 1; j < a.length && !a[j].startsWith('--'); j++) out.push(a[j])
  }
  return out
}

async function recalcular(sql, migraciones, tablas) {
  const catRows = await sql`
    SELECT c.relname AS tabla, c.relrowsecurity AS rowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY(${tablas})`
  const polRows = await sql`
    SELECT tablename AS tabla, cmd, roles FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(${tablas})`
  const cat = {}
  for (const r of catRows) cat[r.tabla] = { rowsecurity: r.rowsecurity, policies: [] }
  for (const r of polRows) if (cat[r.tabla]) cat[r.tabla].policies.push({ cmd: r.cmd, roles: r.roles })
  return migracionesRlsPendientes(migraciones, cat)
}

/** Aplica los ficheros pedidos. Devuelve cuántos se aplicaron de verdad. */
async function aplicar(pedidas, pendientes) {
  const admin = process.env.DATABASE_URL
  if (!admin) { console.error('\n❌ --aplicar necesita DATABASE_URL (la credencial de lectura NO puede hacer DDL).'); return 0 }

  const pendientesPorNombre = new Set(pendientes.map((p) => p.archivo))
  const plan = []
  for (const f of pedidas) {
    const nombre = path.basename(f)
    const ruta = path.join(MIGRATIONS_DIR, nombre)
    if (!fs.existsSync(ruta)) { console.error(`   ⛔ ${nombre}: no existe en supabase/migrations/`); continue }
    // Puerta 1 — no se aplica lo que el catálogo dice que YA está: repetir DDL en producción sin
    // necesidad es riesgo gratis, y además delata que quien lo pide mira una lista vieja.
    if (!pendientesPorNombre.has(nombre)) { console.error(`   ⛔ ${nombre}: no está entre las pendientes (¿ya aplicada?)`); continue }
    // Puerta 2 — lista blanca de sentencias (núcleo puro, testeado).
    const sqlTexto = fs.readFileSync(ruta, 'utf8')
    const veredicto = esAplicableSinRiesgo(sqlTexto)
    if (!veredicto.ok) { console.error(`   ⛔ ${nombre}: ${veredicto.motivo} → aplicar a mano, no desde aquí`); continue }
    plan.push({ nombre, sqlTexto })
  }
  if (!plan.length) { console.log('\n   nada que aplicar.'); return 0 }

  console.log(`\n▸ APLICANDO ${plan.length} migración(es) contra RDS (cada una en su transacción):`)
  const { Client } = require('pg')
  const { pgConfig } = require('../lib/db/pgSsl.cjs')
  const c = new Client(pgConfig(admin))
  await c.connect()
  let hechas = 0
  try {
    for (const m of plan) {
      try {
        await c.query('BEGIN')
        await c.query(m.sqlTexto)
        await c.query('COMMIT')
        console.log(`   ✅ ${m.nombre}`)
        hechas++
      } catch (e) {
        await c.query('ROLLBACK').catch(() => {})
        // Una migración que falla NO detiene a las demás: son independientes entre sí, y parar
        // dejaría el resto sin aplicar por un motivo ajeno. El fallo se canta y se sigue.
        console.error(`   ❌ ${m.nombre}: ${e.message}`)
      }
    }
  } finally {
    await c.end()
  }
  return hechas
}

main().then((c) => process.exit(c)).catch((e) => { console.error('❌', e); process.exit(1) })
