require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LEY_9_2007 = 'c5bdb593-cf8c-4f24-936d-7e2381ba5b22';

(async () => {
  // === Consolidar ===
  const dir = '/home/manuel/Documentos/github/vence/c1_t12_results';
  const files = fs.readdirSync(dir).filter(f => /^batch_\d+_result\.json$/.test(f)).sort();
  const all = [];
  const byStatus = {};
  for (const f of files) {
    const arr = JSON.parse(fs.readFileSync(dir + '/' + f));
    for (const r of arr) {
      all.push(r);
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    }
  }
  fs.writeFileSync('c1_t12_consolidated.json', JSON.stringify(all, null, 2));
  console.log('Consolidadas:', all.length, '| status:', byStatus);

  const now = new Date().toISOString();

  // === Guardar ai_verification_results ===
  console.log('\n=== 1. ai_verification_results ===');
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
  const { data: avrIns, error: avrErr } = await s.from('ai_verification_results').insert(avrRows).select('id');
  if (avrErr) { console.error('❌', avrErr.message); process.exit(1); }
  console.log('✅ AVR:', avrIns.length);

  // === Activar perfect ===
  console.log('\n=== 2. Activar perfect ===');
  const perfectIds = all.filter(r => r.status === 'perfect').map(r => r.id);
  if (perfectIds.length) {
    const { error } = await s.from('questions').update({
      topic_review_status: 'perfect',
      verification_status: 'ok',
      verified_at: now,
      is_active: true,
      deactivation_reason: null,
    }).in('id', perfectIds);
    if (error) console.error('❌', error.message);
    else console.log('✅ perfect activadas:', perfectIds.length);
  }

  // === Fix bad_explanation ===
  console.log('\n=== 3. Fix bad_explanation ===');
  const badExps = all.filter(r => r.status === 'bad_explanation' && r.explanation_fix);
  for (const r of badExps) {
    const { error } = await s.from('questions').update({
      explanation: r.explanation_fix,
      topic_review_status: 'perfect',
      verification_status: 'ok',
      verified_at: now,
      is_active: true,
      deactivation_reason: null,
    }).eq('id', r.id);
    if (error) console.error('❌', r.id, error.message);
    else {
      await s.from('ai_verification_results').update({ fix_applied: true, fix_applied_at: now, new_explanation: r.explanation_fix }).eq('question_id', r.id).eq('verified_at', now);
      console.log('  ✅', r.id.slice(0, 12));
    }
  }

  // === Fix wrong_article ===
  console.log('\n=== 4. Fix wrong_article ===');
  const wrongArts = all.filter(r => r.status === 'wrong_article');
  for (const r of wrongArts) {
    const newArtNum = r.correct_article_suggestion;
    if (!newArtNum) { console.log('  ⚠️ sin sugerencia art:', r.id); continue; }
    const { data: art } = await s.from('articles').select('id').eq('law_id', LEY_9_2007).eq('article_number', newArtNum).maybeSingle();
    if (!art) { console.log('  ❌ art', newArtNum, 'no encontrado'); continue; }
    const upd = {
      primary_article_id: art.id,
      topic_review_status: 'perfect',
      verification_status: 'ok',
      verified_at: now,
      is_active: true,
      deactivation_reason: null,
    };
    if (r.explanation_fix) upd.explanation = r.explanation_fix;
    const { error } = await s.from('questions').update(upd).eq('id', r.id);
    if (error) console.error('  ❌', r.id, error.message);
    else {
      await s.from('ai_verification_results').update({ fix_applied: true, fix_applied_at: now, article_id: art.id, new_explanation: r.explanation_fix || null }).eq('question_id', r.id).eq('verified_at', now);
      console.log('  ✅', r.id.slice(0, 12), '→ art', newArtNum);
    }
  }

  // === Estado final ===
  console.log('\n=== Estado final C1 T12 ===');
  const ids = JSON.parse(fs.readFileSync('c1_t12_imported_ids.json'));
  const { data: final } = await s.from('questions').select('is_active, topic_review_status').in('id', ids);
  const active = final.filter(q => q.is_active).length;
  const statusCount = {};
  for (const q of final) statusCount[q.topic_review_status] = (statusCount[q.topic_review_status] || 0) + 1;
  console.log('Total:', ids.length, '| Activas:', active);
  console.log('Por status:', statusCount);
})();
