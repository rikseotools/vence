require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ids = [
  '33ad0d2d-daf5-49c6-a324-fe531e3f0127',
  'ccc00f8c-7c79-40b0-b223-90d6ab5e52de',
  '508a950d-4da5-40ad-94d1-c70ce162584a',
  'd7b8cb98-03be-4561-9a3f-98011844268a',
  'e7e48d69-8485-44be-8624-cfb533cd5995',
  'c36f20ba-1b22-4004-b495-93d2280ea969'
];

(async () => {
  const { data, error } = await supabase
    .from('questions')
    .select('id, is_active, topic_review_status, question_text')
    .in('id', ids);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('📊 Estado Final de Preguntas:\n');
  data.forEach(q => {
    const status = q.is_active ? '🟢 ACTIVA' : '🔴 DESACTIVADA';
    console.log(`${status} - ${q.id.substring(0, 8)}`);
    console.log(`   Estado: ${q.topic_review_status || 'null'}`);
    console.log(`   Texto: ${q.question_text.substring(0, 60)}...\n`);
  });

  const activeCount = data.filter(q => q.is_active).length;
  const inactiveCount = data.filter(q => !q.is_active).length;

  console.log('═══════════════════════════════════');
  console.log(`✅ Desactivadas: ${inactiveCount}/${data.length}`);
  console.log(`⚠️  Aún activas: ${activeCount}/${data.length}`);
})();
