require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Consolidate
  const dir = '/home/manuel/Documentos/github/vence/c1_t18_results';
  const files = fs.readdirSync(dir).filter(f => /^batch_\d+_result\.json$/.test(f)).sort();
  const all = [];
  for (const f of files) {
    const arr = JSON.parse(fs.readFileSync(dir + '/' + f));
    all.push(...arr);
  }
  const byStatus = {};
  for (const r of all) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  fs.writeFileSync('c1_t18_consolidated.json', JSON.stringify(all, null, 2));
  console.log('Consolidadas:', all.length, '| status:', byStatus);

  const now = new Date().toISOString();

  // === 1) Guardar AVR ===
  const qIds = all.map(r => r.id);
  const { data: qs } = await s.from('questions').select('id, primary_article_id, articles(law_id)').in('id', qIds);
  const qMap = new Map(qs.map(q => [q.id, q]));

  const avrRows = all.map(r => {
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
  const { error: avrErr } = await s.from('ai_verification_results').insert(avrRows);
  if (avrErr) { console.error('❌', avrErr.message); process.exit(1); }
  console.log('✅ AVR:', avrRows.length);

  // === 2) Activar perfect ===
  const perfectIds = all.filter(r => r.status === 'perfect').map(r => r.id);
  if (perfectIds.length) {
    await s.from('questions').update({
      topic_review_status: 'perfect', verification_status: 'ok', verified_at: now,
      is_active: true, deactivation_reason: null,
    }).in('id', perfectIds);
    console.log('✅ perfect activadas:', perfectIds.length);
  }

  // === 3) Fix bad_explanation ===
  const badExps = all.filter(r => r.status === 'bad_explanation' && r.explanation_fix);
  let bx = 0;
  for (const r of badExps) {
    const { error } = await s.from('questions').update({
      explanation: r.explanation_fix,
      topic_review_status: 'perfect', verification_status: 'ok', verified_at: now,
      is_active: true, deactivation_reason: null,
    }).eq('id', r.id);
    if (error) console.error('  ❌', r.id, error.message);
    else {
      await s.from('ai_verification_results').update({ fix_applied: true, fix_applied_at: now, new_explanation: r.explanation_fix }).eq('question_id', r.id).eq('verified_at', now);
      bx++;
    }
  }
  console.log('✅ bad_explanation activadas:', bx);

  // === 4) Desactivar ambiguous/wrong_answer (preguntas pre-reforma 2022) ===
  const problemMap = {
    ambiguous: 'Verificación IA: pregunta pre-reforma laboral 2022 (Estatuto de los Trabajadores), terminología obsoleta',
    wrong_answer: 'Verificación IA: pregunta pre-reforma 2022 — ninguna opción es correcta según el texto vigente del Estatuto de los Trabajadores',
  };
  let problemCount = 0;
  for (const r of all) {
    if (!problemMap[r.status]) continue;
    const { error } = await s.from('questions').update({
      topic_review_status: r.status, verification_status: 'fail', verified_at: now,
      is_active: false, deactivation_reason: problemMap[r.status],
    }).eq('id', r.id);
    if (error) console.error('  ❌', r.id, error.message);
    else problemCount++;
  }
  console.log('⚠️  problemáticas desactivadas:', problemCount);

  // === Estado final ===
  console.log('\n=== Estado final T18 ===');
  const ids = JSON.parse(fs.readFileSync('c1_t18_imported_ids.json'));
  const { data: final } = await s.from('questions').select('is_active, topic_review_status').in('id', ids);
  const active = final.filter(q => q.is_active).length;
  const sc = {};
  for (const q of final) sc[q.topic_review_status] = (sc[q.topic_review_status] || 0) + 1;
  console.log('Total:', ids.length, '| Activas:', active);
  console.log('Por status:', sc);
})();
