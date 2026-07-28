#!/usr/bin/env node
// scripts/audit-articulos-truncados.cjs — CAPA 4 del sistema de completitud de leyes (T-241)
//
// Las capas previas miran otra cosa:
//   · monitor BOE `verify-articles` / `verify-law-source.cjs` → qué artículos FALTAN (inventario)
//   · `lib/laws/completeness.ts`                              → si hay EVIDENCIA de verificación
// Ninguna mira si el artículo que SÍ está tiene el texto completo. Este audit compara el TRAMO
// FINAL de cada artículo con el del BOE consolidado (criterio y porqué: `lib/laws/articuloTruncado`).
//
// Reutiliza lo que ya existe, no reimplementa: `bloqueVigente()` para quedarse con la redacción
// VIGENTE de cada bloque (el BOE devuelve todas las históricas, y compararlas mezcladas fue el
// primer error de esta campaña) y el mismo parseo de índice que `poblar-law-sections-boe.cjs`.
//
//   node scripts/audit-articulos-truncados.cjs --ley "Ley 39/2015" --boe BOE-A-2015-10565
//   node scripts/audit-articulos-truncados.cjs --ley CE --boe BOE-A-1978-31229 --limite 40
//
// Ordena por EXPOSICIÓN (preguntas activas que cuelgan del artículo): lo que más ve el opositor,
// primero. Emite `articulos_truncados_audit` a observable_events. NO escribe en `articles`: la
// reparación es caso a caso y con el texto oficial delante.
const fs = require('fs')
const path = require('path')
const pg = (() => { try { return require('postgres') } catch { return require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres')) } })()
const { articuloTruncado } = require('../lib/laws/articuloTruncado')
const { bloqueVigente } = require('../lib/laws/boeBloqueVigente')

const XML = { headers: { Accept: 'application/xml' } }
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null }
const clean = (x) => String(x || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
  .replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  return fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
}

;(async () => {
  const LEY = arg('--ley'), BID = arg('--boe'), LIMITE = parseInt(arg('--limite') || '0', 10)
  if (!LEY || !BID) { console.error('Uso: --ley "<short_name>" --boe <BOE-A-...> [--limite N]'); process.exit(2) }
  const sql = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 })
  try {
    const idx = await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${BID}/texto/indice`, XML)).text()
    const bloques = [...idx.matchAll(/<bloque>\s*<id>([^<]*)<\/id>\s*<titulo>([\s\S]*?)<\/titulo>/g)]
      .map((m) => ({ id: m[1].trim(), label: clean(m[2]) }))
    const porNum = new Map()
    for (const b of bloques) {
      const m = b.label.match(/^Art[íi]culo\s+(\d+\s*(?:bis|ter|quater)?)/i)
      if (m) porNum.set(m[1].replace(/\s+/g, ' ').trim().toLowerCase(), b.id)
    }
    if (!porNum.size) { console.error(`❌ el índice de ${BID} no trae artículos reconocibles`); process.exit(1) }

    const filas = await sql`
      SELECT a.id, a.article_number AS an, a.content,
             (SELECT count(*)::int FROM questions q WHERE q.primary_article_id = a.id AND q.is_active) AS preg
        FROM articles a JOIN laws l ON l.id = a.law_id
       WHERE l.short_name = ${LEY} AND a.is_active AND a.content IS NOT NULL
       ORDER BY preg DESC`
    const lote = LIMITE > 0 ? filas.slice(0, LIMITE) : filas

    const malos = []
    let comparados = 0, sinBloque = 0
    for (const a of lote) {
      const bid = porNum.get(String(a.an).toLowerCase().trim())
      if (!bid) { sinBloque++; continue }
      let oficial = ''
      try {
        const xml = await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${BID}/texto/bloque/${bid}`, XML)).text()
        const v = bloqueVigente(xml)          // redacción VIGENTE, sin notas editoriales
        oficial = clean((v && v.texto) || '')
      } catch { continue }
      const r = articuloTruncado(a.content, oficial)
      if (oficial) comparados++
      if (r) malos.push({ an: a.an, preg: a.preg, ...r, muestra: oficial.slice(-90) })
    }
    malos.sort((x, y) => y.preg - x.preg)

    console.log(`\n═══ ${LEY} · ${BID} ═══`)
    console.log(`Artículos en BD (lote)       : ${lote.length}`)
    console.log(`Comparados contra el BOE     : ${comparados}${sinBloque ? `  (${sinBloque} sin bloque equivalente)` : ''}`)
    console.log(`INCOMPLETOS (falta el final) : ${malos.length}`)
    for (const m of malos.slice(0, 25)) {
      console.log(`   art ${String(m.an).padEnd(8)} ${String(m.preg).padStart(4)} preg · ${m.nuestro} vs ${m.oficial} chars`)
      console.log(`      falta el tramo: "…${m.muestra}"`)
    }
    if (malos.length) console.log('\n⚠️  Reparar con el texto oficial delante, artículo por artículo. NUNCA reescribir de memoria.')

    try {
      await sql`INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
        VALUES (gen_random_uuid(), NOW(), 'script:audit-articulos-truncados',
                ${malos.length ? 'warn' : 'info'}, 'articulos_truncados_audit',
                ${sql.json({ ley: LEY, boe_id: BID, comparados, incompletos: malos.length,
                             top: malos.slice(0, 10).map((m) => ({ art: m.an, preg: m.preg })) })}::jsonb, NOW())`
    } catch (e) { console.error(`(observabilidad no registrada: ${e.message.slice(0, 60)})`) }
  } finally { await sql.end() }
})()
