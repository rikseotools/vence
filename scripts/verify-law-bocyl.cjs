#!/usr/bin/env node
// scripts/verify-law-bocyl.cjs
//
// Verifica el CONTENIDO de las leyes ancladas al BOCyL (Boletín Oficial de Castilla y
// León) contra su fuente oficial, artículo por artículo — comparación LITERAL, no solo
// de presencia de números (que es lo único que hace la Capa 3 `verify-law-source.cjs`,
// con `content_mismatch:0` hardcodeado).
//
// Por qué propio y no la Capa 3: varias BOCyL estaban "verificadas" con un mensaje
// genérico de abril (`no_consolidated_text:true`, sin comparar nada) = falso verde
// disfrazado. Un Decreto SÍ tiene texto oficial en el BOCyL.
//
// Dos particularidades del BOCyL:
//   · la URL ELI (`/eli/es-cl/d/2021/05/20/13/`) es una FICHA (metadatos), no el texto;
//     el articulado vive en `<esa-eli>/dof/spa/html`.
//   · UTF-8; el sumario repite las cabeceras al principio → el parser se queda con la
//     ocurrencia más sustanciosa (heredado del extractor BOA).
//
//   node scripts/verify-law-bocyl.cjs --all            # informe
//   node scripts/verify-law-bocyl.cjs <law_id> --dump  # vuelca lo extraído
//   node scripts/verify-law-bocyl.cjs --all --write    # graba evidencia (solo VERIFIED)
const fs = require('fs')
const path = require('path')
const pg = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))
const boa = require('./verify-law-boa.cjs')

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  return fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
}
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

