require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Check what single article Ley 53/1984 has in T17
  const { data: law53 } = await s.from('laws').select('id, short_name').ilike('short_name', '%53/1984%').limit(5);
  console.log('Ley 53/1984:', JSON.stringify(law53));

  if (law53 && law53.length > 0) {
    const { data: scope17 } = await s.from('topic_scope')
      .select('article_numbers')
      .eq('law_id', law53[0].id);
    console.log('Ley 53/1984 scope entries:', JSON.stringify(scope17));
    
    // Get total articles in law
    const { count } = await s.from('articles').select('id', { count: 'exact', head: true }).eq('law_id', law53[0].id);
    console.log('Total articles in Ley 53/1984:', count);
  }

  // Check if RDL 17/1977 exists
  const { data: rdl17 } = await s.from('laws').select('id, short_name').ilike('short_name', '%17/1977%').limit(5);
  console.log('\nRDL 17/1977:', JSON.stringify(rdl17));

  // Check if LO 1/2004 exists
  const { data: lo1 } = await s.from('laws').select('id, short_name').ilike('short_name', '%1/2004%').limit(5);
  console.log('LO 1/2004:', JSON.stringify(lo1));

  // Check if Decreto 24/2022 CyL exists
  const { data: d24 } = await s.from('laws').select('id, short_name').ilike('short_name', '%24/2022%').limit(5);
  console.log('Decreto 24/2022:', JSON.stringify(d24));
}

main().catch(console.error);
