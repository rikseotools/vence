/**
 * Script para verificar detalles de T307
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkT307() {
  const topicId = '026c85a2-e96f-459d-886d-0ee63f5fe1e9';

  console.log('=== Detalles de T307 ===\n');

  // Verificar el topic
  const { data: topic } = await supabase
    .from('topics')
    .select('*')
    .eq('id', topicId)
    .single();

  if (!topic) {
    console.log('Topic T307 no encontrado en la tabla topics');
    return;
  }

  console.log(`Topic encontrado:`);
  console.log(`  ID: ${topic.id}`);
  console.log(`  Número: ${topic.topic_number}`);
  console.log(`  Título: ${topic.title}`);
  console.log(`  Tipo: ${topic.position_type}`);
  console.log(`  Activo: ${topic.is_active}`);
  console.log();

  // Verificar scope
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('*')
    .eq('topic_id', topicId);

  console.log(`Topic scope: ${scopes?.length || 0} entradas`);
  if (scopes && scopes.length > 0) {
    for (const s of scopes) {
      console.log(`  - Law ID: ${s.law_id}, Articles: ${s.article_numbers?.join(', ') || 'todos'}`);
    }
  }
  console.log();

  // Buscar preguntas que podrían pertenecer a T307
  // Buscar leyes de igualdad
  const { data: laws } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .or('name.ilike.%igualdad%,short_name.ilike.%igualdad%');

  console.log('Leyes relacionadas con igualdad:');
  if (laws && laws.length > 0) {
    for (const law of laws) {
      console.log(`  - ${law.short_name}: ${law.name}`);

      // Contar preguntas de esa ley
      const { data: articles } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', law.id);

      if (articles && articles.length > 0) {
        const { count } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .in('primary_article_id', articles.map(a => a.id))
          .eq('is_active', true);
        console.log(`    Artículos: ${articles.length}, Preguntas: ${count || 0}`);
      }
    }
  } else {
    console.log('  Ninguna encontrada');
  }
  console.log();

  // Buscar con otras palabras clave
  console.log('Otras leyes relacionadas (violencia género, LO 3/2007):');
  const { data: laws2 } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .or('name.ilike.%violencia%,name.ilike.%género%,short_name.ilike.%3/2007%');

  if (laws2 && laws2.length > 0) {
    for (const law of laws2) {
      console.log(`  - ${law.short_name}: ${law.name}`);

      const { data: articles } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', law.id);

      if (articles && articles.length > 0) {
        const { count } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .in('primary_article_id', articles.map(a => a.id))
          .eq('is_active', true);
        console.log(`    Artículos: ${articles.length}, Preguntas: ${count || 0}`);
      }
    }
  }
}

checkT307().catch(console.error);
