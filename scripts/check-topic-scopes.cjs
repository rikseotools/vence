/**
 * Script para ver los scopes de cada tema
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

async function getScopes() {
  console.log('=== Scopes de temas del Bloque III ===\n');

  for (const [tema, topicId] of Object.entries(topicIds)) {
    const { data: scope } = await supabase
      .from('topic_scope')
      .select(`
        law_id,
        article_numbers,
        laws (
          id,
          short_name,
          name
        )
      `)
      .eq('topic_id', topicId);

    console.log(`${tema} (${topicId}):`);

    if (!scope || scope.length === 0) {
      console.log('  Sin scope definido\n');
      continue;
    }

    for (const s of scope) {
      console.log(`  - ${s.laws?.short_name || 'N/A'}: ${s.laws?.name || 'N/A'}`);
      if (s.article_numbers && s.article_numbers.length > 0) {
        console.log(`    Artículos: ${s.article_numbers.join(', ')}`);
      }
    }
    console.log();
  }
}

getScopes().catch(console.error);
