#!/usr/bin/env node
// scripts/convocatoria/sim-audit-landings.cjs
//
// SIMULACIÓN bank-wide de `audit:landing`: corre la auditoría sobre TODAS las landings activas y
// enseña cuántas están mal, por qué, y con qué precisión habla cada detector. **No escribe nada.**
//
//   npm run sim:audit-landings                 # las 123 activas, sin comprobar enlaces (rápido)
//   npm run sim:audit-landings -- --con-red 8  # además, auditoría COMPLETA (con enlaces) de las 8
//                                              # más expuestas (plazo abierto y más usuarios)
//   npm run sim:audit-landings -- --json
//
// Por qué existe: la auditoría por-landing es la puerta antes de mandar una campaña, así que hay
// que saber ANTES cuánta gente pasa por esa puerta y si lo que dice es cierto. Correrla una vez
// sobre una landing no dice nada de su precisión; correrla sobre las 123 sí. Es la misma disciplina
// que sacó del barrido nocturno a los tres detectores nuevos (T-142): medir antes de encender.
//
// Los enlaces se comprueban solo en el subconjunto pedido porque son ~70 peticiones por landing:
// las 123 completas son ~8.600 y no se pagan por lo que cazan en una simulación.

require('dotenv').config({ path: '.env.local' })
const path = require('path')
const { spawnSync } = require('child_process')
const postgres = require('postgres')

const argv = process.argv.slice(2)
const JSON_OUT = argv.includes('--json')
const idxRed = argv.indexOf('--con-red')
const CON_RED = idxRed >= 0 ? parseInt(argv[idxRed + 1] || '0', 10) : 0
const AUDIT = path.join(__dirname, 'audit-landing.cjs')

function conectar() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no configurado (RDS)')
    process.exit(2)
  }
  return postgres(process.env.DATABASE_URL, { prepare: false, max: 2, ssl: { rejectUnauthorized: false }, onnotice: () => {} })
}

/** Corre la auditoría de un slug y devuelve su JSON (o null si reventó). */
function auditar(slug, conRed) {
  const args = [AUDIT, slug, '--json']
  if (!conRed) args.push('--sin-red')
  const r = spawnSync('node', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, env: process.env })
  try {
    return JSON.parse(r.stdout)
  } catch {
    return { slug, error: (r.stderr || r.stdout || 'sin salida').trim().slice(0, 160), veredicto: 'FALLO' }
  }
}

const kindDe = (linea) => {
  const m = String(linea).match(/^\[([a-z_0-9]+)\]/)
  return m ? m[1] : 'otro'
}

async function main() {
  const sql = conectar()
  // Orden por exposición: primero las que tienen plazo abierto (a esas se les manda campaña) y
  // dentro, las de más usuarios. Es el orden en el que importa que la auditoría acierte.
  const filas = await sql`
    SELECT s.slug, s.estado_proceso,
           (SELECT count(*)::int FROM user_profiles u
             WHERE u.target_oposicion = replace(s.slug, '-', '_')) AS usuarios
    FROM oposiciones_ssot s
    WHERE s.is_active
    ORDER BY (s.estado_proceso IN ('inscripcion_abierta','convocatoria_publicada','convocada')) DESC,
             usuarios DESC, s.slug`
  await sql.end()

  const conRed = new Set(filas.slice(0, CON_RED).map((f) => f.slug))
  const resultados = []
  for (const f of filas) {
    const r = auditar(f.slug, conRed.has(f.slug))
    resultados.push({ ...r, estado: f.estado_proceso, usuarios: f.usuarios, conRed: conRed.has(f.slug) })
    if (!JSON_OUT) process.stdout.write(r.veredicto === 'ERROR' ? '✕' : r.veredicto === 'AVISOS' ? '·' : r.veredicto === 'FALLO' ? '!' : '✓')
  }
  if (!JSON_OUT) process.stdout.write('\n')

  const conError = resultados.filter((r) => r.veredicto === 'ERROR')
  const conAviso = resultados.filter((r) => r.veredicto === 'AVISOS')
  const limpias = resultados.filter((r) => r.veredicto === 'OK')
  const fallos = resultados.filter((r) => r.veredicto === 'FALLO')

  const porKind = new Map()
  for (const r of resultados) {
    for (const linea of [...(r.errores || []), ...(r.avisos || [])]) {
      const k = kindDe(linea)
      if (!porKind.has(k)) porKind.set(k, { n: 0, slugs: new Set(), severidad: (r.errores || []).includes(linea) ? 'error' : 'warn' })
      const e = porKind.get(k)
      e.n++
      e.slugs.add(r.slug)
    }
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ total: resultados.length, conError: conError.length, conAviso: conAviso.length, limpias: limpias.length, fallos: fallos.length, resultados }, null, 2))
    return
  }

  console.log(`\n${'='.repeat(78)}`)
  console.log(`SIMULACIÓN de audit:landing — ${resultados.length} landings activas` + (CON_RED ? ` (${CON_RED} con comprobación de enlaces)` : ' (sin comprobar enlaces)'))
  console.log('='.repeat(78))
  console.log(`  ❌ con ERRORES: ${conError.length}   🟡 solo avisos: ${conAviso.length}   ✅ limpias: ${limpias.length}   ! fallo de la propia auditoría: ${fallos.length}`)

  console.log(`\n── Hallazgos por detector (cuántas landings toca cada uno) ──`)
  for (const [k, e] of [...porKind.entries()].sort((a, b) => b[1].slugs.size - a[1].slugs.size)) {
    console.log(`  ${String(e.slugs.size).padStart(3)} landings · ${e.n} hallazgos · ${k}`)
  }

  if (conError.length) {
    console.log(`\n── Landings con ERRORES (lo que bloquea una campaña) ──`)
    for (const r of conError) {
      console.log(`  ✕ ${r.slug} [${r.estado || '—'}] · ${r.usuarios} usuarios`)
      for (const e of r.errores) console.log(`      ${e.slice(0, 150)}`)
    }
  }
  if (fallos.length) {
    console.log(`\n── La auditoría NO pudo correr (esto también es un fallo del sistema) ──`)
    for (const r of fallos) console.log(`  ! ${r.slug}: ${r.error}`)
  }
  console.log('\nNada de esto se ha escrito. Para arreglar: docs/runbooks/salud-contenido.md\n')
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
