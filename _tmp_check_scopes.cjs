require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: topics } = await s.from('topics').select('id, topic_number, title, position_type')
    .in('position_type', ['auxiliar_administrativo', 'administrativo'])
    .eq('is_active', true).order('position_type').order('topic_number');

  for (const t of topics) {
    const { data: scope } = await s.from('topic_scope').select('law_id, article_numbers').eq('topic_id', t.id);
    if (!scope || scope.length === 0) {
      console.log(t.position_type + ' T' + t.topic_number + ': ' + t.title + ' → NO SCOPE');
      continue;
    }

    const lawIds = scope.map(sc => sc.law_id);
    const { data: laws } = await s.from('laws').select('id, short_name').in('id', lawIds);
    const lawMap = {};
    (laws || []).forEach(l => { lawMap[l.id] = l.short_name; });

    console.log(t.position_type + ' T' + t.topic_number + ': ' + t.title);
    for (const sc of scope) {
      const artCount = sc.article_numbers ? sc.article_numbers.length : 'FULL';
      console.log('  ' + (lawMap[sc.law_id] || sc.law_id) + ' (' + artCount + ' arts)');
    }
  }
}

main().catch(console.error);
