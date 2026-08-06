#!/usr/bin/env node
/**
 * assign-seguimiento-urls.cjs
 *
 * Asigna `seguimiento_url` a las oposiciones CATALOGADAS que no la tienen, para
 * que el radar (cron hash_change / detect-*) pueda vigilarlas. Reutilizable e
 * idempotente: se puede correr tras cada tanda de "catalogar descubrimientos".
 *
 * Estrategia (en orden, la primera que casa gana):
 *   1) DONANTE por organismo — otra oposición con el MISMO `administracion` (o su
 *      forma normalizada: sin acentos, guiones→espacio, universidade→universidad)
 *      que YA tiene una `seguimiento_url` validada. Reutiliza esa URL.
 *   2) FALLBACK por CCAA — portal de empleo público oficial de la comunidad/ciudad
 *      autónoma (server-rendered), tomado de la CCAA de la señal que la descubrió.
 *
 * Las que no casan ninguna quedan reportadas para asignación manual (NO se inventa
 * una URL — mejor null explícito que un enlace que no vigila el proceso real).
 *
 * Uso:
 *   node scripts/assign-seguimiento-urls.cjs            # aplica
 *   node scripts/assign-seguimiento-urls.cjs --dry-run  # solo reporta
 *
 * GUARDARRAÍL (T-130): toda URL candidata se comprueba antes de escribirla, con el mismo núcleo
 * que `scripts/seguimiento/repuntar-url.cjs` (`lib/convocatoria/seguimientoVigilable.cjs`). Sin
 * esto, una oposición donante ciega propagaba su ceguera a todas las de su administración.
 *
 * Ver docs/maintenance/oeps-convocatorias-seguimiento.md §10.bis.
 */
require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const path = require('path')
// Guardarraíl COMPARTIDO con `scripts/seguimiento/repuntar-url.cjs` — no una copia. Registrado en
// `lib/admin/toolRegistry.ts`; el guardarraíl de CI exige que TODA herramienta viva que escriba
// `seguimiento_url` pase por aquí. Motivo (T-130, 26/07): este script propaga la URL de una
// oposición DONANTE a las de su misma administración, así que una donante ciega multiplicaba la
// ceguera por N de una sola pasada, en silencio.
const {
  verificarUrlCandidata,
  extraerTextoRelevante,
  decidirEscritura,
  CABECERAS_CRON,
} = require(path.join(__dirname, '..', 'lib', 'convocatoria', 'seguimientoVigilable.cjs'))

/** Descarga como lo haría el cron y dice si la URL sirve contenido de verdad. Cacheada por URL. */
const _cacheVigilable = new Map()
async function esVigilable(url) {
  if (_cacheVigilable.has(url)) return _cacheVigilable.get(url)
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 30000)
  let httpStatus = 0, html = '', error = null
  try {
    const res = await fetch(url, { headers: CABECERAS_CRON, signal: ctrl.signal, redirect: 'follow' })
    httpStatus = res.status
    html = await res.text()
  } catch (e) { error = e.message } finally { clearTimeout(to) }
  const diag = verificarUrlCandidata({ httpStatus, error, texto: extraerTextoRelevante(html) })
  // Se acepta la banda dudosa: aquí la alternativa es dejar la oposición SIN vigilancia ninguna,
  // que es estrictamente peor. Lo que se rechaza es la banda CIEGA (shell de SPA, WAF, desuso).
  const r = { ...decidirEscritura(diag, { aceptarDudoso: true }), nivel: diag.nivel, motivo: diag.motivo }
  _cacheVigilable.set(url, r)
  return r
}

// Portales de empleo público oficiales por CCAA: núcleo puro + testeado en
// `lib/convocatoria/ccaaFallback.cjs` (T-616). Vivía aquí como objeto suelto y
// se indexaba con la etiqueta CRUDA de la señal, que trae el boletín pegado
// («Castilla y León (BOCYL)») → no casaba NUNCA con las claves desnudas: medido
// el 06/08/2026, "por CCAA: 0" sobre 377 catalogadas sin fuente.
const { urlFallbackPorCcaa } = require('../lib/convocatoria/ccaaFallback.cjs')


function normalizeAdmin(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin acentos
    .toLowerCase()
    .replace(/universidade/g, 'universidad')          // gallego → castellano
    .replace(/[\-–—]/g, ' ')                          // guiones → espacio
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function main() {
  const dry = process.argv.includes('--dry-run')
  const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 15, idle_timeout: 8, max: 1, prepare: false })
  try {
    // 1) Mapa de donantes: administracion normalizada → seguimiento_url (la más frecuente)
    const donors = await sql`
      SELECT administracion, seguimiento_url, count(*)::int c
      FROM oposiciones WHERE seguimiento_url IS NOT NULL AND administracion IS NOT NULL
      GROUP BY 1,2 ORDER BY 3 DESC`
    const donorMap = {}
    for (const d of donors) {
      const k = normalizeAdmin(d.administracion)
      if (!donorMap[k]) donorMap[k] = d.seguimiento_url
    }

    // 2) Catalogadas huérfanas + la CCAA de la señal que las descubrió (más reciente)
    const targets = await sql`
      SELECT o.id, o.nombre, o.administracion,
        (SELECT COALESCE(s.raw_extraction->'pag'->>'ccaa', s.region_name)
         FROM oep_detection_signals s WHERE s.oposicion_id = o.id
         ORDER BY s.created_at DESC LIMIT 1) AS ccaa
      FROM oposiciones o
      WHERE o.coverage_level = 'catalogada' AND o.seguimiento_url IS NULL`

    let byDonor = 0, byCcaa = 0
    const unmatched = []
    const ciegas = []
    for (const t of targets) {
      const donor = donorMap[normalizeAdmin(t.administracion)]
      const fallback = urlFallbackPorCcaa(t.ccaa)
      const url = donor || fallback || null
      const src = donor ? 'donante' : (fallback ? `ccaa:${t.ccaa}` : null)
      if (!url) { unmatched.push(`${t.nombre}  [ccaa=${t.ccaa}]`); continue }
      // GUARDARRAÍL: nunca asignar una URL que el radar no pueda leer. Mejor NULL explícito
      // (queda en "sin match" y se ve) que una URL que aparenta vigilancia y no vigila nada.
      const v = await esVigilable(url)
      if (!v.escribir) {
        ciegas.push(`${t.nombre}  → ${url}  [${v.nivel}]`)
        continue
      }
      if (donor) byDonor++; else byCcaa++
      if (!dry) {
        await sql`UPDATE oposiciones SET seguimiento_url = ${url}, seguimiento_change_status = 'ok' WHERE id = ${t.id}`
      }
      console.log(`  ${dry ? '[dry] ' : ''}✓ (${src}) ${t.nombre.slice(0, 52).padEnd(52)} → ${url.slice(0, 60)}`)
    }
    console.log(`\n${dry ? '[DRY-RUN] ' : ''}asignadas por donante: ${byDonor} | por CCAA: ${byCcaa} | sin match: ${unmatched.length}`)
    if (unmatched.length) { console.log('SIN MATCH (asignar manualmente):'); unmatched.forEach(u => console.log('   - ' + u)) }
    if (ciegas.length) {
      console.log(`\nRECHAZADAS por no ser vigilables (${ciegas.length}) — la URL candidata responde pero no sirve contenido:`)
      ciegas.forEach(c => console.log('   - ' + c))
      console.log('   → busca una alternativa servida en HTML; ver docs/maintenance/oeps-convocatorias-seguimiento.md')
    }
    await sql.end()
  } catch (e) { console.error('ERR', e.message); await sql.end(); process.exit(1) }
}
main()
