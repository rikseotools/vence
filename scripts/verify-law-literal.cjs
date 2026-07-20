#!/usr/bin/env node
// scripts/verify-law-literal.cjs
//
// Verificador LITERAL genérico y CRUFT-AWARE de leyes non-BOE contra su fuente oficial.
// Nace del hallazgo 20/07: 56 leyes con "falso-verde de abril" (evidencia hueca, sin
// comparación de contenido). El objetivo es SEPARAR las genuinamente truncadas (como
// Decreto 13/2021, que guardaba solo el 1er apartado) de los FALSOS POSITIVOS que produce
// un detector por longitud: los PDF/HTML oficiales traen mucho "cruft" editorial
// (notas de reforma, "Ver el artículo X del Estatuto", "Pág. 31", cabeceras de página,
// "Servicio de Publicaciones…") que infla la "fuente" y hace parecer truncada una BD
// que en realidad está completa (caso art 68 del Reglamento del Parlamento de Andalucía).
//
// Métrica: por artículo, se quita el cruft de la fuente y se mide cuánta de la fuente
// (cruft-free) está CONTENIDA en la BD. Un artículo truncado deja fuera apartados enteros
// (contención baja); uno completo cubre casi todo aunque la fuente traiga anotaciones.
//
//   node scripts/verify-law-literal.cjs <law_id> [--dump]
//   node scripts/verify-law-literal.cjs --hollow [--limit N]   # lote falso-verde de abril
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
// Driver de postgres cargado PEREZOSAMENTE (mismo arreglo que verify-law-boa.cjs):
// antes se resolvia con una ruta CABLEADA a backend/node_modules/postgres, que en CI no
// existe (alli solo se instalan las dependencias de la raiz) -> la suite entera fallaba al
// arrancar con "Cannot find module .../backend/node_modules/postgres" y dejaba el gate de
// deploy en ROJO para todas las sesiones. `postgres` esta en el package.json de la RAIZ.
const loadPg = () => require('postgres')
const boa = require('./verify-law-boa.cjs')

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  return fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
}
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

