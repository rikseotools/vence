require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: topics, error: te } = await s.from('topics')
    .select('id, topic_number, title')
    .eq('position_type', 'auxiliar_administrativo_cyl')
    .gte('topic_number', 15)
    .lte('topic_number', 21)
    .order('topic_number');

  if (te) { console.error('topics error:', te); return; }
  if (!topics || topics.length === 0) { console.log('No topics found'); return; }

  for (const t of topics) {
    const { data: scope, error: se } = await s.from('topic_scope')
      .select('law_id, article_numbers')
      .eq('topic_id', t.id);

    if (se) { console.error('scope error:', se); continue; }
    if (!scope || scope.length === 0) {
      console.log(`T${t.topic_number} | ${t.title} → NO SCOPE`);
      continue;
    }

    const lawIds = scope.map(sc => sc.law_id);
    const { data: laws, error: le } = await s.from('laws')
      .select('id, short_name, code')
      .in('id', lawIds);

    if (le) { console.error('laws error:', le); continue; }
    const lawMap = {};
    (laws || []).forEach(l => { lawMap[l.id] = l; });

    console.log(`\nT${t.topic_number} | ${t.title}`);
    for (const sc of scope) {
      const law = lawMap[sc.law_id] || { short_name: sc.law_id, code: '??' };
      const artCount = sc.article_numbers ? sc.article_numbers.length : 'FULL';
      console.log(`  [${law.code || law.short_name}] ${law.short_name} (${artCount} arts)`);
    }
  }
}

main().catch(console.error);
