const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  // 1. Todos los topics por position_type
  const { data: topics } = await supabase
    .from('topics')
    .select('id, position_type, topic_number, title')
    .order('position_type')
    .order('topic_number');

  console.log('=== TODOS LOS TOPICS ===\n');

  let currentType = '';
  for (const t of topics || []) {
    if (t.position_type !== currentType) {
      currentType = t.position_type;
      console.log('\n--- ' + currentType.toUpperCase() + ' ---');
    }
    console.log('  ' + t.topic_number + ': ' + t.title?.substring(0, 65));
  }

  console.log('\n\nTotal topics:', topics?.length);

  // 2. Ver topic_scope con detalles
  console.log('\n\n=== TOPIC_SCOPE CON DETALLES ===\n');

  const { data: scopes } = await supabase
    .from('topic_scope')
    .select(`
      id,
      topic_id,
      law_id,
      article_numbers,
      topics!inner(topic_number, title, position_type),
      laws(short_name)
    `)
    .order('topic_id');

  // Agrupar por topic
  const byTopic = {};
  for (const s of scopes || []) {
    const key = s.topics?.position_type + '_' + s.topics?.topic_number;
    if (!byTopic[key]) {
      byTopic[key] = {
        position_type: s.topics?.position_type,
        topic_number: s.topics?.topic_number,
        title: s.topics?.title,
        laws: []
      };
    }
    byTopic[key].laws.push({
      law: s.laws?.short_name,
      articles: s.article_numbers?.length || 0
    });
  }

  for (const [key, topic] of Object.entries(byTopic)) {
    console.log('\n' + topic.position_type + ' - Tema ' + topic.topic_number + ': ' + topic.title?.substring(0, 50));
    for (const law of topic.laws) {
      console.log('  -> ' + law.law + ': ' + law.articles + ' artículos');
    }
  }

  // 3. Topics SIN topic_scope
  console.log('\n\n=== TOPICS SIN SCOPE CONFIGURADO ===\n');

  const topicsWithScope = new Set(scopes?.map(s => s.topic_id) || []);
  const topicsWithoutScope = topics?.filter(t => !topicsWithScope.has(t.id)) || [];

  for (const t of topicsWithoutScope) {
    console.log(t.position_type + ' - ' + t.topic_number + ': ' + t.title?.substring(0, 50));
  }

  console.log('\nTopics sin scope:', topicsWithoutScope.length);
})();
