const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Topic_scope con detalles
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select(`
      id,
      topic_id,
      article_numbers,
      weight,
      topics:topic_id(topic_number, title, position_type),
      laws:law_id(short_name)
    `)
    .order('topic_id');

  console.log('=== TOPIC_SCOPE EXISTENTES ===');
  console.log('Total:', scopes?.length);

  // Agrupar por position_type
  const byPosition = {};
  scopes?.forEach(s => {
    const pos = s.topics?.position_type || 'unknown';
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(s);
  });

  for (const [pos, items] of Object.entries(byPosition)) {
    console.log('\n--- ' + pos.toUpperCase() + ' ---');
    items.forEach(s => {
      const artCount = s.article_numbers?.length || 0;
      console.log('  T' + s.topics?.topic_number + ' (' + s.topics?.title?.substring(0, 30) + '...)');
      console.log('    -> ' + s.laws?.short_name + ': ' + artCount + ' arts');
    });
  }
})();
