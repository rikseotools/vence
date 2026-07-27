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
// Mapeo artículo→bloque del BOE: núcleo COMPARTIDO y endurecido (dígitos, letra, sufijos
// compuestos, "Art" abreviado). Nada de una copia local: es lo que hacía ciega a la mitad
// del corpus. Ver T-169.
const { mapaBloquesPorArticulo } = require(path.join(__dirname, '..', 'lib', 'laws', 'boeBloqueVigente'))

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
// T-169: la nota CANÓNICA vive en la columna `articles.vigencia_notes` (T-048), no en el
// `content` — que no se toca a propósito, porque las explicaciones lo citan verbatim.
// Mirando solo el content, marcar un artículo con la herramienta correcta NO apagaba el
// aviso (medido con el art. 607 del CP, ya anotado y aun así reportado).
function articleCarriesVigenciaNote(content, vigenciaNotes) {
  const notes = vigenciaNotes && vigenciaNotes.notes
  if (Array.isArray(notes) && notes.some((n) => n && (n.esAnulacion || n.esCompetencial))) return true
  const t = content || ''
  if (/nota\s+de\s+vigencia/i.test(t)) return true
  if (/declarad[oa]s?\b[\s\S]{0,60}\b(?:inconstitucional|nul)[\s\S]{0,80}\b(?:STC|Sentencia)\s+\d+\/\d{4}/i.test(t)) return true
  return false
}
// v2: ¿el bloque del consolidado BOE RETIENE la anulación? T-169: el BOE la marca de TRES
// formas y v2 solo conocía la primera, así que descartaba hallazgos reales como "artículo
// ya reformado" — el falso verde de la Ley 38/2003 (arts. 7 y 16), servida en 24 temas.
function boeBlockRetainsAnnulment(blockText) {
  const raw = blockText || ''
  const t = raw.replace(/<[^>]+>/g, ' ')
  // (1) inciso tachado + nota inline (art. 126.2 LBRL / STC 103/2013)
  if (/(?:declarad[oa]s?\s+(?:inconstitucional|nul)|inconstitucional(?:idad)?\s+y\s+nul)[\s\S]{0,140}\b(?:Sentencia|STC|del\s+TC|Tribunal\s+Constitucional)\b/i.test(t)) return true
  // (2) nota al pie del bloque: única marca cuando la anulación es INDIRECTA (lo anulado es
  //     la norma modificadora, como el art. 16 de la Ley 38/2003 / STC 206/2013)
  for (const bq of raw.match(/<blockquote>[\s\S]*?<\/blockquote>/gi) || []) {
    for (const p of bq.match(/<p\s+class="(nota[^"]*)"[^>]*>([\s\S]*?)<\/p>/gi) || []) {
      const texto = p.replace(/<[^>]+>/g, ' ')
      if (!/\bse\s+declara|\bdeclarad[oa]s?\b/i.test(texto)) continue
      if (ANNUL_BEFORE.test(texto)) return true
      if (/no\s+(?:es|son|resulta[n]?)\s+conforme[s]?\s+con\s+el\s+orden\s+constitucional\s+de\s+competencias/i.test(texto)) return true
    }
  }
  // (3) apartado sustituido por "(Anulado)" a secas (art. 7.1 a) de la Ley 38/2003 / STC 70/2016)
  if (/\(\s*anulad[oa]s?\s*\)/i.test(t)) return true
  return false
}
// ────────────────────────────────────────────────────────────────────────────

const boeIdFromUrl = (u) => { const m = (u || '').match(/(BOE-A-\d{4}-\d+)/); return m ? m[1] : null }
const normNum = (n) => String(n).replace(/\s+/g, ' ').trim().toLowerCase()

