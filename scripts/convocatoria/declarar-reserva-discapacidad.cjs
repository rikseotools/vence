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

/**
 * Modo PROPONER: barre las convocatorias sin declarar, busca en su corpus las formas conocidas y
 * enseña la evidencia. NO escribe nada — ni siquiera cuando la propuesta es unánime. La declaración
 * la sigue firmando una persona con la cita delante, que es lo que exige una cifra de plazas.
 */
async function proponer(c, soloSlug) {
  const { proponerRelacion, propuestaUnanime } = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'evidenciaReserva.cjs'))
  const { cifraEnTexto } = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'cifraEnTexto.cjs'))
  const { rows } = await c.query(`
    SELECT o.slug, cv.plazas_libres AS libres, cv.plazas_discapacidad AS cupo,
           COALESCE((SELECT count(*)::int FROM user_profiles up
                      WHERE up.target_oposicion = replace(o.slug, '-', '_')), 0) AS usuarios,
           (SELECT string_agg(d.extracted_text, ' ') FROM convocatoria_documentos d
             WHERE d.convocatoria_id = cv.id) AS corpus
      FROM oposiciones o JOIN convocatorias cv ON cv.oposicion_id = o.id AND cv.is_current
     WHERE o.is_active AND cv.plazas_discapacidad > 0
       AND cv.plazas_discapacidad_incluidas IS NULL
       AND ($1::text IS NULL OR o.slug = $1)
     ORDER BY usuarios DESC`, [soloSlug])

  let unanimes = 0, discrepan = 0, mudas = 0, sinDocumento = 0, formaNueva = 0
  for (const r of rows) {
    const props = proponerRelacion(r.corpus, { plazasLibres: r.libres, plazasDiscapacidad: r.cupo })
    const u = propuestaUnanime(props)
    const cab = `${String(r.usuarios).padStart(4)} usuarios · ${r.slug.padEnd(46)} libres=${r.libres} cupo=${r.cupo}`
    if (u) {
      unanimes++
      console.log(`\n✅ ${cab}\n   → propone ${u.incluidas ? 'DENTRO' : 'APARTE'} (${u.evidencias.length} evidencia(s))`)
      for (const e of u.evidencias.slice(0, 2)) console.log(`      · ${e.via}${e.nums ? ` → [${e.nums.join(" ")}]` : ""}\n        «…${e.cita.slice(0, 260)}…»`)
    } else if (props.length) {
      discrepan++
      console.log(`\n⚠️  ${cab}\n   → el corpus dice las DOS cosas: hay que leerlo`)
      for (const e of props.slice(0, 2)) console.log(`      · [${e.incluidas ? 'dentro' : 'aparte'}] ${e.via}\n        «…${e.cita.slice(0, 200)}…»`)
    } else {
      mudas++
      // «Sin evidencia» son dos averías MUY distintas y conviene no confundirlas:
      //  · si el corpus ni siquiera contiene la cifra del turno libre, el problema no es el patrón:
      //    es que no tenemos el documento que la prueba (territorio de `plazas_afirmadas_sin_documento`).
      //  · si la contiene y aun así no reconocemos la relación, es una FORMA NUEVA que hay que leer
      //    a mano y, si se repite, enseñársela al lector.
      const tieneCifra = cifraEnTexto(r.libres, r.corpus)
      const tieneCupo = cifraEnTexto(r.cupo, r.corpus)
      if (!tieneCifra) sinDocumento++
      else formaNueva++
      console.log(`\n·  ${cab}\n   → ${tieneCifra
        ? `forma NUEVA: el corpus sí trae el ${r.libres}${tieneCupo ? ` y el ${r.cupo}` : ` (pero NO el cupo ${r.cupo})`} — hay que leerlo`
        : `NO hay documento que pruebe ni el ${r.libres}: primero clonar el boletín bueno`}`)
    }
  }
  console.log(`\n═══ ${rows.length} sin declarar · ${unanimes} con propuesta limpia · ${discrepan} contradictorias · ${mudas} mudas`)
  console.log(`    de las mudas: ${formaNueva} con la cifra en el documento (forma nueva, a leer) · ${sinDocumento} SIN documento que pruebe la cifra`)
  console.log('   Nada de esto se ha escrito. Para declarar: --slug=… --incluidas=… --cita="…" --url=… --motivo="…" --apply')
}

async function main() {
  const slug = arg('slug')
  const crudo = arg('incluidas')
  const cita = arg('cita')
  const url = arg('url')
  const motivo = arg('motivo')
  const PROPONER = process.argv.includes('--proponer')
  if (!PROPONER && (!slug || crudo === null)) {
    console.error('Uso: --proponer [--slug=<slug>]')
    console.error('  o: --slug=<slug> --incluidas=true|false --cita="…" --url=… --motivo="…" [--apply]')
    process.exit(2)
  }
  const incluidas = crudo === 'true' ? true : crudo === 'false' ? false : null

  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    // El modo proponer se trae el corpus ENTERO de cada convocatoria (varios MB por boletín), así
    // que necesita más margen que una escritura, que solo toca una fila.
    statement_timeout: PROPONER ? 180000 : 60000,
  })
  await c.connect()

  if (PROPONER) {
    await proponer(c, slug)
    await c.end()
    return
  }

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
