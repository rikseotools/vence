#!/usr/bin/env node
// scripts/convocatoria/degradar-origen-hito.cjs
//
// Única vía legítima para cambiar el `origen` de un `convocatoria_hitos`. **Dry-run por defecto.**
//
// ## Por qué existe (T-256, 28/07/2026)
//
// `origen` NO es documentación: **el render decide con él**. Un hito `registro` (= fecha REAL
// registrada) se MUESTRA al opositor; uno `estimacion` se oculta desde el 20/07 para no vender
// una previsión como oficial. Y hasta hoy **no había ningún escritor**: el campo se ponía a mano
// desde scripts de construcción, sin exigir que la fecha tuviera fuente.
//
// Resultado medido: de **960** hitos `registro`, **642 (67%)** sin url, sin `cita_literal` y sin
// `source_documento_id`. Verificado contra dos fuentes oficiales: la landing de Huesca anuncia
// "Primer ejercicio (examen) → 01/11/2026" y **ni el Ayuntamiento ni el BOE han publicado fecha**.
//
// ## Lo que este script NO te deja hacer, a propósito
//
// **«Sin respaldo» no es «inventada»**: muchos cierres de plazo derivan de `inscription_deadline`,
// que sí está verificado — les falta la cita, no la verdad (provenance, T-147). Degradar en bloque
// cambiaría un error por otro. Por eso:
//   · degrada SOLO lo que se contradice a sí mismo (título que dice "previsión" con `origen=registro`);
//   · para cualquier otro caso exige `--verificado "<qué fuente miraste y qué decía>"`, que queda
//     escrito en la traza. Sin eso, se REHÚSA.
// La decisión vive en el núcleo puro `lib/convocatoria/hitoOrigen.js` (con tests), no aquí.
//
// Escribe UN solo campo (`origen`) — no es una puerta genérica a la tabla— y deja traza en
// `observable_events` (`hito_origen_degradado`), tanto el éxito como el rechazo.
//
// Uso:
//   node scripts/convocatoria/degradar-origen-hito.cjs --listar [<slug>]
//   node scripts/convocatoria/degradar-origen-hito.cjs --autocontradictorios [--apply]
//   node scripts/convocatoria/degradar-origen-hito.cjs --hito <uuid> --verificado "…" [--apply]

require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const { clasificarHito, esFechaDeExamen } = require('../../lib/convocatoria/hitoOrigen.js')

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null }

const APPLY = has('--apply')
const sql = postgres(process.env.DATABASE_URL.split('?')[0], { ssl: { rejectUnauthorized: false }, max: 2 })

/** Traza: éxito y rechazo. Sin esto no se puede auditar quién cambió qué ni por qué. */
async function traza(nivel, detalle) {
  try {
    await sql`
      INSERT INTO observable_events (source, severity, event_type, endpoint, metadata)
      VALUES ('script', ${nivel}, 'hito_origen_degradado', 'degradar-origen-hito', ${sql.json(detalle)})`
  } catch { /* la traza no puede tumbar la operación */ }
}

async function cargarSospechosos(slug) {
  return sql`
    SELECT h.id, h.titulo, h.origen, h.url, h.cita_literal, h.source_documento_id,
           to_char(h.fecha,'DD/MM/YY') AS fecha, h.fecha AS fecha_raw, h.status,
           o.slug, o.is_active
    FROM convocatoria_hitos h
    JOIN oposiciones o ON o.id = h.oposicion_id
    WHERE h.origen = 'registro'
      AND h.url IS NULL AND h.cita_literal IS NULL AND h.source_documento_id IS NULL
      ${slug ? sql`AND o.slug = ${slug}` : sql``}
    ORDER BY o.is_active DESC, h.fecha`
}

