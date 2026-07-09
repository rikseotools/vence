#!/usr/bin/env node
// scripts/import-aulaplus-clinico.cjs
// Importa preguntas clínicas scrapeadas de Aula Plus (cualquier rama/materia) a un contenedor virtual.
// Generalización de import-tcae-subject.cjs (mismo flujo probado): limpia enunciado, calcula
// content_hash idéntico al trigger, dedup exacto+semántico, vincula a artículo del contenedor,
// inserta en DRAFT (lifecycle_state default → is_active=false). Sigue importar-preguntas-scrapeadas.md.
//
// Uso:  node scripts/import-aulaplus-clinico.cjs --subject "03. CARDIOLOGÍA" --container "Cardiología"
//         [--input /tmp/enf_nuevas.json] [--source "Aula Plus - Enfermería"] [--limit 1000] [--apply]

const fs = require('fs')
const crypto = require('crypto')
const path = require('path')
const APPLY = process.argv.includes('--apply')
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d }
const LIMIT = parseInt(arg('--limit', '2000'), 10)
const SUBJECT = arg('--subject', null)
const CONTAINER = arg('--container', null)
const INPUT = arg('--input', '/tmp/enf_nuevas.json')
const SOURCE = arg('--source', 'Aula Plus - Enfermería')
if (!SUBJECT || !CONTAINER) { console.error('Faltan --subject y --container'); process.exit(1) }

function loadDbUrl() {
  const line = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL='))
  return line.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
}
const postgres = require(path.join(process.cwd(), 'node_modules', 'postgres'))
function norm(t) { return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim() }
function dbHash(qText, opts) { const lt = s => (s || '').toLowerCase().trim(); return crypto.createHash('md5').update(lt(qText) + lt(opts[0]) + lt(opts[1]) + lt(opts[2]) + lt(opts[3])).digest('hex') }
function semanticKey(qText, opts) { return norm(qText) + '###' + opts.map(norm).sort().join('|') }
function cleanStatement(raw) { return (raw || '').replace(/\s*\((?:test|tema|examen)[^)]*\)\s*/gi, ' ').replace(/\s+/g, ' ').trim() }

;(async () => {
  const sql = postgres(loadDbUrl(), { ssl: 'require', max: 1 })
  const law = (await sql`SELECT id FROM laws WHERE short_name = ${CONTAINER} LIMIT 1`)[0]
  if (!law) throw new Error('contenedor no encontrado: ' + CONTAINER)
  const arts = await sql`SELECT id, article_number, title FROM articles WHERE law_id = ${law.id} ORDER BY article_number`
  if (!arts.length) throw new Error('el contenedor no tiene artículos')

  const all = JSON.parse(fs.readFileSync(INPUT, 'utf8'))
  const pool = all.filter(q => q.subject === SUBJECT)

  // dedup: exacto (content_hash BD, global) + semántico (vs banco Aula Plus)
  const existing = await sql`SELECT content_hash FROM questions WHERE content_hash IS NOT NULL`
  const existingHashes = new Set(existing.map(r => r.content_hash))
  const apq = await sql`SELECT question_text, option_a, option_b, option_c, option_d FROM questions WHERE exam_source ILIKE '%aula plus%'`
  const existingSemantic = new Set(apq.map(r => semanticKey(r.question_text, [r.option_a, r.option_b, r.option_c, r.option_d])))
  console.log(`dedup index: ${existingHashes.size} hashes + ${existingSemantic.size} claves semánticas`)

  const rows = []; let skipInvalid = 0, skipDup = 0; const seen = new Set()
  for (const q of pool) {
    if (rows.length >= LIMIT) break
    if (!q.answers || q.answers.length !== 4) { skipInvalid++; continue }
    const correctIdx = q.answers.findIndex(a => a.isCorrect)
    if (correctIdx < 0) { skipInvalid++; continue }
    const text = cleanStatement(q.text)
    if (text.length < 25) { skipInvalid++; continue }
    const opts = q.answers.map(a => (a.text || '').trim())
    if (opts.some(o => !o)) { skipInvalid++; continue }
    const hash = dbHash(text, opts), skey = semanticKey(text, opts)
    if (existingHashes.has(hash) || existingSemantic.has(skey) || seen.has(hash) || seen.has(skey)) { skipDup++; continue }
    seen.add(hash); seen.add(skey)
    rows.push({
      question_text: text, option_a: opts[0], option_b: opts[1], option_c: opts[2], option_d: opts[3],
      correct_option: correctIdx,
      explanation: (q.feedback || '').trim() || '⏳ Explicación pendiente de redactar (import Aula Plus).',
      primary_article_id: arts[0].id, difficulty: 'medium', question_type: 'single',
      is_official_exam: false, exam_source: SOURCE, content_data: {}, tags: null,
      _hasExp: !!(q.feedback && q.feedback.trim()),
    })
  }
  console.log(`=== ${SUBJECT} → «${CONTAINER}» ===`)
  console.log(`en pool: ${pool.length} | construidas: ${rows.length} | inválidas: ${skipInvalid} | dup: ${skipDup}`)
  console.log(`con explicación: ${rows.filter(r => r._hasExp).length}/${rows.length}`)
  rows.slice(0, 2).forEach(r => { console.log(`Q: ${r.question_text.slice(0, 95)}\n  correcta=${'ABCD'[r.correct_option]} exp=${r._hasExp ? 'sí' : 'no'}`) })

  if (!APPLY) { console.log('\n🔍 DRY-RUN — nada insertado. Repite con --apply.'); await sql.end(); return }
  let inserted = 0
  for (const r of rows) {
    try {
      await sql`INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id, difficulty, question_type, is_official_exam, exam_source, content_data, tags)
        VALUES (${r.question_text}, ${r.option_a}, ${r.option_b}, ${r.option_c}, ${r.option_d}, ${r.correct_option}, ${r.explanation}, ${r.primary_article_id}, ${r.difficulty}, ${r.question_type}, ${r.is_official_exam}, ${r.exam_source}, ${r.content_data}, ${r.tags})`
      inserted++
    } catch (e) { console.error('  ⚠️ fallo insert:', e.message.slice(0, 80)) }
  }
  console.log(`\n✅ INSERTADAS ${inserted}/${rows.length} a DRAFT (invisible hasta verificar+activar).`)
  await sql.end()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
