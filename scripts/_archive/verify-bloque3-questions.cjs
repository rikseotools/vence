/**
 * Script para verificar preguntas pendientes del Bloque III de Administrativo C1
 * Temas T302-T307
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const topicIds = {
  T302: 'd17fcc5f-71e6-46a4-bda6-d2fdf736151b',
  T303: '6c8eb734-c022-45dc-b1ff-989431cc611e',
  T304: '6be5f664-d4a2-4c17-89db-e9be6c115ad2',
  T305: 'bf5af91a-8616-45a0-8df0-b83ed330baeb',
  T306: '892eb191-99dc-4c5a-bb52-0a40ac624019',
  T307: '026c85a2-e96f-459d-886d-0ee63f5fe1e9'
};

async function countPendingQuestions() {
  console.log('=== Verificando preguntas pendientes por tema ===\n');

  for (const [tema, topicId] of Object.entries(topicIds)) {
    // Obtener topic scope
    const { data: scope, error: scopeError } = await supabase
      .from('topic_scope')
      .select('law_id, article_numbers')
      .eq('topic_id', topicId);

    if (scopeError) {
      console.log(`${tema}: Error scope - ${scopeError.message}`);
      continue;
    }

    if (!scope || scope.length === 0) {
      console.log(`${tema}: Sin scope definido`);
      continue;
    }

    // Obtener artículos de las leyes del scope
    const lawIds = [...new Set(scope.map(s => s.law_id))];
    const { data: articles, error: artError } = await supabase
      .from('articles')
      .select('id')
      .in('law_id', lawIds);

    if (artError || !articles) {
      console.log(`${tema}: Error artículos - ${artError?.message || 'sin data'}`);
      continue;
    }

    const articleIds = articles.map(a => a.id);

    // Contar preguntas pendientes
    const { count, error } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .in('primary_article_id', articleIds)
      .or('topic_review_status.is.null,topic_review_status.eq.pending')
      .eq('is_active', true);

    console.log(`${tema}: ${count || 0} pendientes (${scope.length} scopes, ${articleIds.length} artículos)`);
  }
}

countPendingQuestions().catch(console.error);
