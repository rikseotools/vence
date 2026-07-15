/**
 * Script para verificar T307 con el ID correcto
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkT307() {
  const topicId = '026c85a2-8ca7-4685-8237-4001906f91a2';

  console.log('=== T307: Políticas de Igualdad ===\n');

  // Verificar scope
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select(`
      law_id,
      article_numbers,
      laws (short_name, name)
    `)
    .eq('topic_id', topicId);

  console.log(`Scope definido: ${scopes?.length || 0} entradas`);
  if (scopes && scopes.length > 0) {
    for (const s of scopes) {
      console.log(`  - ${s.laws?.short_name || 'N/A'}: ${s.laws?.name || 'N/A'}`);
      if (s.article_numbers && s.article_numbers.length > 0) {
        console.log(`    Artículos: ${s.article_numbers.join(', ')}`);
      }
    }
  } else {
    console.log('  Sin scope definido');
  }
  console.log();

  // Buscar leyes de igualdad
  console.log('Buscando leyes relacionadas con igualdad:');
  const { data: laws } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .or('name.ilike.%igualdad%,name.ilike.%género%,name.ilike.%violencia%,short_name.ilike.%3/2007%,short_name.ilike.%1/2004%,short_name.ilike.%15/2022%');

  if (laws && laws.length > 0) {
    for (const law of laws) {
      console.log(`\n  ${law.short_name}: ${law.name}`);
      console.log(`    ID: ${law.id}`);

      // Contar artículos y preguntas
      const { data: articles, count: artCount } = await supabase
        .from('articles')
        .select('id', { count: 'exact' })
        .eq('law_id', law.id);

      console.log(`    Artículos: ${artCount || 0}`);

      if (articles && articles.length > 0) {
        const { count: qCount } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .in('primary_article_id', articles.map(a => a.id))
          .eq('is_active', true);

        console.log(`    Preguntas activas: ${qCount || 0}`);

        // Contar pendientes
        const { count: pending } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .in('primary_article_id', articles.map(a => a.id))
          .or('topic_review_status.is.null,topic_review_status.eq.pending')
          .eq('is_active', true);

        console.log(`    Pendientes de verificación: ${pending || 0}`);
      }
    }
  } else {
    console.log('  Ninguna ley encontrada');
  }
}

checkT307().catch(console.error);
