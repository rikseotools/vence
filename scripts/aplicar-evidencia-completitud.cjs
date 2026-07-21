#!/usr/bin/env node
/**
 * Aplica la evidencia de una verificación de completitud a `laws`:
 * registra `boe_url` y escribe `last_verification_summary` (objeto jsonb con la
 * forma que lee `classifyLawCompleteness`), fijando `verification_status`.
 *
 * Uso:
 *   node scripts/aplicar-evidencia-completitud.cjs <slug> <source_url> \
 *        --verbatim N --total M [--discrepan D] [--no-encontrados Z] \
 *        [--subset] [--nota "texto"]
 *
 * GUARDARRAÍL (el que origina todo el runbook): solo marca `actualizada` si la
 * verificación fue LIMPIA (0 discrepan, 0 no_encontrados, verbatim == total).
 * Si hay cualquier discrepancia, deja `pendiente` y `is_ok:false` — la ley
 * seguirá saliendo como accionable hasta que se reconcilie. NUNCA marca
 * verificada "a medias".
 *
 * `--subset` marca `deliberate_subset:true` (el temario pide solo unos títulos,
 * no la norma entera) → el clasificador la da por cerrada SI is_ok. Sin
 * `--subset`, se asume verificación de la norma completa (usa boe_count=total).
 */
const fs = require('fs')
const path = require('path')
const pg = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))

const args = process.argv.slice(2)
const slug = args[0]
const source = args[1]
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const has = (name) => args.includes(`--${name}`)

if (!slug || !source || source.startsWith('--')) {
  console.error('uso: node scripts/aplicar-evidencia-completitud.cjs <slug> <source_url> --verbatim N --total M [--discrepan D] [--no-encontrados Z] [--subset] [--nota "..."]')
  process.exit(1)
}
const verbatim = parseInt(flag('verbatim', 'NaN'), 10)
const total = parseInt(flag('total', 'NaN'), 10)
const discrepan = parseInt(flag('discrepan', '0'), 10)
const noEnc = parseInt(flag('no-encontrados', '0'), 10)
const subset = has('subset')
const nota = flag('nota', '')
if (Number.isNaN(verbatim) || Number.isNaN(total)) {
  console.error('❌ faltan --verbatim y --total (enteros)')
  process.exit(1)
}

const envPath = path.join(__dirname, '..', '.env.local')
const url = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })

;(async () => {
  const law = (await s`SELECT id, short_name FROM laws WHERE slug=${slug}`)[0]
  if (!law) throw new Error(`ley no encontrada: ${slug}`)

  const limpia = discrepan === 0 && noEnc === 0 && verbatim === total
  const su = {
    is_ok: limpia,
    source,
    message:
      `Verificados VERBATIM contra la fuente oficial ${verbatim}/${total} artículos` +
      (limpia ? ', 0 discrepancias.' : `; ${discrepan} discrepan, ${noEnc} no encontrados — NO reconciliado.`) +
      (subset ? ' Subconjunto deliberado por scope (el temario no pide la norma entera).' : '') +
      (nota ? ' ' + nota : ''),
    db_count: total,
    matching: verbatim,
    content_mismatch: discrepan,
    missing_in_db: noEnc,
    verified_at: new Date().toISOString(),
  }
  if (subset) su.deliberate_subset = true
  else su.boe_count = total // verificación de norma completa

  const nuevoStatus = limpia ? 'actualizada' : 'pendiente'
  await s`UPDATE laws SET boe_url=${source}, verification_status=${nuevoStatus}, last_verification_summary=${s.json(su)} WHERE id=${law.id}`

  console.log(`${limpia ? '✅' : '⚠️'} ${law.short_name}`)
  console.log(`   verbatim ${verbatim}/${total} · discrepan ${discrepan} · no encontrados ${noEnc}`)
  console.log(`   status → ${nuevoStatus}${limpia ? '' : '  (queda ACCIONABLE — reconciliar las discrepancias antes de cerrar)'}`)
  console.log(`   fuente → ${source}`)
  await s.end()
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
