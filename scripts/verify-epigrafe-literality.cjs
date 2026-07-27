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
 *   apply  <position_type> <json> [--apply]
 *          REESCRIBE los epígrafes al LITERAL oficial (los 4 campos de display a la
 *          vez), registra la verificación como `literal` con su fuente y recachea.
 *          DRY-RUN por defecto: sin --apply enseña el diff y no escribe nada.
 *          Guarda pura en lib/temario/epigrafeApply.js — por esta puerta NO puede
 *          entrar un epígrafe que no esté en el boletín.
 *
 * Salida dump: /tmp/verify_epigrafe_<position_type>.json
 */
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const { canonicalizeBoletinUrl } = require(path.join(__dirname, '..', 'lib', 'convocatoria', 'canonicalizeBoletinUrl.cjs'))
const { esTemarioRefiningDoc } = require(path.join(__dirname, '..', 'lib', 'temario', 'temarioRefiningDoc.js'))
const { validarPlanEpigrafe } = require(path.join(__dirname, '..', 'lib', 'temario', 'epigrafeApply.js'))
const { recache } = require(path.join(__dirname, 'lib', 'temario-recache.cjs'))

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

    // ── FORCING FUNCTION: el programa puede estar repartido en base + comunicados que lo afinan ──
    // Surface los COMUNICADOS/notas de esta convocatoria que contienen temario (señal fuerte:
    // >=5 "Tema N" o anexo ofimática) para OBLIGAR a verificar contra ellos, no solo el programa_url.
    // Caso raíz CARM (ofimática en un comunicado 2025, no en el programa base 2016). Se leen del hub
    // (cero re-descarga). Ver lib/temario/temarioRefiningDoc.js + docs/runbooks/verificar-epigrafes-scope.md.
    const docs = (await c.query(
      `SELECT tipo, url, extracted_text FROM convocatoria_documentos
       WHERE convocatoria_id=$1 AND extracted_text IS NOT NULL AND url IS DISTINCT FROM $2`,
      [conv.id, conv.programa_url])).rows
    const comunicados = docs.filter(d => esTemarioRefiningDoc(d.extracted_text))
    if (comunicados.length) {
      console.log(`\n   🧩 ${comunicados.length} DOCUMENTO(S) de la convocatoria contienen temario que puede AFINAR el programa base — VERIFICA los epígrafes contra ELLOS también (no solo el programa_url):`)
      for (const d of comunicados) console.log(`      [${d.tipo}] ${d.url}`)
      console.log(`      (leídos del hub; texto en convocatoria_documentos.extracted_text — cero re-descarga)`)
    }
  } finally { await c.end() }
}


/**
 * Clona un documento oficial en el HUB de provenance CON SU TEXTO.
 *
 * El texto no es un extra: es lo que hace que el documento sea OBSERVABLE. El aviso
 * de "documentos que AFINAN el programa" (`esTemarioRefiningDoc`) filtra por
 * `extracted_text IS NOT NULL`, así que un documento clonado sin texto es, a efectos
 * de vigilancia, un documento que no está. Fallo real medido el 27/07/2026: la Orden
 * PRE/12/2026 —que modifica el programa entero del Cuerpo General Auxiliar de
 * Cantabria— estaba clonada… y vacía, así que el `dump` no podía avisar de ella y la
 * verificación siguió comparando contra el programa superado. Lo detectó una usuaria.
 *
 * Nunca PISA un texto existente: solo rellena el hueco (el clon anterior puede venir de
 * un extractor mejor, p.ej. `detect-notas` con su fetcher headless).
 */
