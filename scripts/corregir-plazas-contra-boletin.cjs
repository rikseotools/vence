#!/usr/bin/env node
// scripts/corregir-plazas-contra-boletin.cjs
//
// Única vía legítima para CORREGIR una cifra de plazas contra el boletín. **Dry-run por defecto.**
//
// Es el paso 4 del §6 de `docs/runbooks/provenance-convocatorias.md` ("¿no la sostiene nada? →
// corregirla contra el boletín"). Los otros tres pasos ya tenían herramienta —`clonar-documento.ts`
// para traer el documento bueno y la firma `cifra_derivada` para la cifra que se deduce del propio
// texto—; este era el único que se hacía a mano, y es justo el que cambia un dato que el opositor
// LEE en la landing (T-191, 27/07/2026).
//
// Lo que impide, con el caso real que lo motivó: `administrativo-aragon` publicaba 139 plazas y el
// BOA convoca 144 — el 139 salía de restar las 5 reservadas a colectivos, una resta que no aparece
// escrita en ningún sitio. Es el patrón del 2.163 de Policía Nacional (2.704 − 541). Las plazas
// reservadas son plazas del turno libre CON reserva, no descontadas: en Madrid la cifra correcta
// (111) INCLUYE las 11 de reserva por discapacidad.
//
// GUARDAS (todas rehúsan escribir, no avisan y siguen):
//   1. La cifra nueva tiene que aparecer en la CITA, comprobado con `cifraEnTexto` — el MISMO
//      predicado del detector `plazas_afirmadas_sin_documento`. Escribir una cifra que el detector
//      no daría por probada es imposible por esta vía.
//   2. La cita tiene que parecer una prueba (cláusula en prosa o fila de tabla), mismo criterio que
//      `cita_no_prueba_nada`. Un membrete de boletín no vale.
//   3. `--esperado` = optimistic check: si otra sesión ya cambió el valor, se rehúsa.
//   4. Dual-write en TRANSACCIÓN: `oposiciones` (legacy) y la convocatoria vigente, o ninguna.
//   5. Traza obligatoria en `observable_events`, del éxito Y del rechazo.
//   6. Re-lectura después de escribir: se verifica, no se declara.
//
// Uso:
//   node scripts/corregir-plazas-contra-boletin.cjs --slug=administrativo-aragon --valor=144 \
//     --cita="250102 Escala General Administrativa. Administrativos 144 (3 reservadas a …)" \
//     --url=https://www.boa.aragon.es/… \
//     --motivo="El 139 salía de restar las 5 reservadas; el BOA convoca 144" \
//     [--campo=plazas_libres] [--esperado=139] [--apply]
//
// Si la cifra NO está escrita en ningún documento y aun así es honesta (aritmética sobre literales
// del mismo texto), esta NO es la herramienta: firma `cifra_derivada` en `convocatoria_verification`
// como explica el runbook. Esa distinción es deliberada — cada vía deja un rastro distinto.
require('dotenv').config({ path: '.env.local' })
const path = require('path')
const { Client } = require('pg')
const { validarCorreccion, CAMPOS } = require(path.join(__dirname, '..', 'lib', 'convocatoria', 'correccionPlazas.cjs'))

const arg = (n, def = null) => {
  const p = process.argv.find((a) => a.startsWith(`--${n}=`))
  return p ? p.slice(n.length + 3) : def
}
const APPLY = process.argv.includes('--apply')

