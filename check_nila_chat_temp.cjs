const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Obtener el artículo 131 de Ley 39/2015
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', 'Ley 39/2015')
    .single();

  if (law) {
    const { data: art } = await supabase
      .from('articles')
      .select('*')
      .eq('law_id', law.id)
      .eq('article_number', '131')
      .single();

    console.log('=== ARTÍCULO 131 LEY 39/2015 ===');
    console.log('Título:', art?.title);
    console.log('\n📜 CONTENIDO COMPLETO EN BD:');
    console.log(art?.content);
  }
})();
