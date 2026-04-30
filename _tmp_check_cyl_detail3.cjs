require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Check total article count for Ley 53/1984 (incompatibilidades)
  // and which articles are expected for T17 scope
  
  // Check total articles Ley 53/1984
  const { data: l53 } = await s.from('laws').select('id, short_name').ilike('short_name', 'Ley 53/1984').single();
  console.log('Ley 53/1984 id:', l53.id);
  const { data: arts53, count: c53 } = await s.from('articles').select('article_number').eq('law_id', l53.id).not('article_number', 'like', 'DA%').not('article_number', 'like', 'DD%').not('article_number', 'like', 'DF%').not('article_number', 'like', 'DT%');
  console.log('Ley 53/1984 numbered articles:', arts53.length);
  
  // Check articles in Ley 53/1984 with questions active
  const { data: art53ids } = await s.from('articles').select('id, article_number').eq('law_id', l53.id);
  const ids = art53ids.map(a => a.id);
  const { data: qcount } = await s.from('questions').select('primary_article_id').in('primary_article_id', ids).eq('is_active', true);
  console.log('Active questions in Ley 53/1984:', qcount.length);

  // Check what articles of 53/1984 are 'in scope' vs what's there
  // T17 only has art 7 - Artículo 7 is probably the generic one or...
  const { data: art7 } = await s.from('articles').select('id, article_number, title').eq('law_id', l53.id).eq('article_number', '7').single();
  console.log('\nLey 53/1984 Art 7:', JSON.stringify(art7));

  // Check RDL 17/1977 articles in DB (the one not in scope yet)
  const { data: rdl17_free } = await s.from('laws').select('id, short_name').eq('id', 'b39afe97-a77c-4f58-b19b-3ebf2c57e704').single();
  const { data: rdl17arts } = await s.from('articles').select('article_number').eq('law_id', rdl17_free.id).order('article_number');
  console.log('\nRDL 17/1977 (free, not in scope) article count:', rdl17arts.length);
  console.log('Articles:', rdl17arts.slice(0, 30).map(a => a.article_number).join(', '));

  // Check LO 1/2004 version used in other oposiciones
  const { data: lo1_used } = await s.from('laws').select('id, short_name').eq('id', 'f5c17b23-2547-43d2-800c-39f5ea925c2f').single();
  const { count: lo1count } = await s.from('articles').select('id', {count: 'exact', head: true}).eq('law_id', lo1_used.id);
  console.log('\nLO 1/2004 (used in other oposiciones) article count:', lo1count);

  // Check Decreto 24/2022 CyL
  const { count: d24count } = await s.from('articles').select('id', {count: 'exact', head: true}).eq('law_id', '07ca1281-51c4-466f-a1d6-b3f3bb51d1ec');
  console.log('\nDecreto 24/2022 CyL article count in DB:', d24count);
}

main().catch(console.error);