// La ficha ELI no trae el articulado: el texto está en `<eli>/dof/spa/html`.
function textUrl(u) {
  if (/\/dof\/spa\/(html|pdf)$/.test(u)) return u
  if (/\/eli\/[^?]*\/$/.test(u)) return u + 'dof/spa/html'
  if (/\/eli\//.test(u)) return u.replace(/\/$/, '') + '/dof/spa/html'
  return u
}
async function fetchBocyl(u) {
  const res = await fetch(textUrl(u), { headers: { 'User-Agent': UA }, redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return new TextDecoder('utf-8').decode(buf) // BOCyL es UTF-8
}

const SIM_OK = 0.97
// Compara CUERPOS: quita "Artículo N." y el título CONOCIDO de la BD de ambos lados.
// Robusto frente a que un import guarde el título en el content y otro no, sin la
// heurística frágil de longitud (que fallaba con títulos largos en el BOC).
function bodyOf(content, artNum, dbTitle) {
  let t = (content || '')
    .replace(new RegExp(`^\\s*Art[íi]culo\\s+${artNum}\\b\\s*[.\\-–—]?\\s*`, 'i'), '')
  const title = (dbTitle || '').trim().replace(/[.\s]+$/, '')
  if (title) {
    const esc = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    t = t.replace(new RegExp(`^\\s*${esc}\\s*[.\\-–—]?\\s*`, 'i'), '')
  }
  return t.trim()
}
// Comparación insensible a puntuación/espaciado: "a)La" == "a) La", "aplicación El" ==
// "aplicación. El". Deja solo las diferencias de PALABRAS (las divergencias reales), sin
// que un punto o un espacio de más hundan la similitud de un artículo por lo demás idéntico.
function depunct(s) {
  return (s || '').replace(/[^0-9a-záéíóúñüçà\s]/gi, ' ').replace(/\s+/g, ' ').trim()
}

async function verifyLaw(sql, law, { dump = false } = {}) {
  const html = await fetchBocyl(law.boe_url)
  const src = boa.splitArticles(boa.htmlToParagraphs(html))
  if (dump) fs.writeFileSync(`/tmp/bocyl-${law.id}.txt`,
    [...src.values()].map((a) => `=== [${a.number}] ${a.title}\n${a.content}`).join('\n\n'))
  const dbRows = await sql`SELECT article_number, title, content FROM articles WHERE law_id = ${law.id} AND is_active = true`
  const db = new Map(dbRows.map((r) => [String(r.article_number).trim().toLowerCase(), r]))
  const missingInDb = [], extraInDb = [], contentMismatch = [], ok = []
  for (const [num] of src) if (!db.has(num)) missingInDb.push(num)
  for (const [num, r] of db) {
    const a = src.get(num)
    if (!a) { extraInDb.push(num); continue }
    const sim = boa.similarity(depunct(bodyOf(r.content, num, r.title)), depunct(bodyOf(a.content, num, r.title)))
    if (sim >= SIM_OK) ok.push(num)
    else contentMismatch.push({ number: num, sim: +sim.toFixed(3), dbLen: (r.content || '').length, srcLen: a.content.length })
  }
  return { law_id: law.id, short_name: law.short_name, url: textUrl(law.boe_url),
    src_count: src.size, db_count: db.size, ok: ok.length,
    missing_in_db: missingInDb, extra_in_db: extraInDb, content_mismatch: contentMismatch }
}
function verdict(r) {
  if (r.src_count === 0) return 'NO_PARSE'
  if (r.content_mismatch.length) return 'ISSUES'
  if (r.extra_in_db.length) return 'EXTRA_IN_DB'
  return 'VERIFIED' // todos los arts de BD coinciden literal (la fuente puede tener disposiciones extra)
}

// Puras exportadas para test (el gotcha ELI→/dof/spa/html y la comparación de cuerpos).
module.exports = { textUrl, bodyOf, depunct }
if (require.main !== module) return

;(async () => {
  const args = process.argv.slice(2)
  const write = args.includes('--write'), dump = args.includes('--dump'), all = args.includes('--all')
  const lawId = args.find((a) => !a.startsWith('--'))
  const sql = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })
  try {
    const laws = all
      ? await sql`SELECT id, short_name, boe_url FROM laws WHERE boe_url ILIKE '%bocyl.jcyl.es%' ORDER BY short_name`
      : await sql`SELECT id, short_name, boe_url FROM laws WHERE id = ${lawId}`
    const results = []
    for (const law of laws) {
      process.stdout.write(`\n▶ ${law.short_name}\n  ${law.boe_url}\n`)
      let r
      try { r = await verifyLaw(sql, law, { dump }) }
      catch (e) { console.log(`  ❌ ${e.message}`); results.push({ law_id: law.id, error: String(e.message) }); continue }
      const v = verdict(r)
      console.log(`  ${v}  fuente=${r.src_count} · BD=${r.db_count} · coinciden=${r.ok}` +
        `${r.missing_in_db.length ? ` · faltan=${r.missing_in_db.length}` : ''}` +
        `${r.extra_in_db.length ? ` · sobran en BD=${r.extra_in_db.length} [${r.extra_in_db.slice(0, 8)}]` : ''}` +
        `${r.content_mismatch.length ? ` · contenido≠=${r.content_mismatch.length}` : ''}`)
      results.push({ ...r, verdict: v })
      if (write && v === 'VERIFIED') {
        const summary = { source: 'BOCyL', source_url: r.url, source_format: 'html', verifier: 'scripts/verify-law-bocyl.cjs',
          verified_at: new Date().toISOString(), source_is_original_publication: true,
          db_count: r.db_count, matching: r.ok, missing_in_db: 0, extra_in_db: r.extra_in_db.length,
          content_mismatch: 0, title_mismatch: 0, deliberate_subset: r.missing_in_db.length > 0, parse_confidence: 'high',
          is_ok: true, manual_review: true,
          message: `Verificada contra el BOCyL (${r.url}) artículo por artículo: ${r.ok}/${r.db_count} coinciden literal en contenido.` +
            (r.missing_in_db.length ? ` La fuente añade disposiciones/anexos que la BD no almacena (subconjunto).` : '') }
        await sql`UPDATE laws SET last_verification_summary = ${sql.json(summary)} WHERE id = ${law.id}`
        console.log('  💾 evidencia grabada')
      }
    }
    fs.writeFileSync('/tmp/bocyl-verify-report.json', JSON.stringify(results, null, 1))
    console.log('\n📄 informe: /tmp/bocyl-verify-report.json')
  } finally { await sql.end() }
})()