async function ensureDocConTexto(c, convId, url, { tipo = 'convocatoria', titulo = null, notas = null, fuente = 'epigrafe-verify' } = {}) {
  const { docKey, canonicalUrl } = canonicalizeBoletinUrl(url)
  if (!docKey) return null
  const { text } = fetchProgramaText(canonicalUrl || url)
  const hash = text ? crypto.createHash('sha256').update(text).digest('hex') : null
  const r = await c.query(
    `SELECT ensure_convocatoria_documento($1,$2,$3,$4,$5,$6,$7,$8) AS id`,
    [convId, docKey, canonicalUrl, hash, tipo, titulo || notas, text, fuente])
  const id = r.rows[0].id
  if (text) {
    await c.query(
      `UPDATE convocatoria_documentos SET extracted_text=$2, content_hash=COALESCE(content_hash,$3)
       WHERE id=$1 AND extracted_text IS NULL`, [id, text, hash])
  } else {
    console.log(`   ⚠️  documento clonado SIN texto (no se pudo extraer): ${canonicalUrl} — queda ciego para el aviso de temario`)
  }
  return id
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
    let ok = 0, skipped = [], linked = 0
    const docCache = {}  // docKey -> documento_id (una fila por documento canónico, reutilizada por todos los temas)
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
      // Enlazar al HUB de provenance: canonicaliza la URL → ensure_convocatoria_documento
      // (idempotente, dedup por doc_key) → fija source_documento_id. El source_url queda como
      // espejo. Ver docs/maintenance/provenance-convocatorias.md.
      if (v.source_url) {
        const { docKey, canonicalUrl } = canonicalizeBoletinUrl(v.source_url)
        if (docKey) {
          if (!(docKey in docCache)) {
            // CON TEXTO: un documento clonado vacío es invisible para el aviso de
            // "documentos que afinan el programa". Ver ensureDocConTexto.
            docCache[docKey] = await ensureDocConTexto(c, conv.id, v.source_url, { notas: v.source_notes || null })
          }
          await c.query(`UPDATE topic_epigrafe_verification SET source_documento_id=$2 WHERE topic_id=$1`, [tid, docCache[docKey]])
          linked++
        }
      }
      ok++
    }
    console.log(`✅ registrados ${ok} temas · enlazados al hub de provenance ${linked}${skipped.length ? ` | saltados: ${skipped.join(', ')}` : ''}`)
    await printStatus(c, pt)
  } finally { await c.end() }
}

