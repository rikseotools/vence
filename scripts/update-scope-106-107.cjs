const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function ensureInScope(topicId, lawId, articleNumber) {
  const { data: existing } = await supabase
    .from('topic_scope')
    .select('id, article_numbers')
    .eq('topic_id', topicId)
    .eq('law_id', lawId)
    .single();

  if (existing) {
    const articles = existing.article_numbers || [];
    if (!articles.includes(articleNumber)) {
      await supabase.from('topic_scope').update({ article_numbers: [...articles, articleNumber] }).eq('id', existing.id);
      return 'added';
    }
    return 'exists';
  } else {
    await supabase.from('topic_scope').insert({ topic_id: topicId, law_id: lawId, article_numbers: [articleNumber], weight: 0.5 });
    return 'created';
  }
}

(async () => {
  // Obtener topic_id para topic_number 6 y 7
  const { data: topics } = await supabase
    .from('topics')
    .select('id, topic_number, title')
    .eq('position_type', 'administrativo')
    .in('topic_number', [6, 7]);

  const topicMap = {};
  for (const t of topics || []) {
    topicMap[t.topic_number] = t.id;
    console.log('Topic', t.topic_number, ':', t.title?.substring(0, 30), '- ID:', t.id);
  }

  // Procesar T106 (topic 6)
  console.log('\nActualizando scope para T106 (topic 6):');
  const { data: q106 } = await supabase
    .from('questions')
    .select('primary_article_id, articles!primary_article_id(article_number, law_id, laws(short_name))')
    .contains('tags', ['T106'])
    .eq('is_active', true);

  let added106 = 0;
  for (const q of q106 || []) {
    if (q.articles) {
      const result = await ensureInScope(topicMap[6], q.articles.law_id, q.articles.article_number);
      if (result === 'added' || result === 'created') {
        console.log('  +', q.articles.laws?.short_name, 'Art.', q.articles.article_number);
        added106++;
      }
    }
  }
  console.log('  Total añadidos:', added106);

  // Procesar T107 (topic 7)
  console.log('\nActualizando scope para T107 (topic 7):');
  const { data: q107 } = await supabase
    .from('questions')
    .select('primary_article_id, articles!primary_article_id(article_number, law_id, laws(short_name))')
    .contains('tags', ['T107'])
    .eq('is_active', true);

  let added107 = 0;
  for (const q of q107 || []) {
    if (q.articles) {
      const result = await ensureInScope(topicMap[7], q.articles.law_id, q.articles.article_number);
      if (result === 'added' || result === 'created') {
        console.log('  +', q.articles.laws?.short_name, 'Art.', q.articles.article_number);
        added107++;
      }
    }
  }
  console.log('  Total añadidos:', added107);
})();
