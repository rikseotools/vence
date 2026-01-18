const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('=== CORRIGIENDO ERRORES DEL EBEP (RDL 5/2015) ===\n');

  // 1. Buscar la ley
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', 'RDL 5/2015')
    .single();

  console.log('Ley ID:', law.id);

  // 2. Eliminar duplicado de 47bis (mantener "47bis", eliminar "47 bis")
  console.log('\n--- Corrigiendo duplicado 47bis ---');

  const { data: art47bisVersions } = await supabase
    .from('articles')
    .select('id, article_number, is_active')
    .eq('law_id', law.id)
    .or('article_number.eq.47 bis,article_number.eq.47bis');

  console.log('Versiones encontradas:');
  art47bisVersions?.forEach(a => console.log('  -', a.article_number, '(id:', a.id.substring(0, 8) + ', active:', a.is_active + ')'));

  // Desactivar la versión con espacio
  const versionConEspacio = art47bisVersions?.find(a => a.article_number === '47 bis');
  if (versionConEspacio) {
    const { error } = await supabase
      .from('articles')
      .update({ is_active: false })
      .eq('id', versionConEspacio.id);

    if (error) {
      console.log('❌ Error desactivando "47 bis":', error.message);
    } else {
      console.log('✅ Desactivado "47 bis" (manteniendo "47bis")');
    }
  }

  // 3. Eliminar artículo 149 de todos los topic_scope
  console.log('\n--- Eliminando art. 149 de topic_scope ---');

  const { data: scopesWithArt149 } = await supabase
    .from('topic_scope')
    .select('id, article_numbers')
    .eq('law_id', law.id);

  for (const scope of scopesWithArt149 || []) {
    if (scope.article_numbers?.includes('149')) {
      const newArticles = scope.article_numbers.filter(a => a !== '149');

      const { error } = await supabase
        .from('topic_scope')
        .update({ article_numbers: newArticles })
        .eq('id', scope.id);

      if (error) {
        console.log('❌ Error en scope', scope.id.substring(0, 8) + ':', error.message);
      } else {
        console.log('✅ Eliminado 149 de scope', scope.id.substring(0, 8));
      }
    }
  }

  // 4. Desactivar artículos 101 y 149 en la tabla articles
  console.log('\n--- Desactivando artículos inválidos ---');

  for (const artNum of ['101', '149']) {
    const { data: art } = await supabase
      .from('articles')
      .select('id, is_active')
      .eq('law_id', law.id)
      .eq('article_number', artNum)
      .single();

    if (art && art.is_active) {
      const { error } = await supabase
        .from('articles')
        .update({ is_active: false })
        .eq('id', art.id);

      if (error) {
        console.log('❌ Error desactivando art.', artNum + ':', error.message);
      } else {
        console.log('✅ Desactivado artículo', artNum);
      }
    } else if (art && !art.is_active) {
      console.log('ℹ️ Artículo', artNum, 'ya estaba desactivado');
    }
  }

  console.log('\n=== CORRECCIÓN COMPLETADA ===');
})();
