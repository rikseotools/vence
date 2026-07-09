#!/usr/bin/env node
// scripts/import-tcae-pilot.cjs
// PILOTO de importación TCAE clínico (subject "31. SISTEMA RENAL") → contenedor
// virtual «Eliminacion y sondajes». Sigue docs/maintenance/importar-preguntas-scrapeadas.md:
//   - inserta como DRAFT (lifecycle_state default 'draft' → is_active=false por trigger)
//   - limpia enunciado, calcula content_hash, dedup, vincula a artículo del contenedor
//
// Uso:  node scripts/import-tcae-pilot.cjs            # DRY-RUN (construye y muestra, NO inserta)
//       node scripts/import-tcae-pilot.cjs --apply    # inserta de verdad (a draft)
//       node scripts/import-tcae-pilot.cjs --limit 50 # cuántas (default 50)

const fs = require('fs')
const crypto = require('crypto')
const path = require('path')

const APPLY = process.argv.includes('--apply')
const arg = (name, def) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : def }
const LIMIT = parseInt(arg('--limit', '500'), 10)
// Subject + contenedor SE PASAN POR ARGUMENTO (el mapeo lo decide el humano, no el script).
const SUBJECT = arg('--subject', '31. SISTEMA RENAL')
const CONTAINER = arg('--container', 'Eliminacion y sondajes')

function loadDbUrl() {
  const line = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL='))
  return line.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
}
const postgres = require(path.join(process.cwd(), 'node_modules', 'postgres'))

// Normalización para dedup semántico extra (quita tildes/puntuación)
function norm(t) {
  return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}
// content_hash IDÉNTICO al trigger BD `calculate_question_hash`:
//   MD5(lower(trim(text)) || lower(trim(a)) || ... || lower(trim(d)))  — opciones EN ORDEN.
// Replicarlo exacto es lo único que hace efectivo el dedup contra el UNIQUE de la BD.
function dbHash(qText, opts) {
  const lt = (s) => (s || '').toLowerCase().trim()
  return crypto.createHash('md5').update(lt(qText) + lt(opts[0]) + lt(opts[1]) + lt(opts[2]) + lt(opts[3])).digest('hex')
}
// Clave de dedup SEMÁNTICO (manual §"Nivel 0"): norm(pregunta) + opciones normalizadas
// y ORDENADAS. Caza los casi-duplicados que el MD5 de BD no ve (misma pregunta con
// tildes/puntuación distinta, u opciones barajadas). Verificado: las 2 variantes de
// "La Sra García" colapsan a esta misma clave.
function semanticKey(qText, opts) {
  return norm(qText) + '###' + opts.map(norm).sort().join('|')
}
// Limpieza de enunciado Aula Plus: quitar coletillas tipo (TEST X), (Ley Y), espacios.
function cleanStatement(raw) {
  return (raw || '').replace(/\s*\((?:test|tema|examen)[^)]*\)\s*/gi, ' ').replace(/\s+/g, ' ').trim()
}

// Mapea una pregunta clínica al artículo más afín del contenedor por palabras clave.
// Default = art 6 (anatomía aparato urinario/digestivo), el cajón general.
// Mapas de artículo POR CONTENEDOR (los define el humano, no se infiere a ciegas).
// Contenedor de 1 artículo (ley virtual bucket) → todo va a ese único artículo.
const ARTICLE_MAPS = {
  'Eliminacion y sondajes': (t, byNum) => {
    if (/enema/.test(t)) return byNum(3) || byNum(6)
    if (/sondaj|sonda /.test(t)) return byNum(4) || byNum(6)
    if (/ostom|colostom|ileostom/.test(t)) return byNum(5) || byNum(6)
    if (/bolsa.*diuresis|diuresis|defecaci/.test(t)) return byNum(1) || byNum(6)
    return byNum(6) || null
  },
}
function pickArticle(text, arts) {
  if (arts.length === 1) return arts[0]                  // contenedor bucket: único artículo
  const t = norm(text)
  const byNum = (n) => arts.find(a => String(a.article_number) === String(n))
  const map = ARTICLE_MAPS[CONTAINER]
  if (map) return map(t, byNum) || arts[0]
  return arts[0]                                          // sin mapa definido → primer artículo
}

