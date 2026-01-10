const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  // Get Ley 40/2015
  const { data: law } = await s.from('laws')
    .select('id, short_name')
    .ilike('short_name', '%40/2015%')
    .single();

  console.log('Ley:', law.short_name);

  // Get article 84
  const { data: art } = await s.from('articles')
    .select('*')
    .eq('law_id', law.id)
    .eq('article_number', '84')
    .single();

  console.log('\n=== ARTÍCULO 84 ===');
  console.log(art ? art.content : 'No encontrado');
})();
