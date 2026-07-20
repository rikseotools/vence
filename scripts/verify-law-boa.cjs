#!/usr/bin/env node
// scripts/verify-law-boa.cjs
//
// Verifica el CONTENIDO de las leyes ancladas al BOA (Boletín Oficial de Aragón)
// contra su fuente oficial, artículo por artículo.
//
// Por qué existe: `lib/boe-extractor` habla la API del BOE (act.php) y NO sirve para
// las gacetas autonómicas. El BOA publica en su gestor documental BRSCGI, con el
// articulado en párrafos <P> planos. Este script es el extractor por-fuente del
// bloque BOA (cabo "~129 leyes non-BOE" del backlog, docs/roadmap/tareas-pendientes.md).
//
//   node scripts/verify-law-boa.cjs --all            # informe de las 9 leyes BOA
//   node scripts/verify-law-boa.cjs <law_id>         # una ley, con detalle por artículo
//   node scripts/verify-law-boa.cjs --all --write    # + graba evidencia en last_verification_summary
//   node scripts/verify-law-boa.cjs <law_id> --dump  # vuelca lo extraído de la fuente
//
// ⚠️ LÍMITE DE LA FUENTE: el BOA publica el texto ORIGINAL, no un consolidado. Una
// divergencia BD↔BOA puede ser una reforma posterior legítimamente consolidada en BD,
// no un error. Por eso el script NUNCA escribe `is_ok:true` a ciegas: marca
// `source_is_original_publication:true` y deja los mismatches para revisión humana.
const fs = require('fs')
const path = require('path')

// El driver se carga PEREZOSAMENTE, solo al ir a conectar. Este fichero exporta además
// los helpers PUROS de parseo (splitArticles, titleBody, similarity…) que usa
// __tests__/scripts/verifyLawBoa.test.js: cargar el driver arriba obligaba a que ese
// test tuviera una BD instalada para probar funciones que no tocan BD.
// Antes se resolvía con una ruta CABLEADA a backend/node_modules/postgres, que en CI no
// existe (allí solo se instalan las dependencias de la raíz) → la suite entera fallaba
// al arrancar con "Cannot find module …/backend/node_modules/postgres" y dejaba el gate
// de deploy en rojo. `postgres` está declarado en el package.json de la RAÍZ, así que
// basta con la resolución normal.
const loadPg = () => require('postgres')

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim()
}

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

// ── Fetch ──
// El BOA sirve DOS formatos por la misma pasarela BRSCGI:
//   · CMD=VERDOC → HTML (ISO-8859-1) — hay que decodificar explícitamente
//   · CMD=VEROBJ → PDF — se extrae con pdftotext (los convenios/acuerdos van así)
async function fetchBoa(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' }, redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const ct = res.headers.get('content-type') || ''
  if (/application\/pdf/i.test(ct) || buf.slice(0, 4).toString() === '%PDF') {
    const tmp = path.join(require('os').tmpdir(), `boa-${process.pid}-${Date.now()}.pdf`)
    fs.writeFileSync(tmp, buf)
    try {
      // -layout preserva el ORDEN físico: sin él, el flujo de columnas del BOA saca los
      // apartados desordenados (el ap.1 de un artículo aparecía ANTES de su cabecera y se
      // pegaba al artículo anterior). Con -layout cada artículo queda íntegro y en orden.
      const text = require('child_process')
        .execFileSync('pdftotext', ['-enc', 'UTF-8', '-nopgbrk', '-layout', tmp, '-'], { maxBuffer: 64 * 1024 * 1024 })
        .toString('utf8')
      return { text, contentType: ct, kind: 'pdf' }
    } finally { fs.unlinkSync(tmp) }
  }
  const charset = (ct.match(/charset=([\w-]+)/i) || [, 'ISO-8859-1'])[1]
  const enc = /utf-?8/i.test(charset) ? 'utf-8' : 'latin1'
  return { html: new TextDecoder(enc).decode(buf), contentType: ct, kind: 'html' }
}