// Resuelve la ficha ELI del BOCyL al texto (igual que verify-law-bocyl)
function textUrl(u) {
  if (/bocyl\.jcyl\.es\/eli\//.test(u) && !/\/dof\/spa\//.test(u)) return u.replace(/\/$/, '') + '/dof/spa/html'
  return u
}
async function fetchSource(u) {
  const res = await fetch(textUrl(u), { headers: { 'User-Agent': UA }, redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.slice(0, 5).toString('latin1').startsWith('%PDF')) {
    const tmp = path.join(require('os').tmpdir(), `vll-${process.pid}-${Date.now()}.pdf`)
    fs.writeFileSync(tmp, buf)
    try { return { text: execFileSync('pdftotext', ['-layout', '-nopgbrk', tmp, '-'], { maxBuffer: 128 * 1024 * 1024 }).toString('utf8'), kind: 'pdf' } }
    finally { fs.unlinkSync(tmp) }
  }
  const head = buf.slice(0, 2048).toString('latin1')
  const enc = /charset=["']?(iso-8859|latin|windows-1252)/i.test(head) ? 'latin1' : 'utf-8'
  return { html: new TextDecoder(enc).decode(buf), kind: 'html' }
}

// ── Cruft editorial: líneas/frases que NO son texto normativo del artículo ──
const CRUFT = [
  /^Este art[íi]culo fue (a[ñn]adido|modificado|suprimido|redactado)/i,
  /^El art[íi]culo \d+ (fue|queda)/i,
  /^Acuerdo de la Mesa del Parlamento/i,
  /^Ver (el|la|los|las)?\s*(art[íi]culo|disposici[oó]n|apartado)/i,
  /^V[eé]ase\b/i,
  /^Servicio de Publicaciones/i,
  /^Reglamento del Parlamento/i,
  /^Bolet[íi]n Oficial\b/i,
  /^P[áa]g(\.|ina)?\s*\d+/i,
  /^\d+\s*$/,
  /^\(BO[A-Z]+\b/i,
  /^por (la|el) (reforma|Acuerdo|resoluci[oó]n)/i,
  /Estatuto de Autonom[íi]a para/i,
]
function stripCruft(s) {
  return (s || '').split('\n').filter((l) => {
    const t = l.trim()
    return t && !CRUFT.some((re) => re.test(t))
  }).join('\n')
}

// Contención: fracción de bigramas de A que aparecen en B (¿está A dentro de B?).
function containment(a, b) {
  const grams = (s) => {
    const w = boa.norm(s).replace(/[^0-9a-záéíóúñü\s]/gi, ' ').split(/\s+/).filter(Boolean)
    const g = new Set()
    for (let i = 0; i < w.length - 1; i++) g.add(w[i] + ' ' + w[i + 1])
    return g
  }
  const A = grams(a), B = grams(b)
  if (!A.size) return 1
  let hit = 0
  for (const k of A) if (B.has(k)) hit++
  return hit / A.size
}

async function verify(sql, law, { dump = false } = {}) {
  const fetched = await fetchSource(law.boe_url)
  const paras = fetched.kind === 'pdf' ? boa.pdfToParagraphs(fetched.text) : boa.htmlToParagraphs(fetched.html)
  const src = boa.splitArticles(paras)
  if (dump) fs.writeFileSync(`/tmp/vll-${law.id}.txt`, [...src.values()].map((a) => `=== [${a.number}]\n${a.content}`).join('\n\n'))
  const db = new Map((await sql`SELECT article_number, content FROM articles WHERE law_id = ${law.id} AND is_active = true`)
    .map((r) => [String(r.article_number).trim().toLowerCase(), r]))
  const truncated = [], missing = []
  let full = 0
  for (const [num, a] of src) {
    if (!db.has(num)) continue
    // ¿cuánta de la fuente (cruft-free) está en la BD?
    const cov = containment(boa.stripHeaderLine(stripCruft(a.content)), db.get(num).content)
    if (cov >= 0.85) full++
    else truncated.push({ num, cov: +cov.toFixed(2), dbLen: db.get(num).content.length, srcLen: a.content.length })
  }
  for (const [num] of src) if (!db.has(num)) missing.push(num)
  return { src: src.size, db: db.size, full, truncated: truncated.sort((a, b) => a.cov - b.cov), missing }
}

module.exports = { stripCruft, containment, textUrl }
if (require.main !== module) return

;(async () => {
  const args = process.argv.slice(2)
  const dump = args.includes('--dump')
  const sql = loadPg()(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })
  try {
    let laws
    if (args.includes('--hollow')) {
      const lim = +(args[args.indexOf('--limit') + 1]) || 12
      laws = await sql`
        SELECT l.id, l.short_name, l.boe_url, count(DISTINCT q.id)::int preg
        FROM laws l JOIN articles a ON a.law_id=l.id AND a.is_active
        JOIN questions q ON q.primary_article_id=a.id AND q.is_active
        WHERE (l.last_verification_summary->>'message') ~* '(Extractor BOE no compatible|sin texto consolidado en BOE)'
          AND (l.last_verification_summary->>'manual_verification')='true'
          AND (l.last_verification_summary->>'db_count') IS NULL
        GROUP BY l.id ORDER BY count(DISTINCT q.id) DESC LIMIT ${lim}`
    } else {
      laws = await sql`SELECT id, short_name, boe_url FROM laws WHERE id = ${args.find((a) => !a.startsWith('--'))}`
    }
    for (const law of laws) {
      process.stdout.write(`\n▶ ${law.short_name}${law.preg ? ` (${law.preg}p)` : ''}\n  ${law.boe_url}\n`)
      try {
        const r = await verify(sql, law, { dump })
        const verdict = r.src === 0 ? 'NO_PARSE' : r.truncated.length ? 'TRUNCADA?' : 'OK'
        console.log(`  ${verdict}  fuente=${r.src} BD=${r.db} completos=${r.full} truncados?=${r.truncated.length} faltan=${r.missing.length}`)
        if (r.truncated.length) console.log(`    → ${r.truncated.slice(0, 10).map((t) => `${t.num}(cov${t.cov} ${t.dbLen}/${t.srcLen})`).join(', ')}`)
      } catch (e) { console.log(`  ❌ ${e.message}`) }
    }
  } finally { await sql.end() }
})()
