// Script temporal para obtener artículos
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Get relevant articles for Tema 2
  const { data, error } = await supabase.rpc('get_articles_for_tema2');

  if (error) {
    // Fallback: query directly
    const laws = ['Ley 39/2015', 'RD 203/2021', 'Ley 16/1985', 'RD 1708/2011'];

    for (const lawName of laws) {
      const { data: law } = await supabase.from('laws').select('id').eq('short_name', lawName).single();
      if (!law) continue;

      const relevantArts = lawName === 'Ley 39/2015' ? ['6', '16', '17', '26', '27', '28'] :
                           lawName === 'RD 203/2021' ? ['37', '38', '40', '46', '48', '51', '53'] :
                           lawName === 'Ley 16/1985' ? ['49'] :
                           lawName === 'RD 1708/2011' ? ['8', '9', '10', '11', '12'] : [];

      const { data: articles } = await supabase
        .from('articles')
        .select('id, article_number, title')
        .eq('law_id', law.id)
        .in('article_number', relevantArts)
        .order('article_number');

      console.log('\n📜 ' + lawName + ':');
      articles?.forEach(a => {
        console.log('   Art. ' + a.article_number + ' | ' + a.id + ' | ' + (a.title || '').substring(0, 55));
      });
    }
  }
})();