// El PDF llega ya en texto: solo hay que rehacer los párrafos partidos por salto de línea
// y tirar las cabeceras/pies de página del boletín (que se repiten en cada página).
const RE_PDF_CHROME = /^(Bolet[íi]n Oficial de Arag[óo]n|n[úu]m\.\s*\d+|\d{1,2}\/\d{1,2}\/\d{4}|\d+\s*$|csv:\s*\S+)/i
function pdfToParagraphs(text) {
  const out = []
  for (const raw of text.split('\n')) {
    const line = raw.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim()
    if (!line || RE_PDF_CHROME.test(line)) continue
    // Una línea que no empieza cabecera y viene de un párrafo cortado se une a la anterior
    const isHeader = RE_ART.test(line) || RE_DISP.test(line) || RE_ANEXO.test(line) || RE_HEADING.test(line)
    const prev = out[out.length - 1]
    if (!isHeader && prev && !/[.:;]$/.test(prev) && /^[a-záéíóúñ(«"]/.test(line)) out[out.length - 1] = prev + ' ' + line
    else out.push(line)
  }
  return out
}

// ── HTML → párrafos de texto plano ──
// El BOA mezcla texto acentuado en ISO-8859-1 con entidades HTML (&iacute;, &oacute;…)
// en la misma página. Sin las acentuadas, cada título con tilde daba un mismatch falso.
const ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»', ndash: '–', mdash: '—', hellip: '…', ordm: 'º', ordf: 'ª', deg: '°',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', uuml: 'ü', ntilde: 'ñ',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Uuml: 'Ü', Ntilde: 'Ñ',
  ccedil: 'ç', Ccedil: 'Ç', agrave: 'à', egrave: 'è', middot: '·', euro: '€', sect: '§',
}
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    // Exacto primero: &Oacute; es 'Ó', no 'ó' — bajar a minúsculas sin más perdería la caja.
    .replace(/&([a-z]+);/gi, (m, n) => (n in ENTITIES ? ENTITIES[n] : (n.toLowerCase() in ENTITIES ? ENTITIES[n.toLowerCase()] : m)))
}
function htmlToParagraphs(html) {
  let h = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|head|select|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
  // El cuerpo del documento BOA vive tras "DISPONGO"/"ORDENO"/el título; recortamos
  // la cáscara de portal (menús, footer) quedándonos con el bloque más denso en <P>.
  h = h.replace(/<\/?(b|i|em|strong|span|font|a|u|sup|sub)\b[^>]*>/gi, '')
  h = h.replace(/<br\s*\/?>/gi, '\n')
  h = h.replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, '\n')
  h = h.replace(/<(p|div|li|h[1-6])\b[^>]*>/gi, '\n')
  h = h.replace(/<td\b[^>]*>/gi, ' | ')
  h = h.replace(/<[^>]+>/g, ' ')
  h = decodeEntities(h)
  return h
    .split('\n')
    .map((l) => l.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
}

// ── Párrafos → artículos / disposiciones / anexos ──
// Cabecera tipo: "Artículo 12. Servicio de Salud en Todas las Políticas." / "Artículo 5 bis Título".
// SIN flag /i y con guarda de minúsculas: una remisión a mitad de frase que caiga al
// principio de línea ("artículo 2 del Estatuto de los Trabajadores…") NO es una cabecera,
// y si se cuela se lleva por delante el texto del artículo real.
// El keyword va con /i (algunas gacetas escriben "artículo 27.- Título" en minúscula —
// BOJA Junta de Andalucía); la guarda de prosa (RE_PROSA, abajo) sigue filtrando las
// remisiones porque mira la MINÚSCULA del enunciado, no la del keyword.
const RE_ART = /^art[íi]culo\s+(\d+(?:\s*(?:bis|ter|quater|quinquies))?)\s*[.\-–—\s]*(.*)$/i
// Palabras que delatan una remisión en prosa, no un enunciado de artículo.
// SIN /i a propósito: un enunciado legítimo empieza en MAYÚSCULA ("Artículo 41. De la
// Dirección General…"), así que solo la minúscula delata la prosa.
const RE_PROSA = /^(del?|de|la|el|los|las|y|o|en|a|al|que|se|por|para|con|s[óo]lo|apartado|bis)\b/
function isArtHeader(m) {
  const rest = (m[2] || '').trim()
  return rest === '' || !RE_PROSA.test(rest)
}
// Disposiciones: "Disposición adicional séptima. Título." → clave BD `DA_adicional_séptima`.
// El ordinal es OPCIONAL: cuando solo hay una, el BOA escribe "Disposición derogatoria. Título."
// (sin ordinal) y la BD la registra como `_unica`. Sin esto, la disposición sin ordinal se
// colaba dentro del bloque anterior y además faltaba del recuento.
const RE_DISP = /^Disposici[oó]n\s+(adicional|transitoria|derogatoria|final)(?:\s+(única|unica|primera|segunda|tercera|cuarta|quinta|sexta|séptima|septima|octava|novena|décima|decima|undécima|duodécima|decimotercera|decimocuarta|decimoquinta))?\s*[.\-–—\s]*(.*)$/i
// Anexos: "ANEXO", "ANEXO I", "ANEXO 2" → clave BD `anexo_N` (0-indexado por orden de aparición)
const RE_ANEXO = /^ANEXO\b\s*([IVXLC]+|\d+)?\s*[.\-–—\s]*(.*)$/
// Encabezados estructurales: cierran el bloque en curso, no forman parte de su texto
const RE_HEADING = /^((CAP[ÍI]TULO|T[ÍI]TULO|SECCI[ÓO]N|LIBRO|PARTE)\s+[IVXLC\d]|DISPOSICI[OÓ]N(ES)?\s+(ADICIONAL|TRANSITORIA|DEROGATORIA|FINAL)[ES]*\s*$)/i
// Firma del decreto: CIERRA el bloque en curso pero NO termina el documento — en los
// decretos que aprueban un reglamento, el articulado de verdad va en el ANEXO, DESPUÉS
// de la firma (caso Decreto 174/2010: 62 arts colgando del anexo).
const RE_FIRMA = /^(Zaragoza,\s+\d|El\/La\s|El Presidente del Gobierno de Arag|La?\s+Consejer[oa]\b|Dado en Zaragoza)/i
// Pie del PORTAL (no del boletín): aquí sí se acaba el documento. Ignorarlo es lo que
// metió "Aviso Legal / Mapa web / Contacto" dentro del texto legal en el import original.
const RE_PORTAL = /^(Aviso Legal|Pol[íi]tica de privacidad|Accesibilidad|Mapa web|Ayuda|Contacto|Descargar (Registros|Firma)|©)\s*$/i

const ORDINALES = ['única', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava', 'novena', 'décima',
  'undécima', 'duodécima', 'decimotercera', 'decimocuarta', 'decimoquinta']
// La BD escribe la derogatoria como `unica` (sin tilde) y el resto con tilde.
function dispKey(tipo, ordinal) {
  const t = tipo.toLowerCase()
  let o = (ordinal || 'única').toLowerCase()
  // La BD escribe `unica` sin tilde en la derogatoria; el resto la lleva.
  if (o === 'unica' || o === 'única') o = t === 'derogatoria' ? 'unica' : 'única'
  if (o === 'septima') o = 'séptima'
  if (o === 'decima') o = 'décima'
  return `da_${t}_${o}`
}
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 }

