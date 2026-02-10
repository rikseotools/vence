require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTopics() {
  console.log('=== VERIFICANDO TOPIC_ID DE PREGUNTAS 2023 ===\n');

  // Obtener las 50 preguntas de segunda parte con topic_id
  const { data: segundaParte } = await supabase
    .from('questions')
    .select('id, question_text, topic_id, exam_source')
    .eq('exam_date', '2023-01-20')
    .eq('is_active', true)
    .ilike('exam_source', '%Segunda parte%');

  console.log(`Segunda parte: ${segundaParte?.length} preguntas\n`);

  // Agrupar por topic_id
  const byTopic = {};
  segundaParte?.forEach(q => {
    const topic = q.topic_id || 'NULL';
    byTopic[topic] = (byTopic[topic] || 0) + 1;
  });

  console.log('Distribución por topic_id:');
  Object.entries(byTopic).sort((a, b) => a[0] - b[0]).forEach(([topic, count]) => {
    console.log(`  Topic ${topic}: ${count} preguntas`);
  });

  // Buscar las preguntas específicas de reservas
  console.log('\n\n📋 PREGUNTAS ESPECÍFICAS DE RESERVAS:');

  const queries = [
    { name: 'NTFS', search: 'sistema estándar' },
    { name: 'IPv4', search: 'IPv4' },
    { name: 'MODA', search: 'MODA' },
  ];

  for (const q of queries) {
    const found = segundaParte?.find(p => p.question_text.includes(q.search));
    if (found) {
      console.log(`\n${q.name}:`);
      console.log(`  topic_id: ${found.topic_id}`);
      console.log(`  exam_source: ${found.exam_source}`);
    }
  }

  // Ver qué temas corresponden a los IDs
  console.log('\n\n📋 TEMAS DEL BLOQUE II:');
  const { data: topics } = await supabase
    .from('topics')
    .select('id, title, topic_number')
    .gte('topic_number', 101)
    .lte('topic_number', 112)
    .order('topic_number');

  topics?.forEach(t => {
    console.log(`  ${t.topic_number}: ${t.title} (id: ${t.id})`);
  });
}

checkTopics().catch(console.error);
