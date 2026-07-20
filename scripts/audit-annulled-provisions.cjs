#!/usr/bin/env node
// Auditoría de INCISOS ANULADOS por el TC no marcados (frase-gatillo "revisa los
// incisos anulados" / "revisa las disposiciones anuladas"). Cruza el análisis del BOE
// (datosabiertos → referencias posteriores "SE DECLARA … inconstitucional/nulidad …
// art. N") con nuestros artículos: flaguea los que servimos SIN nota de vigencia.
//
// Origen: incidente 19/07 (art. 126.2 LBRL / STC 103/2013). Cierra el hueco que ni el
// monitor BOE (cambios futuros) ni completitud-leyes (artículos que faltan) vigilaban.
// Lógica = espejo de lib/laws/annulledProvisions.ts (testeada).
//
//   node scripts/audit-annulled-provisions.cjs --law "Ley 7/1985"   # una ley
//   node scripts/audit-annulled-provisions.cjs --limit 40 [--emit]  # lote (prioriza vivas)
//   node scripts/audit-annulled-provisions.cjs --json
//
// --emit escribe hallazgos a observable_events (kind 'article_annulled_unmarked').
// NUNCA auto-corrige: solo flaguea para revisión humana (verificar el inciso contra la
// STC + revisar la clave de las preguntas del artículo). Ver docs/runbooks/.

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

function getUrl() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  const m = env.match(/^DATABASE_URL=(.*)$/m)
  return (m ? m[1] : '').trim().replace(/^["']|["']$/g, '').replace(/\?.*$/, '')
}

// ── espejo de lib/laws/annulledProvisions.ts ────────────────────────────────
const ART_RE = /art(?:[íi]culos?|\.|\b)\s*(\d+(?:\s*bis)?)/gi
const ANNUL_BEFORE = /\binconstitucional|\bnul(?:idad|o|a|os|as)\b|\banulad/i
const CROSSREF_AFTER = /^\s*\.?\d*\s*(?:bis\s*)?de\s+(?:la\s+)?(?:ley|l\.?\s*o\.?|real\s+decreto|rd\b|decreto|reglamento)/i
function parseAnnulledArticles(texto) {
  const out = new Set(); let m; ART_RE.lastIndex = 0
  while ((m = ART_RE.exec(texto)) !== null) {
    const before = texto.slice(Math.max(0, m.index - 55), m.index)
    if (!ANNUL_BEFORE.test(before)) continue
    const after = texto.slice(m.index + m[0].length, m.index + m[0].length + 40)
    if (CROSSREF_AFTER.test(after)) continue
    out.add(m[1].replace(/\s+/g, ' ').trim().toLowerCase())
  }
  return [...out]
}
const parseSentencia = (t) => { const m = t.match(/Sentencia\s+(\d+\/\d{4})/i); return m ? `STC ${m[1]}` : null }
function extractTcAnnulments(j) {
  const post = j?.data?.[0]?.referencias?.posteriores?.[0]?.posterior ?? []
  const res = []
  for (const p of post) {
    const rel = (p?.relacion?.texto || '').toUpperCase(); const texto = p?.texto || ''
    if (!rel.includes('SE DECLARA')) continue
    if (!/\binconstitucional|\bnul(?:idad|o|a)\b/i.test(texto)) continue
    const articles = parseAnnulledArticles(texto)
    if (!articles.length) continue
    res.push({ idNorma: p?.id_norma ?? null, sentencia: parseSentencia(texto), articles, texto })
  }
  return res
}
function articleCarriesVigenciaNote(content) {
  const t = content || ''
  if (/nota\s+de\s+vigencia/i.test(t)) return true
  if (/declarad[oa]s?\b[\s\S]{0,60}\b(?:inconstitucional|nul)[\s\S]{0,80}\b(?:STC|Sentencia)\s+\d+\/\d{4}/i.test(t)) return true
  return false
}
// ────────────────────────────────────────────────────────────────────────────

const boeIdFromUrl = (u) => { const m = (u || '').match(/(BOE-A-\d{4}-\d+)/); return m ? m[1] : null }

async function fetchAnalisis(boeId) {
  try {
    const r = await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${boeId}/analisis`,
      { headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

;(async () => {
  const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null }
  const LIMIT = parseInt(arg('--limit') || '0', 10)
  const ONE = arg('--law')
  const EMIT = process.argv.includes('--emit')
  const JSON_OUT = process.argv.includes('--json')

  const c = new Client({ connectionString: getUrl(), ssl: { rejectUnauthorized: false } })
  await c.connect()

  let where = "l.is_active=true AND l.boe_url ~* 'BOE-A-' AND EXISTS (SELECT 1 FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id WHERE ts.law_id=l.id AND t.is_active=true)"
  const params = []
  if (ONE) { params.push(ONE); where = `(l.short_name = $1 OR l.boe_url ILIKE '%'||$1||'%') AND l.boe_url ~* 'BOE-A-'` }
  const { rows: laws } = await c.query(
    `SELECT l.id, l.short_name, l.boe_url FROM laws l WHERE ${where} ORDER BY l.short_name ${LIMIT ? 'LIMIT ' + LIMIT : ''}`, params)

  const findings = []
  let scanned = 0, withAnnul = 0, noAnalisis = 0
  for (const l of laws) {
    const boeId = boeIdFromUrl(l.boe_url)
    if (!boeId) continue
    scanned++
    const analisis = await fetchAnalisis(boeId)
    if (!analisis) { noAnalisis++; continue }
    const annuls = extractTcAnnulments(analisis)
    if (!annuls.length) continue
    withAnnul++
    // artículos que servimos, por número
    const { rows: arts } = await c.query('SELECT article_number, content FROM articles WHERE law_id=$1', [l.id])
    const byNum = new Map(arts.map((a) => [String(a.article_number).replace(/\s+/g, ' ').trim().toLowerCase(), a.content]))
    for (const a of annuls) {
      for (const artNum of a.articles) {
        if (!byNum.has(artNum)) continue // no servimos ese artículo
        if (articleCarriesVigenciaNote(byNum.get(artNum))) continue // ya marcado
        findings.push({ law: l.short_name, law_id: l.id, article: artNum, sentencia: a.sentencia, id_norma: a.idNorma, texto: a.texto.slice(0, 220) })
      }
    }
  }

  if (EMIT && findings.length) {
    for (const f of findings) {
      await c.query(
        `INSERT INTO observable_events (id, created_at, source, severity, event_type, payload, updated_at)
         VALUES (gen_random_uuid(), now(), 'cli', 'warn', 'article_annulled_unmarked', $1, now())`,
        [JSON.stringify(f)])
    }
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ scanned, withAnnul, noAnalisis, findings }))
  } else {
    console.log(`\n=== Incisos anulados por el TC no marcados ===`)
    console.log(`Leyes escaneadas: ${scanned} · con anulación TC en BOE: ${withAnnul} · sin análisis: ${noAnalisis}`)
    console.log(`🚩 HALLAZGOS (servimos el artículo SIN nota de vigencia): ${findings.length}${EMIT ? ' (emitidos)' : ''}\n`)
    for (const f of findings) {
      console.log(`  • ${f.law} — art. ${f.article} · ${f.sentencia || f.id_norma}`)
      console.log(`    ${f.texto}`)
    }
  }
  await c.end()
  process.exit(process.argv.includes('--gate') && findings.length > 0 ? 1 : 0)
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