async function listar(slug) {
  const filas = await cargarSospechosos(slug)
  const futuros = filas.filter((f) => f.fecha_raw && new Date(f.fecha_raw) > new Date())
  console.log(`\nHitos \`registro\` SIN respaldo: ${filas.length} (${futuros.length} con fecha futura)\n`)
  for (const f of filas.filter((x) => x.is_active && x.fecha_raw && new Date(x.fecha_raw) > new Date())) {
    const c = clasificarHito(f)
    const marca = c.accion === 'degradar' ? '🔻' : esFechaDeExamen(f) ? '⚠️ ' : '  '
    console.log(`${marca} ${f.slug.padEnd(46)} ${f.fecha}  ${f.titulo}`)
    console.log(`     ${c.accion.toUpperCase()}: ${c.motivo}`)
    console.log(`     id: ${f.id}`)
  }
  console.log('\n🔻 = se contradice solo (degradable sin boletín) · ⚠️ = fecha de EXAMEN: verifica y usa --verificado\n')
}

async function degradar(filas, motivoManual) {
  let hechos = 0
  for (const f of filas) {
    const c = clasificarHito(f)
    const permitido = c.accion === 'degradar' || (c.accion === 'requiere_fuente' && motivoManual)
    if (!permitido) {
      console.log(`⛔ ${f.slug} — ${f.titulo}: ${c.motivo}`)
      if (c.accion === 'requiere_fuente') {
        console.log('   → verifica contra su boletín y repite con: --verificado "qué miraste y qué decía"')
        await traza('warn', { rechazo: 'sin_verificacion', hito: f.id, slug: f.slug, titulo: f.titulo })
      }
      continue
    }
    const motivo = motivoManual || c.motivo
    console.log(`${APPLY ? '✍️ ' : '🔎 (dry-run)'} ${f.slug} — "${f.titulo}" ${f.fecha}: registro → estimacion`)
    console.log(`     motivo: ${motivo}`)
    if (!APPLY) { hechos++; continue }

    await sql`UPDATE convocatoria_hitos SET origen = 'estimacion' WHERE id = ${f.id}`
    // Releer: si no se comprueba, un WHERE que no casa se lee como éxito.
    const [tras] = await sql`SELECT origen FROM convocatoria_hitos WHERE id = ${f.id}`
    if (tras?.origen !== 'estimacion') {
      console.error(`   ❌ la escritura NO cuajó (origen = ${tras?.origen}) — revisar a mano`)
      await traza('error', { fallo: 'no_aplicado', hito: f.id, slug: f.slug })
      continue
    }
    console.log('   ✅ aplicado y verificado en BD')
    await traza('info', { hito: f.id, slug: f.slug, titulo: f.titulo, fecha: f.fecha, de: 'registro', a: 'estimacion', motivo })
    hechos++
  }
  console.log(`\n${APPLY ? 'Aplicados' : 'Se aplicarían'}: ${hechos}${APPLY ? '' : '  (añade --apply)'}\n`)
}

;(async () => {
  if (has('--listar')) {
    await listar(val('--listar') && !val('--listar').startsWith('--') ? val('--listar') : null)
  } else if (has('--autocontradictorios')) {
    const filas = (await cargarSospechosos(null)).filter((f) => clasificarHito(f).accion === 'degradar')
    console.log(`\nAutocontradictorios (título dice previsión, campo dice registro): ${filas.length}\n`)
    await degradar(filas, null)
  } else if (has('--hito')) {
    const id = val('--hito')
    const [f] = await sql`
      SELECT h.id, h.titulo, h.origen, h.url, h.cita_literal, h.source_documento_id,
             to_char(h.fecha,'DD/MM/YY') AS fecha, o.slug
      FROM convocatoria_hitos h JOIN oposiciones o ON o.id = h.oposicion_id WHERE h.id = ${id}`
    if (!f) { console.error('❌ no existe ese hito'); process.exitCode = 2 }
    else await degradar([f], val('--verificado'))
  } else {
    console.log(`
Uso:
  --listar [<slug>]                          ver los sospechosos (solo lectura)
  --autocontradictorios [--apply]            degrada los que se delatan solos
  --hito <uuid> --verificado "…" [--apply]   degrada uno concreto, con la fuente por escrito
`)
  }
  await sql.end()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
