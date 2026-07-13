#!/usr/bin/env node
/**
 * verify-epigrafe-literality.cjs — Sistema 2: verificación de LITERALIDAD del
 * epígrafe (topics.epigrafe) contra el temario oficial de la convocatoria vigente.
 * Ver docs/runbooks/verificar-epigrafes-scope.md.
 *
 * Parte DETERMINISTA. La comparación literal fina (BD vs oficial) la juzgan
 * agentes entre `dump` y `record` (algunos boletines requieren criterio).
 *
 * Subcomandos:
 *   dump   <position_type>          → fetch programa_url de la convocatoria vigente,
 *                                     hash → convocatorias.programa_last_hash,
 *                                     parsea temario oficial, vuelca {tema, epigrafe_bd, oficial}
 *   record <position_type> <json>   → record_epigrafe_verification por tema
 *   status <position_type>          → estado efectivo (vista) de la oposición
 *
 * Salida dump: /tmp/verify_epigrafe_<position_type>.json
 */
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')

// ── .env.local ──
try {
  const p = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

function db() {
  const url = (process.env.DATABASE_URL || '').split('?')[0]
  if (!url) throw new Error('DATABASE_URL no configurada')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}
const DUMP_DIR = process.env.VERIFY_SCOPE_DIR || '/tmp'
const dumpPath = (pt) => path.join(DUMP_DIR, `verify_epigrafe_${pt}.json`)

// ── convocatoria vigente + programa_url de una oposición ──
async function currentConvocatoria(c, pt) {
  const r = (await c.query(
    `SELECT cv.id, cv.programa_url
     FROM oposiciones o JOIN convocatorias cv ON cv.oposicion_id = o.id AND cv.is_current = true
     WHERE o.slug = replace($1, '_', '-') LIMIT 1`, [pt]
  )).rows[0]
  return r || null
}

// ── fetch + extracción de texto del programa (PDF/HTML) ──
function fetchProgramaText(url) {
  const tmp = path.join(DUMP_DIR, `_prog_dl_${Date.now()}.bin`)
  try {
    execFileSync('curl', ['-sL', '--max-time', '40', '-A', 'Mozilla/5.0 (compatible; VenceBot/1.0)', '-o', tmp, url], { stdio: 'ignore' })
  } catch { return { text: null, how: 'download_error' } }
  if (!fs.existsSync(tmp) || fs.statSync(tmp).size < 200) return { text: null, how: 'download_empty' }
  const head = fs.readFileSync(tmp).subarray(0, 5)
  let text
  if (head.toString('latin1', 0, 4) === '%PDF') {
    try { text = execFileSync('pdftotext', ['-layout', tmp, '-']).toString('utf8') } catch { text = '' }
    try { fs.unlinkSync(tmp) } catch {}
    if (!text || text.length < 200) return { text: null, how: 'pdf_empty' }
    return { text, how: 'pdf' }
  }
  let raw = fs.readFileSync(tmp).toString('utf8'); try { fs.unlinkSync(tmp) } catch {}
  raw = raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  raw = raw.replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ')
  return raw.length > 200 ? { text: raw, how: 'html' } : { text: null, how: 'html_empty' }
}

// ── parseo del temario oficial: "Tema N.- ..." hasta el siguiente ──
function parseTemas(text) {
  const temas = {}
  const markers = [...text.matchAll(/\bTema\s+(\d{1,2})\b/gi)]
  if (markers.length < 3) return temas
  for (let i = 0; i < markers.length; i++) {
    const n = parseInt(markers[i][1], 10)
    const start = markers[i].index + markers[i][0].length
    const end = i + 1 < markers.length ? markers[i + 1].index : Math.min(start + 1200, text.length)
    const body = text.slice(start, end).replace(/\s+/g, ' ').trim().slice(0, 1000)
    if (!temas[n] || body.length > temas[n].length) temas[n] = body
  }
  return temas
}

async function cmdDump(pt) {
  const c = db(); await c.connect()
  try {
    const conv = await currentConvocatoria(c, pt)
    if (!conv) throw new Error(`Sin convocatoria vigente para ${pt}`)
    if (!conv.programa_url) throw new Error(`La convocatoria vigente no tiene programa_url`)
    const { text, how } = fetchProgramaText(conv.programa_url)
    const hash = text ? crypto.createHash('md5').update(text).digest('hex') : null
    // guardar hash del programa en la convocatoria (para la vista _effective)
    if (hash) await c.query(`UPDATE convocatorias SET programa_last_hash=$2, programa_last_checked=now() WHERE id=$1`, [conv.id, hash])
    const official = text ? parseTemas(text) : {}
    const topics = (await c.query(
      `SELECT topic_number, title, epigrafe FROM topics WHERE position_type=$1 AND is_active ORDER BY topic_number`, [pt]
    )).rows
    const out = {
      position_type: pt, convocatoria_id: conv.id, programa_url: conv.programa_url,
      fetch: how, programa_hash: hash, temario_parseado: Object.keys(official).length,
      temas: topics.map(t => ({
        tema: t.topic_number, titulo: t.title, epigrafe_bd: t.epigrafe,
        oficial: official[t.topic_number] || null,
      })),
    }
    fs.writeFileSync(dumpPath(pt), JSON.stringify(out, null, 1))
    console.log(`✅ dump ${pt}: fetch=${how}, temario_parseado=${out.temario_parseado}/${topics.length}, programa_hash=${hash ? hash.slice(0, 8) : 'NULL'} → ${dumpPath(pt)}`)
    if (out.temario_parseado < 3) console.log(`   ⚠️  boletín no parseable (${how}) — la literalidad no se puede verificar automáticamente para esta oposición`)
  } finally { await c.end() }
}

async function cmdRecord(pt, jsonPath) {
  // consensus.json: { "<tema>": { "verdict": "literal"|"drift"|"provisional", "note": "...",
  //                                source_url?: "...", source_notes?: "...", "findings": {...} } }
  // source_url = URL exacta de la fuente oficial de ese epígrafe (para re-verificación directa);
  // source_notes = comentario libre del sourcing. Se guardan en topic_epigrafe_verification.
  const consensus = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const c = db(); await c.connect()
  try {
    const conv = await currentConvocatoria(c, pt)
    const programaHash = (await c.query(`SELECT programa_last_hash h FROM convocatorias WHERE id=$1`, [conv.id])).rows[0]?.h || null
    const topics = (await c.query(`SELECT id, topic_number FROM topics WHERE position_type=$1 AND is_active`, [pt])).rows
    const byN = {}; topics.forEach(t => byN[t.topic_number] = t.id)
    let ok = 0, skipped = []
    for (const [n, v] of Object.entries(consensus)) {
      const tid = byN[n]
      if (!tid) { skipped.push(n); continue }
      if (!['literal', 'drift', 'provisional'].includes(v.verdict)) { skipped.push(`${n}(verdict)`); continue }
      const findings = JSON.stringify(v.findings || { note: v.note || null })
      await c.query(`SELECT record_epigrafe_verification($1,$2,$3,$4,$5::jsonb,$6)`,
        [tid, v.verdict, conv.id, programaHash, findings, v.verified_by || 'multi_agent'])
      // Provenance de la fuente exacta (para re-verificación directa). Follow-up UPDATE
      // para no tocar la firma de la función SQL. Solo si el consenso la aporta.
      if (v.source_url || v.source_notes) {
        await c.query(`UPDATE topic_epigrafe_verification SET source_url=$2, source_notes=$3 WHERE topic_id=$1`,
          [tid, v.source_url || null, v.source_notes || null])
      }
      ok++
    }
    console.log(`✅ registrados ${ok} temas${skipped.length ? ` | saltados: ${skipped.join(', ')}` : ''}`)
    await printStatus(c, pt)
  } finally { await c.end() }
}

async function printStatus(c, pt) {
  const st = (await c.query(
    `SELECT effective_state, count(*) n FROM topic_epigrafe_verification_effective
     WHERE position_type=$1 GROUP BY 1 ORDER BY 1`, [pt]
  )).rows
  console.log(`\n=== epígrafe (S2) — estado efectivo ${pt} ===`)
  st.forEach(r => console.log(`  ${r.effective_state}: ${r.n}`))
}

async function cmdStatus(pt) {
  const c = db(); await c.connect()
  try { await printStatus(c, pt) } finally { await c.end() }
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2)
  try {
    if (cmd === 'dump') await cmdDump(args[0])
    else if (cmd === 'record') await cmdRecord(args[0], args[1])
    else if (cmd === 'status') await cmdStatus(args[0])
    else { console.log('Uso: node scripts/verify-epigrafe-literality.cjs <dump|record|status> <position_type> [json]'); process.exit(1) }
  } catch (e) { console.error('❌', e.message); process.exit(1) }
}
main()
