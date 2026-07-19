#!/usr/bin/env node
// scripts/verify-law-source.cjs  — CAPA 3 del sistema de completitud de leyes
//
// Verifica la COMPLETITUD de una ley (o lote) contra su FUENTE oficial, para
// fuentes que el monitor BOE NO cubre (boletines autonómicos BOCYL/DOGV/DOG/
// BOJA/BOCM… y PDFs). Extrae el inventario de artículos de la fuente, lo compara
// con los artículos en BD, y escribe evidencia REAL vía record_law_source_
// verification() (migración 20260718). Emite observabilidad a observable_events.
//
// NUNCA falsea: si la fuente no parsea (heterogeneidad de boletines) NO inventa un
// veredicto — lo deja never_verified y emite 'law_source_unparseable' (honesto).
//
//   node scripts/verify-law-source.cjs --law <uuid>          # una ley
//   node scripts/verify-law-source.cjs --all-regional [--limit N]  # lote regional con fuente
//   node scripts/verify-law-source.cjs --law <uuid> --dry    # sin escribir
const fs = require('fs')
const { execSync } = require('child_process')
const pg = require('/home/manuel/Documentos/github/vence/backend/node_modules/postgres')
function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  return fs.readFileSync(require('path').join(__dirname, '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
}
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null }
const DRY = process.argv.includes('--dry')

// ── Extractor genérico de inventario de artículos (mismo criterio que el clon BOCYL) ──
// "Artículo 29.–" | "Artículo. 43.–" | "Artículo. 43. Bis.–" | "Artículo 63 bis.–" | "Artículo 47. "
const ART_RE = /Artículo\.?\s+(\d+)\.?\s*([Bb]is|[Tt]er)?\.?\s*[–.-]/g
function extractArticleNumbers(text) {
  const nums = new Set()
  let m
  while ((m = ART_RE.exec(text)) !== null) {
    nums.add((m[1] + (m[2] ? ' ' + m[2].toLowerCase() : '')).trim())
  }
  return nums
}
const normNum = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')

async function fetchSourceText(url) {
  // PDF → pdftotext; HTML → curl + strip de tags. Timeout y -k (algunos boletines TLS roto).
  const tmp = `/tmp/lawsrc_${Date.now()}`
  try {
    const isPdf = /\.pdf(\?|$)/i.test(url)
    if (isPdf) {
      execSync(`curl -skL --max-time 45 "${url}" -o ${tmp}.pdf`, { stdio: 'ignore' })
      if (!fs.existsSync(`${tmp}.pdf`) || fs.statSync(`${tmp}.pdf`).size < 1000) return null
      execSync(`pdftotext ${tmp}.pdf ${tmp}.txt 2>/dev/null`, { stdio: 'ignore' })
      return fs.existsSync(`${tmp}.txt`) ? fs.readFileSync(`${tmp}.txt`, 'utf8') : null
    }
    const html = execSync(`curl -skL --max-time 45 -A "Mozilla/5.0" "${url}"`, { maxBuffer: 64 * 1024 * 1024 }).toString()
    // strip scripts/styles/tags
    return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&aacute;/g, 'á').replace(/&[a-z]+;/g, ' ')
  } catch { return null }
  finally { try { fs.rmSync(`${tmp}.pdf`, { force: true }); fs.rmSync(`${tmp}.txt`, { force: true }) } catch {} }
}

async function emit(s, event_type, severity, meta) {
  if (DRY) return
  await s`INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
    VALUES (gen_random_uuid(), now(), 'fargate', ${severity}, ${event_type}, ${s.json(meta)}, now())`
}

