require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const { data: allScopes } = await supabase
    .from('topic_scope')
    .select('law_id, article_numbers, topics(topic_number)');

  const artToTopics = new Map();

  for (const scope of allScopes || []) {
    const topicNum = scope.topics?.topic_number;
    if (topicNum === undefined || topicNum === null) continue;

    for (const artNum of (scope.article_numbers || [])) {
      const key = scope.law_id + ':' + artNum;
      if (!artToTopics.has(key)) artToTopics.set(key, new Set());
      artToTopics.get(key).add(topicNum);
    }
  }

  let single = 0, multi = 0, three = 0;
  for (const [key, topics] of artToTopics) {
    if (topics.size === 1) single++;
    else if (topics.size === 2) multi++;
    else three++;
  }

  console.log('Artículos en topic_scope:');
  console.log('- Con 1 tema:', single);
  console.log('- Con 2 temas:', multi);
  console.log('- Con 3+ temas:', three);
  console.log('Total:', single + multi + three);
  console.log('% multi-tema:', Math.round((multi + three) / (single + multi + three) * 100) + '%');

  // Mostrar algunos ejemplos de artículos con múltiples temas
  console.log('\nEjemplos de artículos en múltiples temas:');
  let count = 0;
  for (const [key, topics] of artToTopics) {
    if (topics.size >= 2 && count < 10) {
      console.log(key.split(':')[1], '→ Temas:', [...topics].sort((a,b) => a-b).join(', '));
      count++;
    }
  }
})();
