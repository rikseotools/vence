const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Obtener ID de la Resolución de 2014
  const { data: law } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .ilike('short_name', '%Res. 20/01/2014%')
    .single();

  if (!law) {
    console.log('No se encontró la Resolución de 2014');
    return;
  }

  console.log('Ley encontrada:', law.short_name);
  console.log('ID:', law.id);

  // Listar todos los artículos de la resolución
  const { data: allArts } = await supabase
    .from('articles')
    .select('id, article_number, title, content')
    .eq('law_id', law.id)
    .order('article_number');

  console.log('\nTodos los artículos de la Resolución (' + (allArts?.length || 0) + '):');
  for (const a of allArts || []) {
    console.log('\n--- Artículo', a.article_number, '---');
    console.log('Título:', a.title || '(sin título)');

    // Buscar conceptos específicos en el contenido
    const content = a.content || '';
    if (content.includes('21.') || content.includes('210') || content.includes('212') ||
        content.includes('214') || content.includes('215') || content.includes('216') ||
        content.toLowerCase().includes('reparaciones') || content.toLowerCase().includes('mantenimiento')) {
      console.log('Contenido (primeros 800 caracteres):');
      console.log(content.substring(0, 800));
    }
  }
})();
