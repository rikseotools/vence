require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: topics } = await s.from('topics')
    .select('id, topic_number, title, position_type')
    .eq('position_type', 'auxiliar_administrativo_cyl')
    .gte('topic_number', 15)
    .lte('topic_number', 21)
    .order('topic_number');

  if (!topics || topics.length === 0) {
    console.log('No topics found');
    return;
  }

  for (const t of topics) {
    const { data: scope } = await s.from('topic_scope')
      .select('law_id, article_numbers, laws(id, short_name, code)')
      .eq('topic_id', t.id);

    if (!scope || scope.length === 0) {
      console.log(`T${t.topic_number} | ${t.title} → NO SCOPE`);
      continue;
    }

    console.log(`\nT${t.topic_number} | ${t.title}`);
    for (const sc of scope) {
      const law = sc.laws || {};
      const artCount = sc.article_numbers ? sc.article_numbers.length : 'FULL';
      console.log(`  ${law.code || '?'} — ${law.short_name || sc.law_id} (${artCount} arts)`);
    }
  }
}

main().catch(console.error);
