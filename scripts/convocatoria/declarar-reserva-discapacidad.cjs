#!/usr/bin/env node
'use strict'
//
// Declara si el cupo de discapacidad va DENTRO del turno libre o APARTE, contra el boletín — [T-218]
//
// POR QUÉ EXISTE. `convocatorias.plazas_discapacidad_incluidas` decide dos cosas que el opositor LEE:
// el total que publica la vista `oposiciones_ssot` (`IS TRUE` no suma el cupo; `false` y `NULL` sí) y
// la frase de la landing («…, de las cuales N están reservadas» vs «… y otras N más»). Estaba a NULL
// en 33 de las 123 landings vivas, así que la vista sumaba por defecto y podía inflar el total.
//
// Hermano de `corregir-plazas-contra-boletin.cjs`, y a propósito: es el mismo acto —escribir un hecho
// que se publica— con la misma disciplina (cita literal, optimistic check, dual-write en transacción,
// traza). El juicio vive en el núcleo puro `lib/convocatoria/correccionPlazas.cjs`
// (`validarDeclaracionReserva`, 6 tests), no aquí.
//
// LA GUARDA, en corto: la cita tiene que **nombrar el cupo** y contener el TOTAL que tu declaración
// implica. Si declaras «dentro», ese total es la cifra de turno libre que ya guardamos; si declaras
// «aparte», es libres + cupo. Si el boletín no imprime esa cuenta, no la estás leyendo: la estás
// deduciendo, y una deducción no se publica como hecho.
//
// NUNCA rellenar esto por analogía con una convocatoria parecida ni por lo que dé la suma más
// redonda. Se lee en el boletín o se deja sin declarar (que es una respuesta legítima: la landing
// calla la reserva y no miente).
//
//   node scripts/convocatoria/declarar-reserva-discapacidad.cjs --slug=<slug> --incluidas=true|false \
//     --cita="<literal del boletín>" --url=<url del documento> --motivo="<qué dice y dónde>" [--apply]

require('dotenv').config({ path: '.env.local' })
const path = require('path')
const { Client } = require('pg')
const { validarDeclaracionReserva } = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'correccionPlazas.cjs'))

const arg = (n, def = null) => {
  const p = process.argv.find((a) => a.startsWith(`--${n}=`))
  return p ? p.slice(n.length + 3) : def
}
const APPLY = process.argv.includes('--apply')

async function main() {
  const slug = arg('slug')
  const crudo = arg('incluidas')
  const cita = arg('cita')
  const url = arg('url')
  const motivo = arg('motivo')
  if (!slug || crudo === null) {
    console.error('Uso: --slug=<slug> --incluidas=true|false --cita="…" --url=… --motivo="…" [--apply]')
    process.exit(2)
  }
  const incluidas = crudo === 'true' ? true : crudo === 'false' ? false : null

  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 60000,
  })
  await c.connect()

  const { rows } = await c.query(
    `SELECT o.id AS oid, cv.id AS cvid, cv."año" AS ciclo,
            cv.plazas_libres, cv.plazas_discapacidad, cv.plazas_discapacidad_incluidas AS actual
       FROM oposiciones o JOIN convocatorias cv ON cv.oposicion_id = o.id AND cv.is_current
      WHERE o.slug = $1`, [slug])
  const fila = rows[0]
  if (!fila) { console.error(`❌ no hay convocatoria vigente para ${slug}`); await c.end(); process.exit(1) }

  const v = validarDeclaracionReserva({
    incluidas, cita, url, motivo,
    plazasLibres: fila.plazas_libres,
    plazasDiscapacidad: fila.plazas_discapacidad,
    actual: fila.actual,
  })
  console.log(`\n${slug} (ciclo ${fila.ciclo}): libres=${fila.plazas_libres} cupo=${fila.plazas_discapacidad} actual=${fila.actual}`)
  // «Total del TURNO LIBRE», no del proceso: `plazas_total` de la vista suma además promoción
  // interna y los otros turnos. Confundirlos hace que un número correcto parezca mal (Valencia:
  // turno libre 245, plazas_total 473 porque tiene 228 de promoción).
  console.log(`declaración: el cupo va ${incluidas ? 'DENTRO del turno libre' : 'APARTE'} → total del TURNO LIBRE ${incluidas ? fila.plazas_libres : fila.plazas_libres + fila.plazas_discapacidad}`)
  for (const a of v.avisos) console.log(`   ⚠️  ${a}`)
  if (!v.ok) {
    console.error('\n❌ RECHAZADO:')
    for (const e of v.errores) console.error(`   · ${e}`)
    await c.end(); process.exit(1)
  }
  if (v.avisos.some((a) => a.includes('ya está declarado'))) { await c.end(); return }

  if (!APPLY) {
    console.log('\n— DRY RUN (usa --apply para escribir) —')
    console.log(`   escribiría plazas_discapacidad_incluidas=${incluidas} en la convocatoria vigente`)
    await c.end()
    return
  }

  await c.query('BEGIN')
  try {
    // Optimistic check DENTRO del UPDATE: entre la lectura de arriba y esto puede haber pasado otra
    // sesión. La columna solo existe en `convocatorias` (no hay contraparte legacy en `oposiciones`),
    // así que aquí no hay dual-write que hacer — la vista la resuelve desde la convocatoria vigente.
    const r = await c.query(
      `UPDATE convocatorias SET plazas_discapacidad_incluidas = $1
        WHERE id = $2 AND plazas_discapacidad_incluidas IS NOT DISTINCT FROM $3 RETURNING id`,
      [incluidas, fila.cvid, fila.actual])
    if (r.rowCount !== 1) {
      await c.query('ROLLBACK')
      console.error('❌ otra sesión cambió el dato mientras escribía — nada aplicado')
      await traza(c, 'colision', { slug, incluidas, url })
      await c.end(); process.exit(1)
    }
    await traza(c, 'aplicada', { slug, incluidas, antes: fila.actual, ciclo: fila.ciclo, cita, url, motivo })
    await c.query('COMMIT')
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  }

  // Verificar, no declarar: se relee de la VISTA, que es de donde lee la landing.
  const post = (await c.query(
    `SELECT plazas_libres, plazas_discapacidad, plazas_discapacidad_incluidas AS inc, plazas_total
       FROM oposiciones_ssot WHERE slug = $1`, [slug])).rows[0]
  const ok = post.inc === incluidas
  console.log(`\n${ok ? '✅' : '❌'} en la vista: libres=${post.plazas_libres} cupo=${post.plazas_discapacidad} incluidas=${post.inc} → plazas_total=${post.plazas_total}`)
  console.log('   purga la caché para que la landing lo enseñe:  POST /api/admin/revalidate {"tag":"landing"}')
  await c.end()
  process.exit(ok ? 0 : 1)
}

async function traza(c, resultado, meta) {
  try {
    await c.query(
      `INSERT INTO observable_events (source, severity, event_type, endpoint, metadata)
       VALUES ('cli', $1, 'reserva_discapacidad_declarada', 'declarar-reserva-discapacidad', $2::jsonb)`,
      [resultado === 'aplicada' ? 'warn' : 'error', JSON.stringify({ resultado, ...meta })])
  } catch (e) {
    console.error('   ⚠️  no se pudo dejar traza:', e.message)
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
}