async function fetchAnalisis(boeId) {
  try {
    const r = await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${boeId}/analisis`,
      { headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

// índice → mapa artículo → bloque id (para pedir el bloque del artículo).
//
// T-169: esto tenía su PROPIO regex `art[íi]culo\s+(\d+)`, y por eso el barrido era un
// falso verde en leyes enteras. El Código Civil rotula sus 2.444 bloques como "Art 92"
// —abreviado— así que NO se localizaba ni uno: sin bloque, el script hace `continue` en
// silencio y reporta "0 hallazgos" sin haber comprobado nada. El núcleo compartido
// `mapaBloquesPorArticulo` ya resolvía esto desde T-133 (y también los artículos en letra
// de la LOPJ, T-132, y los sufijos compuestos de la LECrim, T-139): el CLI se lo perdía
// todo por llevar copia propia.
async function fetchArticleBlockMap(boeId) {
  try {
    const r = await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${boeId}/texto/indice`,
      { headers: { Accept: 'application/xml' } })
    if (!r.ok) return null
    const mapa = mapaBloquesPorArticulo(await r.text())
    const map = new Map()
    for (const [num, id] of Object.entries(mapa || {})) map.set(normNum(num), id)
    return map.size ? map : null
  } catch { return null }
}

async function fetchBlockText(boeId, blockId) {
  try {
    const r = await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${boeId}/texto/bloque/${blockId}`,
      { headers: { Accept: 'application/xml' } })
    if (!r.ok) return null
    return await r.text()
  } catch { return null }
}

async function main() {
  const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null }
  const LIMIT = parseInt(arg('--limit') || '0', 10)
  const ONE = arg('--law')
  const EMIT = process.argv.includes('--emit')
  const JSON_OUT = process.argv.includes('--json')
  const V2 = !process.argv.includes('--no-v2') // v2 (default): solo flaguea si el BOE retiene el inciso anulado

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
    const { rows: arts } = await c.query('SELECT article_number, content, vigencia_notes FROM articles WHERE law_id=$1', [l.id])
    const byNum = new Map(arts.map((a) => [normNum(a.article_number), a]))
    // v2: mapa artículo→bloque BOE (para comprobar si el inciso anulado SIGUE en el consolidado)
    const blockMap = V2 ? await fetchArticleBlockMap(boeId) : null
    const blockCache = new Map()
    for (const a of annuls) {
      for (const artNum of a.articles) {
        if (!byNum.has(artNum)) continue // no servimos ese artículo
        const row = byNum.get(artNum)
        if (articleCarriesVigenciaNote(row.content, row.vigencia_notes)) continue // ya marcado
        // v2: solo es REAL si el BOE RETIENE el inciso anulado (nota inline). Si el
        // artículo se reformó (texto limpio) → falsa alarma → NO flaguear.
        if (V2 && blockMap) {
          const bid = blockMap.get(artNum)
          if (!bid) continue // sin bloque localizable → conservador: no flaguea (evita ruido)
          let block = blockCache.get(bid)
          if (block === undefined) { block = await fetchBlockText(boeId, bid); blockCache.set(bid, block) }
          if (!block || !boeBlockRetainsAnnulment(block)) continue // reformado / no retenido → falsa alarma
        }
        findings.push({ law: l.short_name, law_id: l.id, article: artNum, sentencia: a.sentencia, id_norma: a.idNorma, texto: a.texto.slice(0, 220) })
      }
    }
  }

  if (EMIT && findings.length) {
    for (const f of findings) {
      await c.query(
        `INSERT INTO observable_events (source, severity, event_type, endpoint, metadata)
         VALUES ('cli', 'warn', 'article_annulled_unmarked', 'audit-annulled-provisions', $1::jsonb)`,
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
}

// Solo se ejecuta como CLI: al requerirlo (guardarraíl de paridad) no debe abrir la BD.
if (require.main === module) {
  main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
}

// El ESPEJO se exporta para que el guardarraíl de paridad (`__tests__/backend/annulledVigenciaMirror.test.ts`)
// pueda correr esta copia y la de `lib/laws/annulledProvisions.ts` sobre el mismo fixture y
// exigir el mismo veredicto. Sin esto, el espejo solo se podía comprobar leyéndolo — que es
// como se quedó atrás y produjo el falso verde de T-169.
module.exports = { parseAnnulledArticles, extractTcAnnulments, articleCarriesVigenciaNote, boeBlockRetainsAnnulment }
