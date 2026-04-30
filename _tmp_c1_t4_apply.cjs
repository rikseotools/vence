require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TFUE = 'eba370d3-73d9-44a9-9865-48d2effabaf4';

(async () => {
  const dir = '/home/manuel/Documentos/github/vence/c1_t4_results';
  const files = fs.readdirSync(dir).filter(f => /^batch_\d+_result\.json$/.test(f)).sort();
  const all = [];
  for (const f of files) all.push(...JSON.parse(fs.readFileSync(dir + '/' + f)));
  const byStatus = {};
  for (const r of all) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  fs.writeFileSync('c1_t4_consolidated.json', JSON.stringify(all, null, 2));
  console.log('Consolidadas:', all.length, '| status:', byStatus);

  const now = new Date().toISOString();

  // === AVR ===
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
  if (avrErr) { console.error('❌ AVR:', avrErr.message); process.exit(1); }
  console.log('✅ AVR:', avrRows.length);

  // === bad_explanation → apply fix + activate ===
  console.log('\n=== bad_explanation ===');
  const bad = all.filter(r => r.status === 'bad_explanation' && r.explanation_fix);
  let bx = 0;
  for (const r of bad) {
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
  console.log('✅ activadas:', bx);

  // === wrong_article → remap + activate if explanation_fix exists ===
  console.log('\n=== wrong_article → remap ===');
  const wa = all.filter(r => r.status === 'wrong_article');
  let wx = 0;
  for (const r of wa) {
    const newArtNum = r.correct_article_suggestion;
    if (!newArtNum) {
      console.log('  ⚠️ sin sugerencia:', r.id.slice(0,8), '→ desactivando');
      await s.from('questions').update({
        topic_review_status: 'wrong_article', verification_status: 'fail', verified_at: now,
        is_active: false, deactivation_reason: 'Verificación IA: sin artículo correcto identificable',
      }).eq('id', r.id);
      continue;
    }
    const { data: art } = await s.from('articles').select('id').eq('law_id', TFUE).eq('article_number', newArtNum).maybeSingle();
    if (!art) {
      console.log('  ❌ art', newArtNum, 'no existe en TFUE');
      continue;
    }
    const upd = {
      primary_article_id: art.id,
      topic_review_status: 'perfect', verification_status: 'ok', verified_at: now,
      is_active: true, deactivation_reason: null,
    };
    if (r.explanation_fix) upd.explanation = r.explanation_fix;
    const { error } = await s.from('questions').update(upd).eq('id', r.id);
    if (error) console.error('  ❌', r.id, error.message);
    else {
      await s.from('ai_verification_results').update({
        fix_applied: true, fix_applied_at: now, article_id: art.id,
        new_explanation: r.explanation_fix || null,
      }).eq('question_id', r.id).eq('verified_at', now);
      wx++;
      console.log('  ✅', r.id.slice(0,8), '→ art', newArtNum);
    }
  }
  console.log('✅ remapeadas:', wx);

  // === out_of_scope → desactivar (son de CE, no TFUE) ===
  console.log('\n=== out_of_scope ===');
  const oos = all.filter(r => r.status === 'out_of_scope');
  for (const r of oos) {
    await s.from('questions').update({
      topic_review_status: 'out_of_scope', verification_status: 'fail', verified_at: now,
      is_active: false,
      deactivation_reason: 'Verificación IA: pregunta sobre Constitución Española (arts 93-96 CE sobre tratados), no sobre TFUE. Fuera del scope del T4 "Fuentes del derecho europeo"',
    }).eq('id', r.id);
    console.log('  ⚠️', r.id.slice(0,8), 'desactivada (out_of_scope)');
  }

  // === Estado final ===
  const ids = JSON.parse(fs.readFileSync('c1_t4_imported_ids.json'));
  const { data: final } = await s.from('questions').select('is_active, topic_review_status').in('id', ids);
  const active = final.filter(q => q.is_active).length;
  const sc = {};
  for (const q of final) sc[q.topic_review_status] = (sc[q.topic_review_status] || 0) + 1;
  console.log('\n=== Estado final T4 ===');
  console.log('Total:', ids.length, '| Activas:', active);
  console.log('Por status:', sc);
})();
