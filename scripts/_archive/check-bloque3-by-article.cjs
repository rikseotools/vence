/**
 * Script para verificar preguntas filtrando por artículos específicos del scope
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

async function getStatsFiltered() {
  console.log('=== Estado de verificación Bloque III (filtrado por artículos del scope) ===\n');

  for (const [tema, topicId] of Object.entries(topicIds)) {
    const { data: scopes } = await supabase
      .from('topic_scope')
      .select(`
        law_id,
        article_numbers,
        laws (short_name)
      `)
      .eq('topic_id', topicId);

    if (!scopes || scopes.length === 0) {
      console.log(`${tema}: Sin scope definido\n`);
      continue;
    }

    console.log(`${tema}:`);

    // Obtener artículos específicos del scope
    let articleIds = [];
    for (const scope of scopes) {
      if (scope.article_numbers && scope.article_numbers.length > 0) {
        // Buscar artículos específicos
        const { data: arts } = await supabase
          .from('articles')
          .select('id, article_number')
          .eq('law_id', scope.law_id)
          .in('article_number', scope.article_numbers);

        if (arts) {
          articleIds.push(...arts.map(a => a.id));
        }
      }
    }

    if (articleIds.length === 0) {
      console.log('  Sin artículos en scope\n');
      continue;
    }

    console.log(`  Artículos en scope: ${articleIds.length}`);

    // Pendientes
    const { count: pending } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .in('primary_article_id', articleIds)
      .or('topic_review_status.is.null,topic_review_status.eq.pending')
      .eq('is_active', true);
    console.log(`  Pendientes: ${pending || 0}`);

    // Por cada estado
    const states = ['perfect', 'bad_explanation', 'bad_answer', 'bad_answer_and_explanation',
                    'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong'];

    for (const state of states) {
      const { count } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .in('primary_article_id', articleIds)
        .eq('topic_review_status', state)
        .eq('is_active', true);
      if (count > 0) {
        console.log(`  ${state}: ${count}`);
      }
    }

    // Total
    const { count: total } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .in('primary_article_id', articleIds)
      .eq('is_active', true);
    console.log(`  TOTAL: ${total || 0}`);
    console.log();
  }
}

getStatsFiltered().catch(console.error);