async function cmdApply(pt, jsonPath, opts) {
  // plan: { "<tema>": { title, epigrafe, description, descripcion_corta,
  //                     oficial?, oficial_manual?, source_url?, source_notes? } }
  const plan = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

  // ── Textos OFICIALES contra los que se exige literalidad ───────────────────
  // Preferencia 1: el `oficial` que parseó `dump` del boletín (nadie lo escribe a mano).
  // Preferencia 2: `oficial` del plan, SOLO si viene marcado `oficial_manual` + `source_url`.
  //   Los ~30% de boletines que no parsean necesitan una vía humana; que sea explícita y
  //   quede anotada es la diferencia entre una excepción trazable y un agujero.
  const oficiales = {}
  const manuales = []
  try {
    const dump = JSON.parse(fs.readFileSync(dumpPath(pt), 'utf8'))
    for (const t of (dump.temas || [])) if (t.oficial) oficiales[String(t.tema)] = t.oficial
  } catch {}
  for (const [tema, v] of Object.entries(plan)) {
    if (oficiales[tema]) continue
    if (v.oficial && v.oficial_manual && v.source_url) { oficiales[tema] = v.oficial; manuales.push(tema) }
  }

  const { errores, ok } = validarPlanEpigrafe(plan, oficiales)
  if (errores.length) {
    console.error(`\n❌ GUARDA: ${errores.length} problema(s) — NO se escribe nada:`)
    for (const e of errores) console.error(`   T${e.tema} [${e.code}] ${e.detail}`)
    process.exit(2)
  }
  if (manuales.length) {
    console.log(`\n⚠️  literalidad acreditada a MANO en T${manuales.join(', T')} (boletín no parseable) — la fuente queda registrada en source_url`)
  }

  const c = db(); await c.connect()
  try {
    const conv = await currentConvocatoria(c, pt)
    const programaHash = (await c.query(`SELECT programa_last_hash h FROM convocatorias WHERE id=$1`, [conv.id])).rows[0]?.h || null
    const rows = (await c.query(
      `SELECT id, topic_number, title, epigrafe, description, descripcion_corta
       FROM topics WHERE position_type=$1 AND is_active AND topic_number = ANY($2)`,
      [pt, ok.map(Number)])).rows
    const byN = {}; rows.forEach((r) => byN[String(r.topic_number)] = r)

    const faltan = ok.filter((t) => !byN[t])
    if (faltan.length) { console.error(`❌ temas no encontrados en ${pt}: ${faltan.join(', ')}`); process.exit(2) }

    console.log(`\n=== APPLY epígrafe ${pt} ${opts.apply ? '' : '(DRY-RUN)'} — ${ok.length} temas ===`)
    let cambian = 0
    for (const t of ok) {
      const cur = byN[t], nue = plan[t]
      const diffs = ['title', 'epigrafe', 'description', 'descripcion_corta'].filter((f) => (cur[f] || '') !== nue[f])
      if (!diffs.length) { console.log(`  T${t}: sin cambios`); continue }
      cambian++
      console.log(`  T${t}: cambian ${diffs.join(', ')}`)
      for (const f of diffs) {
        console.log(`     ${f}\n       - ${String(cur[f] || '').slice(0, 160)}\n       + ${String(nue[f]).slice(0, 160)}`)
      }
    }
    if (!opts.apply) { console.log(`\n(dry-run: nada escrito — repite con --apply)`); return }
    if (!cambian) { console.log('\nnada que escribir'); return }

    await c.query('BEGIN')
    for (const t of ok) {
      const nue = plan[t]
      await c.query(
        `UPDATE topics SET title=$2, epigrafe=$3, description=$4, descripcion_corta=$5 WHERE id=$1`,
        [byN[t].id, nue.title, nue.epigrafe, nue.description, nue.descripcion_corta])
    }
    await c.query('COMMIT')
    console.log(`✅ COMMIT topics (${ok.length} temas, los 4 campos)`)

    // registrar la verificación: ahora el epígrafe ES el literal oficial
    const docCacheApply = {}
    for (const t of ok) {
      const v = plan[t]
      await c.query(`SELECT record_epigrafe_verification($1,$2,$3,$4,$5::jsonb,$6)`,
        [byN[t].id, 'literal', conv.id, programaHash,
         JSON.stringify({ note: 'verify:epigrafe apply — reescrito al literal oficial', oficial_manual: !!v.oficial_manual }),
         v.verified_by || 'epigrafe_apply'])
      if (v.source_url || v.source_notes) {
        await c.query(`UPDATE topic_epigrafe_verification SET source_url=$2, source_notes=$3 WHERE topic_id=$1`,
          [byN[t].id, v.source_url || null, v.source_notes || null])
      }
      if (v.source_url) {
        if (!(v.source_url in docCacheApply)) {
          docCacheApply[v.source_url] = await ensureDocConTexto(c, conv.id, v.source_url, { notas: v.source_notes || null })
        }
        const did = docCacheApply[v.source_url]
        if (did) await c.query(`UPDATE topic_epigrafe_verification SET source_documento_id=$2 WHERE topic_id=$1`, [byN[t].id, did])
      }
    }
    console.log(`✅ record: ${ok.length} temas → literal`)
  } finally { await c.end() }

  console.log('→ recache…')
  const rc = await recache(pt, ok.map(Number), db)
  console.log(`   MV:${rc.mv ? '✅' : '❌'} · rutas purgadas:${rc.purged}/${ok.length} · revalidate-temario:${rc.temario ? '✅' : '—'}`)

  const c2 = db(); await c2.connect()
  try { await printStatus(c2, pt) } finally { await c2.end() }
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
    else if (cmd === 'apply') await cmdApply(args[0], args[1], { apply: args.includes('--apply') })
    else if (cmd === 'status') await cmdStatus(args[0])
    else { console.log('Uso: node scripts/verify-epigrafe-literality.cjs <dump|record|apply|status> <position_type> [json] [--apply]'); process.exit(1) }
  } catch (e) { console.error('❌', e.message); process.exit(1) }
}
// Solo como CLI: al requerirlo como módulo (backfills, tests) NO debe ejecutarse.
if (require.main === module) main()


module.exports = { ensureDocConTexto }
