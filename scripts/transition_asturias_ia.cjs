// Paso 8: transición draft→approved de los 24 IA tras auditoría doble PERFECT.
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const D71 = 'ae86f016-bcd0-4d8c-80ee-ea9fa0fbbb6c'
const L3 = '4a616aa7-580e-4a0a-98ec-ea2319b35f88'

;(async () => {
  const ids = require('/tmp/asturias_ia_inserted_ids.json')
  const map = {}; for (const id of ids.ia_d71_1992_ast) map[id] = 'ia_d71_1992_ast'; for (const id of ids.ia_ley3_2003_ast) map[id] = 'ia_ley3_2003_ast'
  const all = Object.keys(map)
  const { data: qs } = await s.from('questions').select('id, primary_article_id, lifecycle_state').in('id', all)
  // resolver law_id por artículo
  const { data: arts } = await s.from('articles').select('id, law_id').in('id', [...new Set(qs.map(q => q.primary_article_id))])
  const lawOf = {}; for (const a of arts) lawOf[a.id] = a.law_id

  let done = 0, skip = 0
  for (const q of qs) {
    if (q.lifecycle_state !== 'draft') { skip++; continue }
    const batch = map[q.id]
    const lawName = lawOf[q.primary_article_id] === D71 ? 'Decreto 71/1992' : 'Ley 3/2003'
    // 1) trazabilidad
    await s.from('ai_verification_results').upsert({
      question_id: q.id, article_id: q.primary_article_id, law_id: lawOf[q.primary_article_id],
      article_ok: true, answer_ok: true, explanation_ok: true, options_ok: true, confidence: 'alta',
      explanation: `IA-generada (${lawName} Asturias). Auditoría doble: auto-audit + Sonnet ciego independiente, ambas PERFECT. Anti-tell: distractores ±30% long + posición aleatoria uniforme verificadas.`,
      ai_provider: 'claude_code', ai_model: 'claude-opus-4-8', verified_at: new Date().toISOString(),
    }, { onConflict: 'question_id,ai_provider' })
    // 2) transición
    const { error } = await s.rpc('transition_question_state', {
      p_question_id: q.id, p_expected_state: 'draft', p_new_state: 'approved',
      p_reason_code: 'ai_verified_perfect', p_changed_by: null, p_ai_verification_id: null,
      p_notes: `Batch ${batch} — auditoría doble (claude_code + sonnet ciego)`,
    })
    if (error) { console.error('❌ transición', q.id.slice(0, 8), error.message); continue }
    // 3) sync legacy
    await s.from('questions').update({ topic_review_status: 'perfect', verification_status: 'ok', verified_at: new Date().toISOString() }).eq('id', q.id)
    done++
  }
  console.log(`✅ transicionadas a approved: ${done} | ya no-draft: ${skip}`)
  // verificar
  const { data: chk } = await s.from('questions').select('lifecycle_state, is_active').in('id', all)
  const byState = {}; for (const c of chk) { const k = c.lifecycle_state + '/' + c.is_active; byState[k] = (byState[k] || 0) + 1 }
  console.log('Estado final:', JSON.stringify(byState))
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
