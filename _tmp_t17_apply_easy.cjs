require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const consolidated = JSON.parse(fs.readFileSync('t17_galicia_consolidated.json'));
  const now = new Date().toISOString();

  // Fetch current article/law for each
  const qIds = consolidated.map(r => r.id);
  const { data: qs } = await s.from('questions').select('id, primary_article_id, articles(law_id)').in('id', qIds);
  const qMap = new Map(qs.map(q => [q.id, q]));

  // === 1) Guardar todo en ai_verification_results ===
  console.log('=== 1. ai_verification_results ===');
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
    const { data, error } = await s.from('ai_verification_results').insert(chunk).select('id');
    if (error) { console.error('  ❌', error.message); process.exit(1); }
    avrInserted += data.length;
  }
  console.log('✅ AVR:', avrInserted);

  // === 2) bad_explanation con fix ===
  console.log('\n=== 2. bad_explanation ===');
  const bad = consolidated.filter(r => r.status === 'bad_explanation' && r.explanation_fix);
  let f1 = 0;
  for (const r of bad) {
    const { error } = await s.from('questions').update({
      explanation: r.explanation_fix,
      topic_review_status: 'perfect',
      verification_status: 'ok',
      verified_at: now,
      is_active: true,
      deactivation_reason: null,
    }).eq('id', r.id);
    if (error) { console.error('  ❌', r.id, error.message); continue; }
    f1++;
    await s.from('ai_verification_results').update({
      fix_applied: true, fix_applied_at: now, new_explanation: r.explanation_fix,
    }).eq('question_id', r.id).eq('verified_at', now);
  }
  console.log('✅ bad_explanation activadas:', f1, '/', bad.length);

  // === 3) perfect ===
  console.log('\n=== 3. perfect ===');
  const perfectIds = consolidated.filter(r => r.status === 'perfect').map(r => r.id);
  if (perfectIds.length) {
    const { error } = await s.from('questions').update({
      topic_review_status: 'perfect',
      verification_status: 'ok',
      verified_at: now,
      is_active: true,
      deactivation_reason: null,
    }).in('id', perfectIds);
    if (error) console.error('  ❌', error.message);
    else console.log('✅ perfect activadas:', perfectIds.length);
  }

  // === 4) Estado intermedio ===
  console.log('\n=== Estado intermedio ===');
  const ids = JSON.parse(fs.readFileSync('t17_galicia_imported_ids.json'));
  const { data: final } = await s.from('questions').select('is_active, topic_review_status').in('id', ids);
  const active = final.filter(q => q.is_active).length;
  const byStatus = {};
  for (const q of final) byStatus[q.topic_review_status] = (byStatus[q.topic_review_status] || 0) + 1;
  console.log('Total:', ids.length, '| Activas:', active);
  console.log('Por status:', byStatus);
})();