;(async () => {
  const sql = postgres(loadDbUrl(), { ssl: 'require', max: 1 })

  // 1. contenedor + artículos
  const law = (await sql`SELECT id FROM laws WHERE short_name = ${CONTAINER} LIMIT 1`)[0]
  if (!law) throw new Error('contenedor no encontrado')
  const arts = await sql`SELECT id, article_number, title FROM articles WHERE law_id = ${law.id} ORDER BY article_number`

  // 2. preguntas nuevas del subject (del JSON ya reconciliado)
  const all = require('/tmp/tcae_nuevas.json')
  const renal = all.filter(q => q.subject === SUBJECT)

  // 3. dedup en 2 capas:
  //   (a) exacto: content_hash MD5 de la BD (idéntico al trigger) — global.
  //   (b) semántico: norm(pregunta)+opciones normalizadas-ordenadas, contra TODO el banco
  //       Aula Plus TCAE (caza casi-dups que el MD5 no ve). ~16k filas, en memoria.
  const existing = await sql`SELECT content_hash FROM questions WHERE content_hash IS NOT NULL`
  const existingHashes = new Set(existing.map(r => r.content_hash))
  const apq = await sql`SELECT question_text, option_a, option_b, option_c, option_d FROM questions WHERE exam_source ILIKE '%aula plus%'`
  const existingSemantic = new Set(apq.map(r => semanticKey(r.question_text, [r.option_a, r.option_b, r.option_c, r.option_d])))
  console.log(`dedup index: ${existingHashes.size} hashes exactos + ${existingSemantic.size} claves semánticas`)

  const rows = []
  let skipInvalid = 0, skipDup = 0
  const seenThisRun = new Set()
  for (const q of renal) {
    if (rows.length >= LIMIT) break
    if (q.answers.length !== 4) { skipInvalid++; continue }
    const correctIdx = q.answers.findIndex(a => a.isCorrect)
    if (correctIdx < 0) { skipInvalid++; continue }
    const text = cleanStatement(q.text)
    if (text.length < 25) { skipInvalid++; continue }
    const opts = q.answers.map(a => (a.text || '').trim())
    const hash = dbHash(text, opts)       // exacto (igual que la BD)
    const skey = semanticKey(text, opts)  // semántico (casi-dups)
    if (existingHashes.has(hash) || seenThisRun.has(hash) || existingSemantic.has(skey) || seenThisRun.has(skey)) { skipDup++; continue }
    seenThisRun.add(hash); seenThisRun.add(skey)
    const art = pickArticle(text, arts)
    rows.push({
      question_text: text,
      option_a: opts[0], option_b: opts[1], option_c: opts[2], option_d: opts[3],
      correct_option: correctIdx,
      // explanation es NOT NULL. Aula Plus trae ~60%; las que no, entran con un
      // marcador claro → la fase de revisión con agentes redacta la explicación.
      explanation: (q.feedback || '').trim() || '⏳ Explicación pendiente de redactar (import Aula Plus TCAE).',
      primary_article_id: art.id,
      difficulty: 'medium',
      question_type: 'single',
      is_official_exam: false,
      exam_source: 'Aula Plus - TCAE exámenes oficiales',
      content_data: {},
      tags: null,
      _art: art.article_number,
      _hasExp: !!q.feedback,
    })
  }

  console.log(`=== PILOTO ${SUBJECT} → «${CONTAINER}» ===`)
  console.log(`disponibles: ${renal.length} | construidas: ${rows.length} | inválidas: ${skipInvalid} | dup: ${skipDup}`)
  const byArt = {}; rows.forEach(r => { byArt[r._art] = (byArt[r._art] || 0) + 1 })
  console.log('reparto por artículo:', JSON.stringify(byArt))
  console.log('con explicación:', rows.filter(r => r._hasExp).length, '/', rows.length)
  console.log('\n--- muestra (primeras 2) ---')
  rows.slice(0, 2).forEach(r => {
    console.log(`Q: ${r.question_text.slice(0, 90)}`)
    console.log(`  A)${r.option_a.slice(0,30)} B)${r.option_b.slice(0,30)} C)${r.option_c.slice(0,30)} D)${r.option_d.slice(0,30)}`)
    console.log(`  correcta=${'ABCD'[r.correct_option]} | art=${r._art} | exp=${r._hasExp ? 'sí' : 'no'}`)
  })

  if (!APPLY) {
    console.log('\n🔍 DRY-RUN — nada insertado. Repite con --apply para insertar a DRAFT.')
    await sql.end(); return
  }

  // 4. INSERT a DRAFT (sin pasar lifecycle_state ni is_active → default draft → invisible)
  let inserted = 0
  for (const r of rows) {
    try {
      // content_hash NO se pasa: lo calcula el trigger auto_calculate_question_hash (MD5).
      await sql`INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id, difficulty, question_type, is_official_exam, exam_source, content_data, tags)
        VALUES (${r.question_text}, ${r.option_a}, ${r.option_b}, ${r.option_c}, ${r.option_d}, ${r.correct_option}, ${r.explanation}, ${r.primary_article_id}, ${r.difficulty}, ${r.question_type}, ${r.is_official_exam}, ${r.exam_source}, ${r.content_data}, ${r.tags})`
      inserted++
    } catch (e) {
      console.error('  ⚠️ fallo insert (hash dup u otro):', e.message.slice(0, 80))
    }
  }
  console.log(`\n✅ INSERTADAS ${inserted}/${rows.length} a DRAFT (lifecycle_state='draft', is_active=false).`)
  await sql.end()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