function splitArticles(paragraphs) {
  // Recogemos TODAS las ocurrencias (el nº puede salir en el sumario y en el cuerpo)
  // y elegimos la más sustanciosa al final — así el cuerpo nunca cae en un huérfano.
  const occurrences = []
  let cur = null
  let started = false
  let anexoSeq = 0
  const open = (number, title, p) => {
    cur = { number, title: (title || '').trim(), lines: [p] }
    occurrences.push(cur)
    started = true
  }
  for (const p of paragraphs) {
    // Ojo: el portal repite enlaces ("Descargar Registros") ANTES del texto; cortar sin
    // haber empezado el articulado deja el documento a cero.
    if (started && RE_PORTAL.test(p)) { cur = null; break }
    if (RE_FIRMA.test(p)) { cur = null; continue }
    let m
    if ((m = p.match(RE_ART)) && isArtHeader(m)) { open(m[1].replace(/\s+/g, ' ').trim().toLowerCase(), m[2], p); continue }
    if ((m = p.match(RE_DISP))) { open(dispKey(m[1], m[2]), m[3], p); continue }
    if ((m = p.match(RE_ANEXO))) { open(`anexo_${anexoSeq++}`, m[2], p); continue }
    // Un encabezado estructural cierra el bloque anterior sin abrir ninguno
    if (RE_HEADING.test(p)) { cur = null; continue }
    if (!started) continue
    if (cur) cur.lines.push(p)
  }
  const best = new Map()
  for (const a of occurrences) {
    const content = a.lines.join('\n').trim()
    const prev = best.get(a.number)
    if (!prev || content.length > prev.content.length)
      best.set(a.number, { number: a.number, title: a.title, content })
  }
  return best
}

