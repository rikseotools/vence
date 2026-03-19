const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const topicIds = [
  { id: 'fbc4a6e6-1aaf-4366-a723-b280562e008d', title: 'T12 auxilio - Cuerpos Funcionarios' },
  { id: '4596812b-afc3-44e6-90ed-9d201547e5b3', title: 'T12 admin - Protección datos' },
  { id: 'd907ed53-34bc-4266-887a-2169685be535', title: 'T12 tramitacion - Cuerpos funcionarios' },
];

async function main() {
  for (const t of topicIds) {
    const { data: scope } = await supabase.from('topic_scope')
      .select('article_id')
      .eq('topic_id', t.id);

    if (!scope || scope.length === 0) {
      console.log(t.title + ': no scope');
      continue;
    }

    const artIds = scope.map(s => s.article_id);

    let allErrors = [];
    for (let i = 0; i < artIds.length; i += 50) {
      const batch = artIds.slice(i, i + 50);
      const { data: qs } = await supabase.from('questions')
        .select('id, topic_review_status, primary_article_id')
        .in('primary_article_id', batch)
        .in('topic_review_status', ['bad_answer', 'bad_explanation', 'bad_article', 'needs_review', 'error']);
      allErrors.push(...(qs || []));
    }

    console.log(t.title + ':', allErrors.length, 'errors');

    const statusCounts = {};
    allErrors.forEach(q => {
      statusCounts[q.topic_review_status] = (statusCounts[q.topic_review_status] || 0) + 1;
    });
    if (allErrors.length > 0) console.log('  Breakdown:', statusCounts);
  }

  // Also check all remaining error counts per topic
  console.log('\n--- ALL TOPICS WITH ERRORS ---');
  const { data: allTopics } = await supabase.from('topics')
    .select('id, title, topic_number, position_type')
    .order('topic_number');

  for (const t of allTopics) {
    const { data: scope } = await supabase.from('topic_scope')
      .select('article_id')
      .eq('topic_id', t.id);

    if (!scope || scope.length === 0) continue;

    const artIds = scope.map(s => s.article_id);

    let allErrors = [];
    for (let i = 0; i < artIds.length; i += 50) {
      const batch = artIds.slice(i, i + 50);
      const { data: qs } = await supabase.from('questions')
        .select('id, topic_review_status')
        .in('primary_article_id', batch)
        .in('topic_review_status', ['bad_answer', 'bad_explanation', 'bad_article', 'needs_review', 'error']);
      allErrors.push(...(qs || []));
    }

    if (allErrors.length > 0) {
      console.log(`T${t.topic_number} [${t.position_type}] "${t.title}": ${allErrors.length} errors`);
    }
  }
}

main().catch(console.error);
