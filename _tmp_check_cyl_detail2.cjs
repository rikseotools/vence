require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Check Ley 53/1984 scope for T17 specifically
  // T17 topic_id - find it
  const { data: t17 } = await s.from('topics')
    .select('id')
    .eq('position_type', 'auxiliar_administrativo_cyl')
    .eq('topic_number', 17)
    .single();
  
  console.log('T17 topic_id:', t17?.id);
  
  const { data: t17scope } = await s.from('topic_scope')
    .select('law_id, article_numbers')
    .eq('topic_id', t17.id);
  
  // Get law names for T17
  const lawIds = t17scope.map(s => s.law_id);
  const { data: laws } = await s.from('laws').select('id, short_name').in('id', lawIds);
  const lawMap = {};
  laws.forEach(l => { lawMap[l.id] = l.short_name; });
  
  console.log('\nT17 scope detail:');
  for (const sc of t17scope) {
    console.log(`  ${lawMap[sc.law_id]}: articles = ${JSON.stringify(sc.article_numbers)}`);
  }

  // Total articles in Ley 53/1984
  const { data: l53 } = await s.from('laws').select('id').ilike('short_name', 'Ley 53/1984').single();
  const { data: arts53 } = await s.from('articles').select('article_number').eq('law_id', l53.id).order('article_number');
  console.log('\nLey 53/1984 articles in DB:', arts53.length);
  console.log('First 30:', arts53.slice(0,30).map(a => a.article_number).join(', '));

  // Check if RDL 17/1977 is in any CyL topic scope
  const { data: rdl17 } = await s.from('laws').select('id, short_name').ilike('short_name', 'RDL 17/1977');
  console.log('\nRDL 17/1977 entries:', JSON.stringify(rdl17));
  for (const r of rdl17) {
    const { data: inScope } = await s.from('topic_scope').select('topic_id').eq('law_id', r.id);
    if (inScope?.length > 0) {
      // Find topic names
      const tids = inScope.map(x => x.topic_id);
      const { data: tnames } = await s.from('topics').select('topic_number, position_type, title').in('id', tids);
      console.log(`  ${r.short_name} (${r.id}) is used in:`, tnames?.map(t => `${t.position_type} T${t.topic_number}`).join(', '));
    } else {
      console.log(`  ${r.short_name} (${r.id}) not in any scope`);
    }
  }

  // Check LO 1/2004 options
  const { data: lo12004 } = await s.from('laws').select('id, short_name').like('short_name', 'LO 1/2004');
  console.log('\nLO 1/2004 entries:', JSON.stringify(lo12004));
  for (const r of lo12004) {
    const { data: inScope } = await s.from('topic_scope').select('topic_id').eq('law_id', r.id);
    if (inScope?.length > 0) {
      const tids = inScope.map(x => x.topic_id);
      const { data: tnames } = await s.from('topics').select('topic_number, position_type, title').in('id', tids);
      console.log(`  ${r.short_name} is used in:`, tnames?.map(t => `${t.position_type} T${t.topic_number}`).join(', '));
    } else {
      console.log(`  ${r.short_name} not in any scope`);
    }
  }

  // Check Decreto 24/2022 CyL
  const { data: d24 } = await s.from('laws').select('id, short_name').ilike('short_name', '%24/2022%CyL%');
  console.log('\nDecreto 24/2022 CyL:', JSON.stringify(d24));
  for (const r of (d24 || [])) {
    const { data: inScope } = await s.from('topic_scope').select('topic_id').eq('law_id', r.id);
    if (inScope?.length > 0) {
      const tids = inScope.map(x => x.topic_id);
      const { data: tnames } = await s.from('topics').select('topic_number, position_type, title').in('id', tids);
      console.log(`  ${r.short_name} is used in:`, tnames?.map(t => `${t.position_type} T${t.topic_number}`).join(', '));
    } else {
      console.log(`  ${r.short_name} not in any scope`);
    }
  }
}

main().catch(console.error);
