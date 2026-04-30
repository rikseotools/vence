require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LEY_7_2014 = '1893180f-a842-4990-9661-d23d63958ff4';
const LEY_4_2019 = '3a3bb3d5-cf43-43b8-9137-ffd805dfcbd2';

(async () => {
  const consolidated = JSON.parse(fs.readFileSync('t14_galicia_consolidated.json'));
  const wrongArticleFixes = JSON.parse(fs.readFileSync('t14_galicia_wrong_article_fixes.json'));
  const now = new Date().toISOString();

  // Build wrong_article fix map
  const waFixMap = new Map();
  for (const f of wrongArticleFixes) waFixMap.set(f.id, f);

  // Preload article IDs
  const { data: ley7Arts } = await supabase.from('articles').select('id, article_number').eq('law_id', LEY_7_2014);
  const { data: ley4Arts } = await supabase.from('articles').select('id, article_number').eq('law_id', LEY_4_2019);
  const ley7Map = new Map(ley7Arts.map(a => [a.article_number, a.id]));
  const ley4Map = new Map(ley4Arts.map(a => [a.article_number, a.id]));
  const lawMap = { LEY_7_2014: ley7Map, LEY_4_2019: ley4Map };
  const lawIdMap = { LEY_7_2014, LEY_4_2019 };

  const qIds = consolidated.map(r => r.id);
  const { data: qs } = await supabase.from('questions').select('id, primary_article_id, articles(law_id)').in('id', qIds);
  const qMap = new Map(qs.map(q => [q.id, q]));

  // === 1) Save all verifications to ai_verification_results ===
  console.log('=== 1. Guardando 66 resultados en ai_verification_results ===');
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
    if (error) { console.error('  ❌', error.message); process.exit(1); }
    avrInserted += data.length;
  }
  console.log('✅ Insertadas:', avrInserted, '/', avrRows.length);

  // === 2) Apply bad_explanation fixes + activate ===
  console.log('\n=== 2. Aplicando explanation_fix (bad_explanation) ===');
  const badExps = consolidated.filter(r => r.status === 'bad_explanation' && r.explanation_fix);
  let fixedBad = 0;
  for (const r of badExps) {
    const { error } = await supabase.from('questions').update({
      explanation: r.explanation_fix,
      topic_review_status: 'perfect',
      verification_status: 'ok',
      verified_at: now,
      is_active: true,
      deactivation_reason: null,
    }).eq('id', r.id);
    if (error) { console.error('  ❌', r.id, error.message); continue; }
    fixedBad++;
    await supabase.from('ai_verification_results').update({
      fix_applied: true, fix_applied_at: now, new_explanation: r.explanation_fix,
    }).eq('question_id', r.id).eq('verified_at', now);
  }
  console.log('✅ bad_explanation corregidas y activadas:', fixedBad, '/', badExps.length);

  // === 3) Activate perfect questions ===
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
    if (error) console.error('  ❌ perfect:', error.message);
    else console.log('✅ perfect activadas:', perfectIds.length);
  }

  // === 4) Apply wrong_article fixes (remap + explanation + activate) ===
  console.log('\n=== 4. Aplicando wrong_article fixes ===');
  let fixedWA = 0;
  for (const fix of wrongArticleFixes) {
    const lawId = lawIdMap[fix.law];
    const artId = lawMap[fix.law].get(fix.new_article_number);
    if (!artId) { console.error('  ❌', fix.id, 'art not found:', fix.law, fix.new_article_number); continue; }
    const { error } = await supabase.from('questions').update({
      primary_article_id: artId,
      explanation: fix.explanation,
      topic_review_status: 'perfect',
      verification_status: 'ok',
      verified_at: now,
      is_active: true,
      deactivation_reason: null,
    }).eq('id', fix.id);
    if (error) { console.error('  ❌', fix.id, error.message); continue; }
    fixedWA++;
    await supabase.from('ai_verification_results').update({
      fix_applied: true, fix_applied_at: now,
      new_explanation: fix.explanation,
      article_id: artId, law_id: lawId,
    }).eq('question_id', fix.id).eq('verified_at', now);
    console.log('  ✅', fix.id.slice(0, 12), '→', fix.law, 'art', fix.new_article_number);
  }
  console.log('✅ wrong_article remapeadas:', fixedWA, '/', wrongArticleFixes.length);

  // === 5) Mark ambiguous and unverifiable ===
  console.log('\n=== 5. Marcando problemáticas restantes (ambiguous/unverifiable) ===');
  const problemMap = {
    ambiguous: 'Verificación IA: ambigüedad en el enunciado o defecto formal de las opciones',
    unverifiable: 'Verificación IA: artículo embebido no contiene la información necesaria para verificar',
  };
  let problemCount = 0;
  for (const r of consolidated) {
    if (!problemMap[r.status]) continue;
    const { error } = await supabase.from('questions').update({
      topic_review_status: r.status,
      verification_status: 'fail',
      verified_at: now,
      is_active: false,
      deactivation_reason: problemMap[r.status],
    }).eq('id', r.id);
    if (error) { console.error('  ❌', r.id, error.message); continue; }
    problemCount++;
  }
  console.log('⚠️  problemáticas desactivadas:', problemCount);

  // === Final state ===
  console.log('\n=== Estado final T14 Galicia ===');
  const { data: final } = await supabase.from('questions').select('is_active, topic_review_status').in('id', qIds);
  const active = final.filter(q => q.is_active).length;
  const byStatus = {};
  for (const q of final) byStatus[q.topic_review_status] = (byStatus[q.topic_review_status] || 0) + 1;
  console.log('Total:', qIds.length, '| Activas:', active, '/', qIds.length);
  console.log('Por status:', byStatus);
})();
