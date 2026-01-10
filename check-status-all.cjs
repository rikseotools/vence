const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  // Get all topics for administrativo (the one being reviewed)
  const { data: topics } = await s.from('topics')
    .select('id, title, topic_number')
    .eq('position_type', 'administrativo')
    .order('topic_number');

  console.log('ESTADO DE TEMAS - ADMINISTRATIVO C1');
  console.log('═══════════════════════════════════════════════════════════════');

  let grandTotal = 0;
  let grandPerfect = 0;
  let currentBlock = '';

  for (const topic of topics) {
    // Detect block change
    let block = '';
    if (topic.topic_number >= 1 && topic.topic_number <= 11) block = 'BLOQUE I';
    else if (topic.topic_number >= 201 && topic.topic_number <= 204) block = 'BLOQUE II';
    else if (topic.topic_number >= 301 && topic.topic_number <= 307) block = 'BLOQUE III';
    else if (topic.topic_number >= 401 && topic.topic_number <= 409) block = 'BLOQUE IV';
    else if (topic.topic_number >= 501 && topic.topic_number <= 506) block = 'BLOQUE V';
    else if (topic.topic_number >= 601 && topic.topic_number <= 608) block = 'BLOQUE VI';

    if (block !== currentBlock) {
      console.log('\n' + block);
      console.log('─'.repeat(60));
      currentBlock = block;
    }

    // Get topic_scope to find article IDs
    const { data: scopes } = await s.from('topic_scope')
      .select('law_id, article_numbers')
      .eq('topic_id', topic.id);

    let articleIds = [];
    for (const scope of (scopes || [])) {
      if (!scope.law_id || !scope.article_numbers?.length) continue;

      const { data: articles } = await s.from('articles')
        .select('id')
        .eq('law_id', scope.law_id)
        .in('article_number', scope.article_numbers);

      if (articles) {
        articleIds.push(...articles.map(a => a.id));
      }
    }

    if (articleIds.length === 0) {
      console.log(`T${topic.topic_number.toString().padStart(3,'0')} | Sin artículos | ${topic.title.substring(0,40)}`);
      continue;
    }

    // Get questions for these articles
    const { data: questions } = await s.from('questions')
      .select('topic_review_status')
      .in('primary_article_id', articleIds)
      .eq('is_active', true);

    if (!questions || questions.length === 0) {
      console.log(`T${topic.topic_number.toString().padStart(3,'0')} | Sin preguntas | ${topic.title.substring(0,40)}`);
      continue;
    }

    const total = questions.length;
    const perfect = questions.filter(q => q.topic_review_status === 'perfect').length;
    const pending = questions.filter(q => !q.topic_review_status || q.topic_review_status === 'pending').length;
    const problems = total - perfect - pending;
    const pct = Math.round((perfect / total) * 100);

    grandTotal += total;
    grandPerfect += perfect;

    const status = pct === 100 ? '✅' : (problems > 0 ? '❌' : '⏳');
    console.log(`${status} T${topic.topic_number.toString().padStart(3,'0')} | ${total.toString().padStart(4)} preg | ${pct.toString().padStart(3)}% perfect | ${topic.title.substring(0,35)}`);

    if (problems > 0) {
      // Show breakdown of problems
      const counts = {};
      questions.forEach(q => {
        const st = q.topic_review_status || 'pending';
        if (st !== 'perfect') {
          counts[st] = (counts[st] || 0) + 1;
        }
      });
      console.log(`     └─ Problemas: ${JSON.stringify(counts)}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`TOTAL: ${grandTotal} preguntas, ${grandPerfect} perfect (${Math.round((grandPerfect/grandTotal)*100)}%)`);
})();
