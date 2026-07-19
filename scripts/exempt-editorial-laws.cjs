#!/usr/bin/env node
// scripts/exempt-editorial-laws.cjs — acelerador de la Capa 3 (backfill completitud)
//
// Marca honestamente como `no_consolidated_text` (verificado-por-clasificación,
// NO falso verde) las leyes del temario que NO son un articulado: planes,
// estrategias, protocolos, manuales, instrucciones económicas, etc. Para esos
// documentos "faltan artículos" es la pregunta equivocada.
//
// PREDICADO ENDURECIDO POR SIMULACRO (19/07): exige EVIDENCIA POSITIVA de
// no-articulado — fetch OK + <3 artículos extraídos + nombre de tipo editorial +
// NO instrumento legal (Decreto/Reglamento/Ley/Estatuto/Orden/Convenio). Un fetch
// fallido o un Decreto que no parsea NO se exenta (→ headless/manual): exentar sin
// evidencia sería recrear el falso verde. El drill cazó justo eso (Decreto 80/2005
// Murcia salía "0 arts" por fetch fallido, no por ser editorial).
//
//   node scripts/exempt-editorial-laws.cjs            # DRY (propone, no escribe)
//   node scripts/exempt-editorial-laws.cjs --apply    # aplica
const fs = require('fs')
const { execSync } = require('child_process')
const pg = require('/home/manuel/Documentos/github/vence/backend/node_modules/postgres')
const getUrl = () => process.env.DATABASE_URL || fs.readFileSync(require('path').join(__dirname, '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const APPLY = process.argv.includes('--apply')

const ART_RE = /Artículo\.?\s+(\d+)\.?\s*([Bb]is|[Tt]er)?\.?\s*[–.-]/g
const countArticles = (t) => { const n = new Set(); if (!t) return 0; ART_RE.lastIndex = 0; let m; while ((m = ART_RE.exec(t))) n.add(m[1]); return n.size }
function fetchText(u) {
  try {
    if (/\.pdf(\?|$)/i.test(u)) {
      execSync(`curl -skL --max-time 30 "${u}" -o /tmp/exed.pdf`, { stdio: 'ignore' })
      execSync('pdftotext /tmp/exed.pdf /tmp/exed.txt 2>/dev/null', { stdio: 'ignore' })
      return fs.existsSync('/tmp/exed.txt') ? fs.readFileSync('/tmp/exed.txt', 'utf8') : ''
    }
    return execSync(`curl -skL --max-time 30 -A Mozilla/5.0 "${u}"`, { maxBuffer: 64e6 }).toString().replace(/<[^>]+>/g, ' ')
  } catch { return '' }
}
const INSTRUMENTO = /\b(decreto|reglamento|\bley\b|estatuto|real decreto|\borden\b|convenio)\b/i
const EDITORIAL = /plan|estrategia|protocolo|manual|instrucci[oó]n(es)? econ|carta de servicio|competencia digital|herramient/i
const NONART_NAME = /plan|estrategia|protocolo|manual|instrucci|competencia digital|herramient/i

;(async () => {
  const s = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })
  try {
    const all = await s`
      SELECT e.law_id, e.short_name, l.boe_url, l.name FROM law_verification_effective e
      JOIN laws l ON l.id = e.law_id
      WHERE e.serving_live AND e.effective_state='false_green'`
    const cands = all.filter(r => (NONART_NAME.test(r.short_name) || NONART_NAME.test(r.name || '')) && r.boe_url)
    let applied = 0, excluded = 0
    for (const c of cands) {
      const nm = c.short_name + ' ' + (c.name || '')
      const txt = fetchText(c.boe_url)
      const arts = countArticles(txt)
      const safe = txt.length >= 1000 && arts < 3 && !INSTRUMENTO.test(nm) && EDITORIAL.test(nm)
      if (!safe) {
        excluded++
        console.log(`  ⛔ ${c.short_name}  [${txt.length < 1000 ? 'fetch vacío' : arts >= 3 ? arts + ' arts' : INSTRUMENTO.test(nm) ? 'instrumento legal' : 'tipo no editorial'} → headless/manual]`)
        continue
      }
      if (APPLY) {
        const summary = { is_ok: true, no_consolidated_text: true, boe_count: 0, db_count: 0, missing_in_db: 0,
          verified_at: new Date().toISOString(), source: c.boe_url, via: 'editorial_exemption',
          message: 'Documento editorial sin articulado (fetch OK, 0 artículos); verificado por clasificación.' }
        await s`UPDATE laws SET verification_status='actualizada', last_verification_summary=${s.json(summary)} WHERE id=${c.law_id}`
        await s`INSERT INTO observable_events (id,ts,source,severity,event_type,metadata,created_at)
          VALUES (gen_random_uuid(),now(),'fargate','info','law_source_editorial_exempt',${s.json({ law_id: c.law_id, short: c.short_name })},now())`
      }
      applied++
      console.log(`  ✅ ${APPLY ? 'exentada' : 'exentaría'}: ${c.short_name}`)
    }
    console.log(`\n  ${APPLY ? 'aplicadas' : 'propuestas'}: ${applied} | excluidas (a headless/manual): ${excluded}`)
    if (!APPLY) console.log('  (DRY — usa --apply para escribir)')
    await s.end()
  } catch (e) { console.error('ERROR:', e.message); await s.end(); process.exit(1) }
})()
