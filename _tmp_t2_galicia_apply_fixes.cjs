require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ART_0 = '87fdaf7b-4bff-4ab4-bbf6-050878ca1500'; // Recién creado
const TOPIC_T2 = '5897e29d-3a55-41d9-92be-4eafb0c662d1';
const LAW_LO_1981 = 'f3fb3ef7-287b-479f-9545-0f01a257b7b8';

(async () => {
  const now = new Date().toISOString();

  // STEP 1: Add art '0' to topic_scope of T2 Galicia
  const { data: scope } = await supabase.from('topic_scope').select('article_numbers').eq('topic_id', TOPIC_T2).eq('law_id', LAW_LO_1981).single();
  const currentArts = scope.article_numbers || [];
  if (!currentArts.includes('0')) {
    const newArts = ['0', ...currentArts];
    await supabase.from('topic_scope').update({ article_numbers: newArts }).eq('topic_id', TOPIC_T2).eq('law_id', LAW_LO_1981);
    console.log('✅ Art 0 añadido al topic_scope T2 Galicia (ahora', newArts.length, 'arts)');
  } else {
    console.log('Art 0 ya en topic_scope');
  }

  // STEP 2: Reassign 3 wrong_article questions to art 0 + mark perfect
  const wrongArticleIds = [
    '0edc08f1-3533-4b9f-83f6-154e10277599', // "Qué artículos componen Título I"
    '24385fd2-0f22-43da-9bec-f05fc722b916', // "Cap II Título I título"
    '89cf296b-db9b-4399-9ac4-9bff8bb01519', // "Cuántos Capítulos Título I"
  ];
  for (const id of wrongArticleIds) {
    const { error } = await supabase.from('questions').update({
      primary_article_id: ART_0,
      topic_review_status: 'perfect',
      verification_status: 'ok',
      verified_at: now,
      is_active: true,
      deactivation_reason: null,
    }).eq('id', id);
    if (error) console.error('❌', id, error.message);
    else console.log('✅ wrong_article reassignada →', id);
  }

  // STEP 3: Fix bad_answer 99d8dd25 — opción B "mayoritario" → "proporcional"
  const BAD_ANSWER_ID = '99d8dd25-6f0b-430b-841d-18324dd719f8';
  const { data: q } = await supabase.from('questions').select('option_b, explanation').eq('id', BAD_ANSWER_ID).single();
  console.log('\nOpción B actual:', q.option_b);
  const newOptionB = q.option_b.replace(/mayoritario/gi, 'proporcional');
  console.log('Opción B nueva:', newOptionB);
  const { error: errBA } = await supabase.from('questions').update({
    option_b: newOptionB,
    topic_review_status: 'perfect',
    verification_status: 'ok',
    verified_at: now,
    is_active: true,
    deactivation_reason: null,
  }).eq('id', BAD_ANSWER_ID);
  if (errBA) console.error('❌ bad_answer fix:', errBA.message);
  else console.log('✅ bad_answer corregida');

  // STEP 4: Mark the other 42 perfect questions as perfect + reactivate
  const all = JSON.parse(fs.readFileSync('t2_galicia_consolidated.json', 'utf8'));
  const perfectIds = all.filter(r => r.status === 'perfect').map(r => r.id);
  console.log('\nMarcando', perfectIds.length, 'perfect como activas...');
  // Update in chunks
  let done = 0;
  for (let i = 0; i < perfectIds.length; i += 50) {
    const chunk = perfectIds.slice(i, i + 50);
    const { error, count } = await supabase.from('questions').update({
      topic_review_status: 'perfect',
      verification_status: 'ok',
      verified_at: now,
      is_active: true,
      deactivation_reason: null,
    }, { count: 'exact' }).in('id', chunk);
    if (error) console.error('❌', error.message);
    else done += count || chunk.length;
  }
  console.log('✅ Perfect actualizadas:', done);

  // STEP 5: Verify final state
  const allIds = all.map(r => r.id);
  const { data: finalState } = await supabase.from('questions')
    .select('id, is_active, topic_review_status')
    .in('id', allIds);
  const active = finalState.filter(q => q.is_active).length;
  const inactive = finalState.filter(q => !q.is_active).length;
  console.log('\nEstado final: ' + active + ' activas / ' + inactive + ' inactivas / ' + allIds.length + ' total');
})();
