// Inserta como DRAFT los 2 batches IA (D71/1992 + Ley 3/2003). Paso 3 dedup +
// Paso 4 test + Paso 5 resto. Idempotente por tags.
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const L = ['A', 'B', 'C', 'D']
const L3_LAW = '4a616aa7-580e-4a0a-98ec-ea2319b35f88'

function build(article_id, label, cite, q, correct, why_correct, distractors, co) {
  const opts = new Array(4); opts[co] = correct
  let di = 0; const slot = {}
  for (let i = 0; i < 4; i++) { if (i === co) continue; opts[i] = distractors[di].text; slot[i] = distractors[di]; di++ }
  let e = `> **${cite}**\n> "${why_correct.quote}"\n\n**Por qué ${L[co]} es correcta:** ${why_correct.reason}\n\n**Por qué las demás son incorrectas:**\n`
  for (let i = 0; i < 4; i++) { if (i === co) continue; e += `- **${L[i]})** ${slot[i].why}\n` }
  return { primary_article_id: article_id, article_label: label, question_text: q,
    option_a: opts[0], option_b: opts[1], option_c: opts[2], option_d: opts[3], correct_option: co, explanation: e.trim() }
}

async function insertOne(qobj, batch) {
  const row = {
    question_text: qobj.question_text, question_type: 'single',
    option_a: qobj.option_a, option_b: qobj.option_b, option_c: qobj.option_c, option_d: qobj.option_d,
    correct_option: qobj.correct_option, explanation: qobj.explanation,
    primary_article_id: qobj.primary_article_id, difficulty: 'medium',
    tags: ['ia_generada', batch], lifecycle_state: 'draft',
  }
  const { data, error } = await s.from('questions').insert(row).select('id, lifecycle_state, is_active, content_hash, correct_option, question_type, tags').single()
  if (error) throw new Error(error.message)
  return data
}

;(async () => {
  // ----- Batch A: ya construido -----
  const A = JSON.parse(fs.readFileSync('/tmp/ia_d71_1992_ast_borrador.json', 'utf8'))
  // ----- Batch B: raw → resolver UUID art + build -----
  const Braw = JSON.parse(fs.readFileSync('/tmp/ia_ley3_2003_ast_RAW.json', 'utf8'))
  const { data: l3arts } = await s.from('articles').select('id, article_number').eq('law_id', L3_LAW)
  const byNum = {}; for (const a of l3arts) byNum[a.article_number] = a.id
  const B = Braw.map((e) => {
    const artNum = e[1].match(/Art\s+(\d+)/)[1]
    const aid = byNum[artNum]; if (!aid) throw new Error('no art ' + artNum)
    return build(aid, e[1], e[2], e[3], e[4], e[5], e[6], e[7])
  })

  // ----- Paso 3: dedup (los artículos son nuevos → debe haber 0 previas) -----
  const allArtIds = [...new Set([...A, ...B].map(q => q.primary_article_id))]
  const { count: prev } = await s.from('questions').select('*', { count: 'exact', head: true }).in('primary_article_id', allArtIds)
  console.log('Preguntas previas en esos artículos (dedup):', prev)
  if (prev > 0) { console.log('⚠ ya hay preguntas — abortando para revisar'); return }

  // ----- Idempotencia: borrar drafts previos de estos batches -----
  for (const b of ['ia_d71_1992_ast', 'ia_ley3_2003_ast']) {
    await s.from('questions').delete().contains('tags', ['ia_generada', b]).eq('lifecycle_state', 'draft')
  }

  // ----- Paso 4: test 1 pregunta -----
  const t = await insertOne(A[0], 'ia_d71_1992_ast')
  const ok = t.lifecycle_state === 'draft' && t.is_active === false && t.tags.includes('ia_generada') && (t.content_hash || '').length === 32 && t.question_type === 'single'
  console.log('TEST invariantes:', ok ? '✅' : '❌', JSON.stringify({ state: t.lifecycle_state, active: t.is_active, hash: (t.content_hash || '').length, type: t.question_type }))
  if (!ok) { console.log('abortando'); return }

  // ----- Paso 5: resto -----
  const ids = { ia_d71_1992_ast: [t.id], ia_ley3_2003_ast: [] }
  for (let i = 1; i < A.length; i++) ids.ia_d71_1992_ast.push((await insertOne(A[i], 'ia_d71_1992_ast')).id)
  for (const q of B) ids.ia_ley3_2003_ast.push((await insertOne(q, 'ia_ley3_2003_ast')).id)
  fs.writeFileSync('/tmp/asturias_ia_inserted_ids.json', JSON.stringify(ids, null, 2))
  console.log('✅ Insertadas draft — D71/1992:', ids.ia_d71_1992_ast.length, '| Ley3/2003:', ids.ia_ley3_2003_ast.length)
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