async function main() {
  const slug = arg('slug')
  const campo = arg('campo', 'plazas_libres')
  const valor = Number(arg('valor'))
  const esperadoRaw = arg('esperado')
  const esperado = esperadoRaw === null ? undefined : Number(esperadoRaw)
  const cita = arg('cita')
  const url = arg('url')
  const motivo = arg('motivo')

  if (!slug) {
    console.error('uso: --slug=<slug> --valor=<n> --cita="…" --url=https://… --motivo="…" [--campo=' + CAMPOS.join('|') + '] [--esperado=<n>] [--apply]')
    process.exit(2)
  }

  const c = new Client({
    connectionString: (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[a-z-]+/, ''),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  })
  await c.connect()

  const fila = (await c.query(
    `SELECT o.id oid, cv.id cvid, o.${campo} AS legacy, cv.${campo} AS conv, cv."año" ciclo
       FROM oposiciones o JOIN convocatorias cv ON cv.oposicion_id = o.id AND cv.is_current
      WHERE o.slug = $1`, [slug])).rows[0]
  if (!fila) { console.error(`❌ sin convocatoria vigente para ${slug}`); await c.end(); process.exit(1) }

  console.log(`\n${slug} · ${campo} · ciclo ${fila.ciclo}`)
  console.log(`   legacy(oposiciones)=${fila.legacy} · convocatoria=${fila.conv} → propuesto: ${valor}`)
  if (fila.legacy !== fila.conv) {
    console.log('   ⚠️  las dos filas DIVERGEN: esto es una divergencia de dual-write, no una corrección contra el boletín.')
    console.log('      Adjudícala primero con scripts/dual-write-adjudicar.cjs.')
  }

  const v = validarCorreccion({ campo, valor, actual: fila.conv, esperado, cita, url, motivo })
  v.avisos.forEach((a) => console.log(`   🟡 ${a}`))

  if (!v.ok) {
    console.error('\n❌ RECHAZADO:')
    v.errores.forEach((e) => console.error(`   · ${e}`))
    await traza(c, 'rechazada', { slug, campo, valor, actual: fila.conv, errores: v.errores, url })
    await c.end()
    process.exit(1)
  }

  if (!APPLY) {
    console.log('\n— DRY RUN (usa --apply para escribir) —')
    console.log(`   escribiría ${campo}=${valor} en oposiciones Y en la convocatoria vigente`)
    await c.end()
    return
  }

  await c.query('BEGIN')
  try {
    // Optimistic check DENTRO de la transacción: entre la lectura de arriba y este UPDATE puede
    // haber pasado otra sesión. La condición en el WHERE es lo que lo hace atómico de verdad.
    const a = await c.query(`UPDATE oposiciones SET ${campo}=$1 WHERE id=$2 AND ${campo} IS NOT DISTINCT FROM $3 RETURNING id`,
      [valor, fila.oid, fila.legacy])
    const b = await c.query(`UPDATE convocatorias SET ${campo}=$1 WHERE id=$2 AND ${campo} IS NOT DISTINCT FROM $3 RETURNING id`,
      [valor, fila.cvid, fila.conv])
    if (a.rowCount !== 1 || b.rowCount !== 1) {
      await c.query('ROLLBACK')
      console.error(`❌ otra sesión cambió el dato mientras escribía (legacy:${a.rowCount} conv:${b.rowCount}) — nada aplicado`)
      await traza(c, 'colision', { slug, campo, valor, url })
      await c.end(); process.exit(1)
    }
    await traza(c, 'aplicada', { slug, campo, antes: fila.conv, despues: valor, ciclo: fila.ciclo, cita, url, motivo })
    await c.query('COMMIT')
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  }

  // Verificar, no declarar: se relee de BD lo que ha quedado.
  const post = (await c.query(
    `SELECT o.${campo} AS legacy, cv.${campo} AS conv FROM oposiciones o
       JOIN convocatorias cv ON cv.oposicion_id = o.id AND cv.is_current WHERE o.slug=$1`, [slug])).rows[0]
  const ok = post.legacy === valor && post.conv === valor
  console.log(`\n${ok ? '✅' : '❌'} tras escribir: legacy=${post.legacy} · convocatoria=${post.conv}`)
  console.log('   comprueba que el hallazgo se apaga:  npm run audit:convocatorias')
  await c.end()
  process.exit(ok ? 0 : 1)
}

async function traza(c, resultado, meta) {
  try {
    await c.query(
      `INSERT INTO observable_events (source, severity, event_type, endpoint, metadata)
       VALUES ('cli', $1, 'plazas_corregidas_contra_boletin', 'corregir-plazas-contra-boletin', $2::jsonb)`,
      [resultado === 'aplicada' ? 'warn' : 'error', JSON.stringify({ resultado, ...meta })])
  } catch (e) {
    console.error('   ⚠️  no se pudo dejar traza:', e.message)
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
}