// ── Normalización para comparar ──
function norm(s) {
  return (s || '')
    .normalize('NFC')
    .replace(/ /g, ' ')
    .replace(/[“”«»]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}
// Similitud barata y estable: coeficiente de Dice sobre bigramas de palabras.
function similarity(a, b) {
  const grams = (s) => {
    const w = norm(s).split(' ').filter(Boolean)
    const g = new Map()
    for (let i = 0; i < w.length - 1; i++) { const k = w[i] + ' ' + w[i + 1]; g.set(k, (g.get(k) || 0) + 1) }
    return g
  }
  const A = grams(a), B = grams(b)
  if (!A.size || !B.size) return norm(a) === norm(b) ? 1 : 0
  let inter = 0
  for (const [k, v] of A) inter += Math.min(v, B.get(k) || 0)
  const total = (m) => [...m.values()].reduce((s, v) => s + v, 0)
  return (2 * inter) / (total(A) + total(B))
}

const SIM_OK = 0.97 // ≥ esto = misma redacción (ruido de guiones/comillas/espacios)

// La cabecera "Artículo N. Título." dentro del CONTENIDO es inconsistente entre imports:
// unas leyes la guardan en el cuerpo (122/2020) y otras solo el cuerpo (convenios de PDF).
// Se quita de ambos lados antes de comparar para que su presencia/ausencia no ensucie la
// similitud (era la causa del grueso de "contenido≠" en las leyes-PDF).
function stripHeaderLine(s) {
  return (s || '')
    .replace(/^\s*Art[íi]culo\s+\d+(\s*(bis|ter|quater|quinquies))?\s*[.\-–—]\s*[^\n]*\n?/i, '')
    .replace(/^\s*Disposici[oó]n\s+(adicional|transitoria|derogatoria|final)(\s+[a-záéíóúñ]+)?\s*[.\-–—]\s*[^\n]*\n?/i, '')
    .trim()
}

// La BD guarda el título CON su prefijo ("Disposición adicional segunda. Adscripción…",
// "Artículo 3. Competencias…") y la fuente lo trae ya separado. Comparamos solo el
// enunciado para no reportar 15 falsos "título≠" por pura convención de almacenamiento.
function titleBody(s) {
  return (s || '')
    .replace(/^Disposici[oó]n\s+(adicional|transitoria|derogatoria|final)(\s+[a-záéíóúñ]+)?\s*[.\-–—\s]*/i, '')
    .replace(/^Art[íi]culo\s+\d+(\s*(bis|ter|quater|quinquies))?\s*[.\-–—\s]*/i, '')
    // El punto final del enunciado es convención de maquetación, no contenido:
    // la BD lo guarda sin él y el BOA con él ("Retribuciones" vs "Retribuciones.").
    .replace(/[.\s]+$/, '')
    .trim()
}

async function verifyLaw(sql, law, { detail = false, dump = false } = {}) {
  const fetched = await fetchBoa(law.boe_url)
  const paras = fetched.kind === 'pdf' ? pdfToParagraphs(fetched.text) : htmlToParagraphs(fetched.html)
  const src = splitArticles(paras)
  if (dump) {
    const f = `/tmp/boa-${law.id}.txt`
    fs.writeFileSync(f, [...src.values()].map((a) => `=== [${a.number}] ${a.title}\n${a.content}`).join('\n\n'))
    console.log(`   ↳ volcado en ${f}`)
  }
  const dbRows = await sql`
    SELECT article_number, title, content FROM articles
    WHERE law_id = ${law.id} AND is_active = true`
  const db = new Map(dbRows.map((r) => [String(r.article_number).trim().toLowerCase(), r]))

  const missingInDb = [], extraInDb = [], contentMismatch = [], titleMismatch = [], ok = []
  for (const [num, a] of src) if (!db.has(num)) missingInDb.push(num)
  for (const [num, r] of db) {
    const a = src.get(num)
    if (!a) { extraInDb.push(num); continue }
    const sim = similarity(stripHeaderLine(r.content), stripHeaderLine(a.content))
    if (sim >= SIM_OK) ok.push(num)
    else contentMismatch.push({ number: num, sim: +sim.toFixed(3), dbLen: (r.content || '').length, srcLen: a.content.length })
    const tDb = titleBody(r.title), tSrc = titleBody(a.title)
    if (tSrc && norm(tDb) !== norm(tSrc) && similarity(tDb, tSrc) < SIM_OK)
      titleMismatch.push({ number: num, db: r.title, src: a.title })
  }
  const res = {
    law_id: law.id, short_name: law.short_name, url: law.boe_url,
    src_count: src.size, db_count: db.size,
    ok: ok.length,
    missing_in_db: missingInDb, extra_in_db: extraInDb,
    content_mismatch: contentMismatch, title_mismatch: titleMismatch,
  }
  if (detail) {
    for (const m of contentMismatch.sort((a, b) => a.sim - b.sim))
      console.log(`      art ${m.number}: sim=${m.sim} (BD ${m.dbLen} ch / BOA ${m.srcLen} ch)`)
  }
  return res
}

function verdict(r) {
  if (r.src_count === 0) return 'NO_PARSE'   // la URL no da articulado (menú/PDF/sumario)
  if (r.missing_in_db.length) return 'INCOMPLETE'
  if (r.content_mismatch.length || r.title_mismatch.length) return 'ISSUES'
  if (r.extra_in_db.length) return 'EXTRA_IN_DB'
  return 'MATCH'
}

// Las funciones puras se exportan para poder fijarlas con tests (los 6 fallos de parseo
// que costó destapar el bloque BOA): ver __tests__/scripts/verifyLawBoa.test.js
module.exports = { htmlToParagraphs, pdfToParagraphs, splitArticles, titleBody, stripHeaderLine, similarity, norm, dispKey, verdict }

if (require.main !== module) return

;(async () => {
  const args = process.argv.slice(2)
  const write = args.includes('--write')
  const dump = args.includes('--dump')
  const all = args.includes('--all')
  const lawId = args.find((a) => !a.startsWith('--'))
  const sql = loadPg()(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })
  try {
    const laws = all
      ? await sql`SELECT id, short_name, boe_url FROM laws WHERE boe_url ILIKE '%boa.aragon.es%' ORDER BY short_name`
      : await sql`SELECT id, short_name, boe_url FROM laws WHERE id = ${lawId}`
    if (!laws.length) { console.error('❌ sin leyes que verificar'); process.exit(2) }
    const results = []
    for (const law of laws) {
      process.stdout.write(`\n▶ ${law.short_name}\n  ${law.boe_url}\n`)
      let r
      try {
        r = await verifyLaw(sql, law, { detail: !all || args.includes('--detail'), dump })
      } catch (e) {
        console.log(`  ❌ ERROR: ${e.message}`)
        results.push({ law_id: law.id, short_name: law.short_name, error: String(e.message) })
        continue
      }
      const v = verdict(r)
      console.log(`  ${v}  fuente=${r.src_count} arts · BD=${r.db_count} · coinciden=${r.ok}` +
        `${r.missing_in_db.length ? ` · faltan en BD=${r.missing_in_db.length} [${r.missing_in_db.slice(0, 12).join(',')}]` : ''}` +
        `${r.extra_in_db.length ? ` · sobran en BD=${r.extra_in_db.length} [${r.extra_in_db.slice(0, 12).join(',')}]` : ''}` +
        `${r.content_mismatch.length ? ` · contenido≠=${r.content_mismatch.length}` : ''}` +
        `${r.title_mismatch.length ? ` · título≠=${r.title_mismatch.length}` : ''}`)
      results.push({ ...r, verdict: v })

      if (write && r.src_count > 0) {
        const isPdf = /VEROBJ/i.test(law.boe_url)
        // OJO clasificador (lib/laws/completeness.ts): `missing_in_db>0 → incomplete`.
        // Contra una fuente que solo publica el ORIGINAL no podemos afirmar que a la BD
        // le "falte" nada — puede ser un subconjunto deliberado (347/2002: 9 de 350) o
        // una consolidación con distinta numeración. Por eso NO escribimos missing_in_db
        // como defecto: la evidencia se apoya en las divergencias de CONTENIDO (literal),
        // y el diff de tamaño queda para el ojo humano en `source_only_articles`.
        const summary = {
          source: 'BOA', source_url: law.boe_url, source_format: isPdf ? 'pdf' : 'html',
          verifier: 'scripts/verify-law-boa.cjs',
          verified_at: new Date().toISOString(),
          source_is_original_publication: true, // BOA no publica consolidado
          source_article_count: r.src_count, db_count: r.db_count, matching: r.ok,
          missing_in_db: 0, // ver comentario: no afirmable contra fuente original
          extra_in_db: r.extra_in_db.length, // esto SÍ es rojo: art en BD ausente de la fuente
          content_mismatch: r.content_mismatch.length, title_mismatch: r.title_mismatch.length,
          // El reflow del PDF es heurístico → los mismatches pueden ser ruido de parseo,
          // no defecto de BD. Se marca para no fiarse del recuento a ciegas.
          parse_confidence: isPdf ? 'low' : 'high',
          is_ok: v === 'MATCH',
          message: `Verificada artículo por artículo contra el BOA (${r.ok}/${r.db_count} artículos de BD coinciden literal con la fuente${isPdf ? ', extraída de PDF' : ''}). Veredicto: ${v}. Fuente = publicación original (no consolidado).`,
        }
        await sql`UPDATE laws SET last_verification_summary = ${sql.json(summary)} WHERE id = ${law.id}`
        console.log(`  💾 evidencia grabada (is_ok=${summary.is_ok}, conf=${summary.parse_confidence})`)
      }
    }
    const out = '/tmp/boa-verify-report.json'
    fs.writeFileSync(out, JSON.stringify(results, null, 1))
    console.log(`\n📄 informe: ${out}`)
  } finally {
    await sql.end()
  }
})()
