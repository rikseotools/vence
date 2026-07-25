#!/usr/bin/env node
// scripts/seguimiento/sim-fuentes-ciegas.cjs
//
// SIMULACIÓN bank-wide del detector de fuentes ciegas. **No escribe NADA** — ni BD, ni findings,
// ni badge. Corre `clasificarVigilancia` (núcleo puro, `lib/convocatoria/seguimientoVigilable.cjs`)
// sobre el ÚLTIMO check real de cada oposición y enseña exactamente qué marcaría y por qué.
//
// Por qué existe: un detector que pinga el badge sin haberse simulado antes es cómo se llega a una
// bandeja de 2.053 señales que nadie mira (Capa 3 del radar, 07/07) o a los 46 `hash_change`
// diarios que hubo que retirar (T-047/T-050). Antes de enchufar nada: mirar el volumen, mirar la
// precisión caso por caso, y solo entonces cablear.
//
// Uso:
//   node scripts/seguimiento/sim-fuentes-ciegas.cjs                # resumen + accionables
//   node scripts/seguimiento/sim-fuentes-ciegas.cjs --todos        # incluye la banda warn
//   node scripts/seguimiento/sim-fuentes-ciegas.cjs --solo-activas # solo oposiciones is_active
//   node scripts/seguimiento/sim-fuentes-ciegas.cjs --json         # salida para tuberías
//
// Relacionado: runbook `docs/maintenance/oeps-convocatorias-seguimiento.md`, tarea T-125.

require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const path = require('path')
const { clasificarVigilancia } = require(
  path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'seguimientoVigilable.cjs'),
)

const args = process.argv.slice(2)
const TODOS = args.includes('--todos')
const SOLO_ACTIVAS = args.includes('--solo-activas')
const JSON_OUT = args.includes('--json')

function conectar() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('❌ DATABASE_URL no configurado (RDS). Ver db/client.ts')
    process.exit(2)
  }
  return postgres(url, {
    prepare: false,
    max: 2,
    ssl: { rejectUnauthorized: false },
    onnotice: () => {},
  })
}

