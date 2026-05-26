// scripts/simulate-tts-chunker-impact.cjs
//
// Simulación del impacto del fix del chunker sobre el corpus REAL de artículos.
// Compara el chunker VIEJO (devuelve frases >MAX íntegras) vs el NUEVO
// (force-split por comas/palabras). Mide:
//
//   - Cuántos artículos quedan con chunks >300 chars (umbral de Chrome silent-fail).
//   - Cuántos chunks oversize totales.
//   - Distribución de tamaños de chunk.
//   - Peores casos restantes (para validar que el fix elimina la cola larga).
//
// Sin permisos especiales: lee con SUPABASE_SERVICE_ROLE_KEY de .env.local.

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const MAX = 250
const CHROME_FAIL_THRESHOLD = 300

// ─── Chunker VIEJO (snapshot del comportamiento previo al fix) ────────────
function cleanTextLegacy(raw) {
  return raw
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/>\s?/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim()
}

function splitLegacy(text) {
  const sentences = text.split(/(?<=[.!?;])\s+/)
  const chunks = []
  let current = ''
  for (const s of sentences) {
    if (current.length + s.length > MAX && current.length > 0) {
      chunks.push(current.trim())
      current = s
    } else {
      current += (current ? ' ' : '') + s
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.length ? chunks : [text]
}

// ─── Chunker NUEVO (con force-split, espejo del lib/tts/chunker.ts) ───────
function splitNew(text) {
  const sentences = text.split(/(?<=[.!?;])\s+/)
  const chunks = []
  let current = ''
  for (const sentence of sentences) {
    const pieces = sentence.length > MAX ? forceSplitOversize(sentence) : [sentence]
    for (const piece of pieces) {
      const sepLen = current.length > 0 ? 1 : 0
      if (current.length + sepLen + piece.length > MAX && current.length > 0) {
        chunks.push(current.trim())
        current = piece
      } else {
        current += (current ? ' ' : '') + piece
      }
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.length ? chunks : [text]
}

function forceSplitOversize(sentence) {
  const commaParts = sentence.split(/(?<=,)\s+/)
  if (commaParts.length > 1) {
    const out = []
    for (const part of commaParts) {
      if (part.length <= MAX) out.push(part)
      else out.push(...splitByWords(part))
    }
    return packBySize(out, ' ')
  }
  return splitByWords(sentence)
}

function splitByWords(text) {
  return packBySize(text.split(/\s+/).filter((w) => w.length > 0), ' ')
}

function packBySize(parts, joiner) {
  const out = []
  let cur = ''
  for (const p of parts) {
    if (!p) continue
    const candidate = cur ? cur + joiner + p : p
    if (candidate.length > MAX && cur) {
      out.push(cur)
      cur = p
    } else {
      cur = candidate
    }
  }
  if (cur) out.push(cur)
  return out
}

// ─── Análisis ─────────────────────────────────────────────────────────────
function analyzeChunks(chunks) {
  let max = 0
  let oversize300 = 0
  let oversize400 = 0
  let oversize500 = 0
  for (const c of chunks) {
    if (c.length > max) max = c.length
    if (c.length > 300) oversize300++
    if (c.length > 400) oversize400++
    if (c.length > 500) oversize500++
  }
  return { count: chunks.length, max, oversize300, oversize400, oversize500 }
}

async function fetchAllArticles() {
  // Paginate to fetch ALL articles, not just first 1000
  const PAGE = 1000
  let from = 0
  const all = []
  while (true) {
    const { data, error } = await supabase
      .from('articles')
      .select('id, article_number, law_id, content')
      .not('content', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
    process.stderr.write(`\r  fetched ${all.length}`)
  }
  process.stderr.write(`\r  fetched ${all.length}\n`)
  return all
}

async function main() {
  console.log('🔍 Cargando corpus completo de articles…')
  const articles = await fetchAllArticles()
  console.log(`✅ ${articles.length} artículos\n`)

  const totals = {
    legacy: { withOversize300: 0, withOversize400: 0, withOversize500: 0, oversize300Chunks: 0, oversize400Chunks: 0, totalChunks: 0, maxAbs: 0 },
    nuevo:  { withOversize300: 0, withOversize400: 0, withOversize500: 0, oversize300Chunks: 0, oversize400Chunks: 0, totalChunks: 0, maxAbs: 0 },
  }
  const worstLegacy = []
  const worstNuevo = []
  const distLegacy = []
  const distNuevo = []
  const losslessFailures = []

  for (const a of articles) {
    const full = `Artículo ${a.article_number}. ${a.content}`
    const cleaned = cleanTextLegacy(full)
    const legacyChunks = splitLegacy(cleaned)
    const nuevoChunks = splitNew(cleaned)

    const lStats = analyzeChunks(legacyChunks)
    const nStats = analyzeChunks(nuevoChunks)

    totals.legacy.totalChunks += lStats.count
    totals.legacy.oversize300Chunks += lStats.oversize300
    totals.legacy.oversize400Chunks += lStats.oversize400
    if (lStats.max > 300) totals.legacy.withOversize300++
    if (lStats.max > 400) totals.legacy.withOversize400++
    if (lStats.max > 500) totals.legacy.withOversize500++
    if (lStats.max > totals.legacy.maxAbs) totals.legacy.maxAbs = lStats.max

    totals.nuevo.totalChunks += nStats.count
    totals.nuevo.oversize300Chunks += nStats.oversize300
    totals.nuevo.oversize400Chunks += nStats.oversize400
    if (nStats.max > 300) totals.nuevo.withOversize300++
    if (nStats.max > 400) totals.nuevo.withOversize400++
    if (nStats.max > 500) totals.nuevo.withOversize500++
    if (nStats.max > totals.nuevo.maxAbs) totals.nuevo.maxAbs = nStats.max

    distLegacy.push(lStats.max)
    distNuevo.push(nStats.max)

    if (lStats.max > 300) worstLegacy.push({ id: a.id, art: a.article_number, law: a.law_id, max: lStats.max, chunks: lStats.count })
    if (nStats.max > 300) worstNuevo.push({ id: a.id, art: a.article_number, law: a.law_id, max: nStats.max, chunks: nStats.count })

    // Invariante lossless: reconstruir el contenido debe coincidir aprox.
    const recon = nuevoChunks.join(' ').replace(/\s+/g, ' ')
    const orig = cleaned.replace(/\s+/g, ' ')
    if (recon.length < orig.length - nuevoChunks.length - 2) {
      // Tolerancia: 1 char por chunk por trims
      losslessFailures.push({ id: a.id, art: a.article_number, origLen: orig.length, reconLen: recon.length, diff: orig.length - recon.length })
    }
  }

  worstLegacy.sort((a, b) => b.max - a.max)
  worstNuevo.sort((a, b) => b.max - a.max)

  function pctil(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length * p)]
  }

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('📊 RESULTADO — ' + articles.length + ' artículos procesados')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('LEGACY (antes del fix):')
  console.log(`  artículos con chunk >300 chars: ${totals.legacy.withOversize300} (${(totals.legacy.withOversize300/articles.length*100).toFixed(1)}%)`)
  console.log(`  artículos con chunk >400 chars: ${totals.legacy.withOversize400}`)
  console.log(`  artículos con chunk >500 chars: ${totals.legacy.withOversize500}`)
  console.log(`  total chunks oversize >300:     ${totals.legacy.oversize300Chunks}`)
  console.log(`  total chunks oversize >400:     ${totals.legacy.oversize400Chunks}`)
  console.log(`  chunk más grande (absoluto):    ${totals.legacy.maxAbs} chars`)
  console.log(`  total chunks emitidos:          ${totals.legacy.totalChunks}`)
  console.log(`  P50 max-chunk-len por art:      ${pctil(distLegacy, 0.5)}`)
  console.log(`  P95 max-chunk-len por art:      ${pctil(distLegacy, 0.95)}`)
  console.log(`  P99 max-chunk-len por art:      ${pctil(distLegacy, 0.99)}`)
  console.log('')
  console.log('NUEVO (con force-split):')
  console.log(`  artículos con chunk >300 chars: ${totals.nuevo.withOversize300} (${(totals.nuevo.withOversize300/articles.length*100).toFixed(2)}%)`)
  console.log(`  artículos con chunk >400 chars: ${totals.nuevo.withOversize400}`)
  console.log(`  artículos con chunk >500 chars: ${totals.nuevo.withOversize500}`)
  console.log(`  total chunks oversize >300:     ${totals.nuevo.oversize300Chunks}`)
  console.log(`  total chunks oversize >400:     ${totals.nuevo.oversize400Chunks}`)
  console.log(`  chunk más grande (absoluto):    ${totals.nuevo.maxAbs} chars`)
  console.log(`  total chunks emitidos:          ${totals.nuevo.totalChunks}`)
  console.log(`  P50 max-chunk-len por art:      ${pctil(distNuevo, 0.5)}`)
  console.log(`  P95 max-chunk-len por art:      ${pctil(distNuevo, 0.95)}`)
  console.log(`  P99 max-chunk-len por art:      ${pctil(distNuevo, 0.99)}`)
  console.log('')
  console.log('IMPACTO:')
  const elim300 = totals.legacy.oversize300Chunks - totals.nuevo.oversize300Chunks
  const elim400 = totals.legacy.oversize400Chunks - totals.nuevo.oversize400Chunks
  console.log(`  chunks oversize >300 eliminados: ${elim300} (-${(elim300/Math.max(1,totals.legacy.oversize300Chunks)*100).toFixed(1)}%)`)
  console.log(`  chunks oversize >400 eliminados: ${elim400}`)
  const artFix = totals.legacy.withOversize300 - totals.nuevo.withOversize300
  console.log(`  artículos "curados" (sin chunks>300): ${artFix} (${(artFix/articles.length*100).toFixed(1)}% del corpus)`)
  const extra = totals.nuevo.totalChunks - totals.legacy.totalChunks
  console.log(`  chunks adicionales (overhead de splitear): +${extra} (${(extra/totals.legacy.totalChunks*100).toFixed(2)}% sobre legacy)`)
  console.log('')

  if (worstNuevo.length > 0) {
    console.log(`⚠️  Casos restantes con chunk >300 chars en NUEVO (TOP 15):`)
    for (const w of worstNuevo.slice(0, 15)) {
      console.log(`    art ${w.art} | max=${w.max} | chunks=${w.chunks} | law=${w.law.slice(0,8)} | id=${w.id.slice(0,8)}`)
    }
    console.log('')
  } else {
    console.log('✅ CERO artículos con chunks >300 chars tras el fix.')
    console.log('')
  }

  if (losslessFailures.length > 0) {
    console.log(`⚠️  Invariante lossless VIOLADA en ${losslessFailures.length} artículos (texto perdido al chunkear):`)
    for (const l of losslessFailures.slice(0, 10)) {
      console.log(`    art ${l.art} | origLen=${l.origLen} | reconLen=${l.reconLen} | diff=${l.diff}`)
    }
  } else {
    console.log('✅ Invariante lossless OK en TODOS los artículos (texto preservado al chunkear).')
  }
}

main().catch((e) => {
  console.error('❌ Error:', e)
  process.exit(1)
})
