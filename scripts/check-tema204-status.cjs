const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOPIC_ID = '45b9727b-66ba-4d05-8a1b-7cc955e7914c'; // Tema 204

(async () => {
  // Obtener leyes del topic
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('law_id')
    .eq('topic_id', TOPIC_ID);

  const lawIds = scopes?.map(s => s.law_id).filter(Boolean) || [];

  // Obtener artículos
  const { data: articles } = await supabase
    .from('articles')
    .select('id')
    .in('law_id', lawIds);

  const articleIds = articles?.map(a => a.id) || [];

  // Contar por estado
  const { data: questions } = await supabase
    .from('questions')
    .select('id, topic_review_status, verified_at, verification_status')
    .in('primary_article_id', articleIds)
    .eq('is_active', true);

  console.log('Total preguntas:', questions?.length);

  const byStatus = {};
  questions?.forEach(q => {
    const status = q.topic_review_status || (q.verified_at ? 'legacy_verified' : 'pending');
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  console.log('\nPor estado:');
  Object.entries(byStatus).sort((a,b) => b[1] - a[1]).forEach(([s, c]) => {
    console.log('  ' + s + ':', c);
  });

  // Ver las problemáticas (no perfect, no pending)
  const goodStatuses = ['perfect', 'tech_perfect', 'pending', null, undefined];
  const problems = questions?.filter(q => {
    if (!q.topic_review_status) return false;
    return !goodStatuses.includes(q.topic_review_status);
  });

  console.log('\nPreguntas con problemas (topic_review_status):');
  problems?.forEach(q => {
    console.log('  ' + q.id + ' -> ' + q.topic_review_status);
  });

  // También revisar las 6 preguntas que corregí
  const fixedIds = [
    '8e1f3025-1608-424e-8ed3-20436c9851ac',
    'e8211275-e7f5-44f3-9c55-85f4b3fe76d2',
    '4fec736b-9187-4d80-bd0f-969817bce67d',
    'f6ca2391-27fa-469a-8418-d6c243807a85',
    '13a2ed61-d873-47c3-9adb-9a855cb61d20',
    '996037f3-61f5-47d6-8bdc-c4ac42d0c186'
  ];

  console.log('\nEstado de las 6 preguntas corregidas:');
  const { data: fixed } = await supabase
    .from('questions')
    .select('id, topic_review_status')
    .in('id', fixedIds);

  fixed?.forEach(q => {
    console.log('  ' + q.id.substring(0,8) + ' -> ' + q.topic_review_status);
  });
})();