async function verifyLaw(s, law) {
  const short = law.short_name || law.name
  if (!law.boe_url || !law.boe_url.trim()) {
    await emit(s, 'law_source_no_url', 'warn', { law_id: law.id, short }); return { st: 'no_source', short }
  }
  const text = await fetchSourceText(law.boe_url)
  if (!text || text.length < 500) {
    await emit(s, 'law_source_unparseable', 'warn', { law_id: law.id, short, reason: 'fetch/empty', url: law.boe_url })
    return { st: 'unparseable', short }
  }
  const srcNums = extractArticleNumbers(text)
  if (srcNums.size < 3) {
    await emit(s, 'law_source_unparseable', 'warn', { law_id: law.id, short, reason: 'few_articles', extracted: srcNums.size })
    return { st: 'unparseable', short }
  }
  const dbRows = await s`SELECT article_number FROM articles WHERE law_id=${law.id} AND coalesce(is_active,true)`
  const dbNums = new Set(dbRows.map(r => normNum(r.article_number)))
  const missing = [...srcNums].filter(n => !dbNums.has(normNum(n)))
  const srcCount = srcNums.size, dbCount = dbNums.size
  const verdict = missing.length > 0 ? 'incomplete' : 'verified'
  const sourceHash = require('crypto').createHash('sha256').update(text).digest('hex').slice(0, 32)
  const findings = { missing: missing.slice(0, 40), missing_count: missing.length, src_count: srcCount, db_count: dbCount }
  if (!DRY) {
    await s`SELECT record_law_source_verification(${law.id}, ${verdict}, ${law.boe_url}, ${sourceHash},
      ${srcCount}, ${dbCount}, ${missing.length}, ${s.json(findings)}, 'capa3_extractor', ${'run_' + new Date().toISOString().slice(0, 10)})`
    // dual-write al campo legacy que leen la vista law_verification_effective y el detector Capa 1
    const summary = { is_ok: verdict === 'verified', boe_count: srcCount, db_count: dbCount, missing_in_db: missing.length,
      content_mismatch: 0, title_mismatch: 0, matching: dbCount, verified_at: new Date().toISOString(), source: law.boe_url, via: 'capa3_extractor' }
    await s`UPDATE laws SET verification_status='actualizada', last_verification_summary=${s.json(summary)} WHERE id=${law.id}`
    await emit(s, verdict === 'verified' ? 'law_source_verified' : 'law_source_incomplete',
      verdict === 'verified' ? 'info' : 'warn', { law_id: law.id, short, src: srcCount, db: dbCount, missing: missing.length })
  }
  return { st: verdict, short, src: srcCount, db: dbCount, missing: missing.length }
}

;(async () => {
  const s = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })
  try {
    let laws
    if (arg('--law')) laws = await s`SELECT id, short_name, name, boe_url FROM laws WHERE id=${arg('--law')}`
    else if (process.argv.includes('--all-regional')) {
      const lim = Number(arg('--limit') || 200)
      laws = await s`
        SELECT l.id, l.short_name, l.name, l.boe_url FROM laws l
        JOIN law_verification_effective e ON e.law_id=l.id
        WHERE e.serving_live AND e.effective_state<>'verified'
          AND l.boe_url IS NOT NULL AND btrim(l.boe_url)<>'' AND l.boe_url NOT ILIKE '%boe.es%'
          AND NOT coalesce(l.is_virtual,false)
        ORDER BY l.short_name LIMIT ${lim}`
    } else { console.log('Uso: --law <uuid> | --all-regional [--limit N] [--dry]'); await s.end(); return }

    console.log(`Verificando ${laws.length} ley(es)${DRY ? ' (DRY)' : ''}...\n`)
    const tally = {}
    for (const law of laws) {
      const r = await verifyLaw(s, law)
      tally[r.st] = (tally[r.st] || 0) + 1
      const extra = r.st === 'incomplete' ? ` (src ${r.src} / db ${r.db} → faltan ${r.missing})` : r.st === 'verified' ? ` (${r.src} arts ✓)` : ''
      console.log(`  [${r.st}] ${r.short}${extra}`)
    }
    console.log('\n== resumen ==')
    for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`)
    await s.end()
  } catch (e) { console.error('ERROR:', e.message); await s.end(); process.exit(1) }
})()
