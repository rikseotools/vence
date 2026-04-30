require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const consolidated = JSON.parse(fs.readFileSync('/home/manuel/Documentos/github/vence/t12_galicia_consolidated.json'));
  const now = new Date().toISOString();

  const qIds = consolidated.map(r => r.id);
  const { data: qs, error: qErr } = await supabase
    .from('questions')
    .select('id, primary_article_id, articles(law_id)')
    .in('id', qIds);
  if (qErr) { console.error(qErr); process.exit(1); }
  const qMap = new Map(qs.map(q => [q.id, q]));

  // --- 1) Save verification results in ai_verification_results ---
  console.log('\n=== 1. Guardando resultados en ai_verification_results ===');
  const avrRows = consolidated.map(r => {
    const q = qMap.get(r.id);
    return {
      question_id: r.id,
      article_id: q?.primary_article_id || null,
      law_id: q?.articles?.law_id || null,
      is_correct: r.answer_ok === true && r.article_ok === true,
      confidence: r.confidence || 'media',
      explanation: r.analysis || null,
      article_quote: r.article_quote || null,
      suggested_fix: null,
      correct_option_should_be: r.correct_option_should_be || null,
      ai_provider: 'claude_code',
      ai_model: 'claude-opus-4-6',
      verified_at: now,
      article_ok: r.article_ok,
      answer_ok: r.answer_ok,
      explanation_ok: r.explanation_ok,
      correct_article_suggestion: r.correct_article_suggestion || null,
      explanation_fix: r.explanation_fix || null,
      fix_applied: false,
      discarded: false,
    };
  });

  let avrInserted = 0;
  for (let i = 0; i < avrRows.length; i += 50) {
    const chunk = avrRows.slice(i, i + 50);
    const { data, error } = await supabase.from('ai_verification_results').insert(chunk).select('id');
    if (error) { console.error('❌ AVR insert error:', error.message); process.exit(1); }
    avrInserted += data.length;
  }
  console.log('✅ Insertadas en ai_verification_results:', avrInserted, '/', avrRows.length);

  // --- 2) Apply bad_explanation fixes + activate ---
  console.log('\n=== 2. Aplicando explanation_fix a bad_explanation ===');
  const badExps = consolidated.filter(r => r.status === 'bad_explanation' && r.explanation_fix);
  let fixed = 0;
  for (const r of badExps) {
    const { error } = await supabase.from('questions').update({
      explanation: r.explanation_fix,
      topic_review_status: 'perfect',
      verification_status: 'ok',
      verified_at: now,
      is_active: true,
      deactivation_reason: null,
    }).eq('id', r.id);
    if (error) { console.error('❌', r.id, error.message); continue; }
    fixed++;
    await supabase.from('ai_verification_results').update({
      fix_applied: true, fix_applied_at: now, new_explanation: r.explanation_fix,
    }).eq('question_id', r.id).eq('verified_at', now);
  }
  console.log('✅ bad_explanation corregidas y activadas:', fixed, '/', badExps.length);

  // --- 3) Activate perfect questions ---
  console.log('\n=== 3. Activando preguntas perfect ===');
  const perfectIds = consolidated.filter(r => r.status === 'perfect').map(r => r.id);
  if (perfectIds.length) {
    const { error } = await supabase.from('questions').update({
      topic_review_status: 'perfect',
      verification_status: 'ok',
      verified_at: now,
      is_active: true,
      deactivation_reason: null,
    }).in('id', perfectIds);
    if (error) console.error('❌ perfect:', error.message);
    else console.log('✅ perfect activadas:', perfectIds.length);
  }

  // --- 4) Mark problematic as needing review (keep deactivated) ---
  console.log('\n=== 4. Marcando problemáticas (deactivadas con motivo) ===');
  const problemMap = {
    wrong_article: 'Verificación IA: artículo mal vinculado (posible confusión Ley 7/2023 Galicia vs LO 3/2007)',
    wrong_answer: 'Verificación IA: respuesta marcada no coincide con el artículo',
    unverifiable: 'Verificación IA: artículo embebido no contiene info necesaria (probable desajuste Ley 7/2023 vs LO 3/2007)',
    ambiguous: 'Verificación IA: ambigüedad en el enunciado',
  };
  let problemCount = 0;
  for (const r of consolidated) {
    if (!problemMap[r.status]) continue;
    const reason = problemMap[r.status];
    const { error } = await supabase.from('questions').update({
      topic_review_status: r.status,
      verification_status: 'fail',
      verified_at: now,
      is_active: false,
      deactivation_reason: reason,
    }).eq('id', r.id);
    if (error) { console.error('❌', r.id, error.message); continue; }
    problemCount++;
  }
  console.log('⚠️  problemáticas marcadas:', problemCount);

  // --- 5) Final sanity check ---
  console.log('\n=== 5. Estado final ===');
  const { data: final } = await supabase
    .from('questions')
    .select('is_active, topic_review_status')
    .in('id', qIds);
  const active = final.filter(q => q.is_active).length;
  const byStatus = {};
  for (const q of final) byStatus[q.topic_review_status] = (byStatus[q.topic_review_status] || 0) + 1;
  console.log('Total T12 Galicia:', qIds.length);
  console.log('Activas:', active, '/', qIds.length);
  console.log('Por topic_review_status:', byStatus);
})();
