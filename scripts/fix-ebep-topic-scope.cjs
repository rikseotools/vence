const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // 1. Buscar la ley RDL 5/2015
  const { data: law } = await supabase
    .from('laws')
    .select('id, short_name')
    .eq('short_name', 'RDL 5/2015')
    .single();

  console.log('Ley:', law?.short_name, '(id:', law?.id + ')');

  // 2. Buscar todos los topic_scope que tienen esta ley
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('id, topic_id, article_numbers')
    .eq('law_id', law.id);

  console.log('');
  console.log('Topic scopes encontrados:', scopes?.length);

  let fixCount = 0;

  for (const scope of scopes || []) {
    const articles = scope.article_numbers || [];

    // Verificar si incluye artículo 101
    if (articles.includes('101')) {
      console.log('');
      console.log('⚠️ Scope', scope.id.substring(0, 8), 'incluye artículo 101');

      // Eliminar el 101
      const newArticles = articles.filter(a => a !== '101');

      console.log('  Antes:', articles.length, 'artículos');
      console.log('  Después:', newArticles.length, 'artículos');

      // Actualizar
      const { error } = await supabase
        .from('topic_scope')
        .update({ article_numbers: newArticles })
        .eq('id', scope.id);

      if (error) {
        console.log('  ❌ Error:', error.message);
      } else {
        console.log('  ✅ Corregido');
        fixCount++;
      }
    }
  }

  console.log('');
  console.log('=== RESUMEN ===');
  console.log('Topic scopes corregidos:', fixCount);
})();
