require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  // Primero veamos qué position_types existen
  const { data: all } = await supabase
    .from('topics')
    .select('position_type')
    .limit(100);
  const types = [...new Set(all.map(t => t.position_type))];
  console.log('Position types:', types);

  // Buscar tramitación
  const { data: topics } = await supabase
    .from('topics')
    .select('id, topic_number, title, position_type')
    .ilike('position_type', '%tramitacion%')
    .order('topic_number');

  if (!topics || topics.length === 0) {
    console.log('No tramitación topics found');
    return;
  }

  console.log('\nTemas de Tramitación Procesal:');
  for (const topic of topics) {
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', topic.id)
      .eq('is_active', true);

    console.log('Tema ' + topic.topic_number + ': ' + (count || 0) + ' preguntas - ' + topic.title.substring(0, 45));
  }
})();