async function main() {
  const sql = conectar()
  // Último check de cada oposición. `content_preview` son los primeros 2000 chars del TEXTO ya
  // extraído por el propio cron → es la evidencia que necesita el clasificador, sin re-fetchear.
  //
  // ⚠️ `checked_url = seguimiento_url` NO es adorno: es la capa que impide el falso positivo por
  // evidencia caducada. Sin este filtro, una oposición recién repuntada se juzga con el contenido
  // de su URL ANTERIOR (pasó con `administrativo-diputacion-jaen` el 26/07). Las que aún no tienen
  // evidencia atribuible se cuentan aparte y NO se juzgan: fail-safe deliberado.
  const filas = await sql`
    SELECT DISTINCT ON (c.oposicion_id)
           o.slug, o.nombre, o.is_active, o.seguimiento_url,
           c.http_status, c.error_message, c.content_preview, c.content_length, c.checked_at,
           c.checked_url
    FROM convocatoria_seguimiento_checks c
    JOIN oposiciones o ON o.id = c.oposicion_id
    WHERE o.seguimiento_url IS NOT NULL
    ORDER BY c.oposicion_id, c.checked_at DESC
  `
  const [{ sin_url_seguimiento: sinUrl }] = await sql`
    SELECT count(*)::int AS sin_url_seguimiento FROM oposiciones WHERE seguimiento_url IS NULL
  `
  await sql.end()

  const noAtribuibles = filas.filter((f) => f.checked_url !== f.seguimiento_url)

  const evaluadas = filas
    .filter((f) => f.checked_url === f.seguimiento_url)
    .filter((f) => !SOLO_ACTIVAS || f.is_active)
    .map((f) => ({
      slug: f.slug,
      nombre: f.nombre,
      activa: !!f.is_active,
      url: f.seguimiento_url,
      httpStatus: f.http_status,
      textoLen: (f.content_preview || '').length,
      htmlLen: f.content_length,
      checkedAt: f.checked_at,
      muestra: (f.content_preview || '').slice(0, 90).replace(/\s+/g, ' '),
      ...clasificarVigilancia({
        httpStatus: f.http_status,
        error: f.error_message,
        texto: f.content_preview,
      }),
    }))

  const ciegas = evaluadas.filter((e) => e.severidad === 'error')
  const revisar = evaluadas.filter((e) => e.severidad === 'warn' && e.nivel !== 'fetch_error')
  const fallos = evaluadas.filter((e) => e.nivel === 'fetch_error')
  const sanas = evaluadas.filter((e) => e.vigilable)

  if (JSON_OUT) {
    console.log(JSON.stringify({ total: evaluadas.length, ciegas, revisar, fallos: fallos.length }, null, 2))
    return
  }

  const pct = (n) => `${((n / Math.max(evaluadas.length, 1)) * 100).toFixed(1)}%`
  console.log(`\nSIMULACIÓN — fuentes ciegas de seguimiento  ${SOLO_ACTIVAS ? '(solo activas)' : ''}`)
  console.log('='.repeat(78))
  console.log(`Fuentes JUZGABLES (evidencia atribuible a la URL vigente): ${evaluadas.length}`)
  console.log(
    `  · no juzgadas por evidencia no atribuible: ${noAtribuibles.length} ` +
      '(check anterior al repunte o previo a la migración — se auto-cura en la siguiente pasada del cron)',
  )
  console.log(`  · sin seguimiento_url en absoluto        : ${sinUrl}`)
  console.log('-'.repeat(78))
  console.log(`  ✅ vigilables                   : ${sanas.length} (${pct(sanas.length)})`)
  console.log(`  ❌ CIEGAS y silenciosas (error) : ${ciegas.length} (${pct(ciegas.length)})  ← lo que pingaría el badge`)
  console.log(`  🟡 dudosas (warn, cola)         : ${revisar.length} (${pct(revisar.length)})`)
  console.log(`  ⚠️  fetch fallido (ya visible)   : ${fallos.length} (${pct(fallos.length)})  ← NO lo pinga: ya sale como error`)

  const porNivel = {}
  for (const c of ciegas) porNivel[c.nivel] = (porNivel[c.nivel] || 0) + 1
  if (ciegas.length) {
    console.log('\nDesglose de las CIEGAS por causa:')
    for (const [k, v] of Object.entries(porNivel).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(v).padStart(3)}  ${k}`)
    }
    console.log('\nDetalle (❌ = pingaría el badge):')
    for (const c of ciegas.sort((a, b) => Number(b.activa) - Number(a.activa) || a.textoLen - b.textoLen)) {
      console.log(
        `\n ❌ ${c.activa ? '[ACTIVA] ' : '[catálogo] '}${c.slug}` +
          `\n    ${c.textoLen} chars de texto sobre ${c.htmlLen} de HTML · HTTP ${c.httpStatus} · ${c.nivel}` +
          `\n    ${c.url}` +
          `\n    motivo: ${c.motivo}` +
          `\n    sirve : "${c.muestra}"`,
      )
    }
  }

  if (TODOS && revisar.length) {
    console.log('\n\nBanda de revisión (🟡 warn — NO pinga el badge):')
    for (const r of revisar.sort((a, b) => a.textoLen - b.textoLen)) {
      console.log(` 🟡 ${String(r.textoLen).padStart(4)} chars ${r.activa ? '[ACTIVA]  ' : '[catálogo]'} ${r.slug}`)
      console.log(`      "${r.muestra}"`)
    }
  }

  const activasCiegas = ciegas.filter((c) => c.activa)
  console.log(`\n${'='.repeat(78)}`)
  console.log(
    `VEREDICTO: ${ciegas.length} fuentes ciegas (${activasCiegas.length} en oposiciones ACTIVAS). ` +
      'Nada escrito — esto es una simulación.',
  )
  if (!TODOS) console.log('Añade --todos para ver también la banda de revisión.')
  console.log('')
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
