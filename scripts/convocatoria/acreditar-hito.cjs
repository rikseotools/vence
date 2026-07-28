#!/usr/bin/env node
// scripts/convocatoria/acreditar-hito.cjs
//
// Única vía legítima para ACREDITAR la fecha de un `convocatoria_hitos` (escribir su `url` y su
// `cita_literal`). **Dry-run por defecto.** Hermano de `degradar-origen-hito.cjs`.
//
// ## Por qué existe (T-256, 28/07/2026)
//
// El detector `hito_registro_sin_fuente` levanta la mano cuando una fecha se MUESTRA como oficial
// sin nada que la sostenga. Ese hallazgo se cierra de dos maneras, y hasta hoy solo existía una:
//
//   · la fecha NO consta en ningún boletín → `degradar-origen-hito.cjs` (deja de mostrarse);
//   · la fecha SÍ consta                   → había que escribir la cita A MANO, sin nada que
//     impidiese pegar la portada del boletín y dar el hito por verificado.
//
// Esa segunda vía es la peligrosa: convierte un dato dudoso en uno que PARECE verificado. Por eso
// la contención vive en el núcleo puro `lib/convocatoria/hitoAcreditacion.js` (con tests) y exige
// que **la cita nombre la fecha del hito** y que **la url apunte a un documento**, no a una portada.
//
// Escribe DOS campos (`url`, `cita_literal`) y opcionalmente `source_documento_id` — no es una
// puerta genérica a la tabla—, RELEE tras escribir y deja traza en `observable_events`
// (`hito_acreditado`), del éxito Y del rechazo.
//
// Uso:
//   node scripts/convocatoria/acreditar-hito.cjs --hito <uuid> --url "<url del documento>" \
//        --cita "<frase literal del boletín que fija la fecha>" [--documento <uuid>] [--apply]

require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const { validarAcreditacion } = require('../../lib/convocatoria/hitoAcreditacion.js')

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null }

const APPLY = has('--apply')
const sql = postgres(process.env.DATABASE_URL.split('?')[0], { ssl: { rejectUnauthorized: false }, max: 2 })

async function traza(nivel, detalle) {
  try {
    await sql`
      INSERT INTO observable_events (source, severity, event_type, endpoint, metadata)
      VALUES ('script', ${nivel}, 'hito_acreditado', 'acreditar-hito', ${sql.json(detalle)})`
  } catch { /* la traza no puede tumbar la operación */ }
}

;(async () => {
  const id = val('--hito')
  const url = val('--url')
  const cita = val('--cita')
  const documento = val('--documento')

  if (!id || !url || !cita) {
    console.log(`
Uso:
  --hito <uuid> --url "<url del documento>" --cita "<frase literal>" [--documento <uuid>] [--apply]

La cita tiene que NOMBRAR la fecha del hito y la url apuntar a un documento concreto:
una cita que no dice la fecha no prueba la fecha, y una portada no acredita nada.
`)
    await sql.end()
    return
  }

  const [h] = await sql`
    SELECT h.id, h.titulo, h.fecha, h.origen, h.url, h.cita_literal, h.source_documento_id, o.slug
    FROM convocatoria_hitos h JOIN oposiciones o ON o.id = h.oposicion_id WHERE h.id = ${id}`
  if (!h) { console.error('❌ no existe ese hito'); process.exitCode = 2; await sql.end(); return }

  const v = validarAcreditacion({ hito: h, url, cita })
  console.log(`\n${h.slug} — "${h.titulo}"  ${String(h.fecha).slice(0, 15)}  [origen: ${h.origen}]`)
  if (!v.ok) {
    console.error(`⛔ RECHAZADO: ${v.motivo}`)
    await traza('warn', { rechazo: v.motivo, hito: h.id, slug: h.slug, url, cita: String(cita).slice(0, 300) })
    process.exitCode = 2
    await sql.end()
    return
  }
  console.log(`✅ validación: ${v.motivo}`)
  if (h.url || h.cita_literal) console.log(`⚠️  ya tenía respaldo (url:${h.url ? 'sí' : 'no'} cita:${h.cita_literal ? 'sí' : 'no'}) — se sobrescribe`)
  console.log(`${APPLY ? '✍️  escribiendo' : '🔎 (dry-run)'}\n   url:  ${url}\n   cita: ${String(cita).slice(0, 220)}${cita.length > 220 ? '…' : ''}`)

  if (!APPLY) { console.log('\n(añade --apply para escribirlo)\n'); await sql.end(); return }

  await sql`
    UPDATE convocatoria_hitos
    SET url = ${url}, cita_literal = ${cita}
        ${documento ? sql`, source_documento_id = ${documento}` : sql``}
    WHERE id = ${h.id}`
  // Releer: sin comprobar, un WHERE que no casa se leería como éxito.
  const [tras] = await sql`SELECT url, cita_literal FROM convocatoria_hitos WHERE id = ${h.id}`
  if (tras?.url !== url || tras?.cita_literal !== cita) {
    console.error('   ❌ la escritura NO cuajó — revisar a mano')
    await traza('error', { fallo: 'no_aplicado', hito: h.id, slug: h.slug })
    process.exitCode = 1
    await sql.end()
    return
  }
  console.log('   ✅ aplicado y verificado en BD')
  await traza('info', { hito: h.id, slug: h.slug, titulo: h.titulo, fecha: String(h.fecha).slice(0, 10), url, cita: String(cita).slice(0, 500), documento: documento || null })
  await sql.end()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
