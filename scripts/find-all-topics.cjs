/**
 * Script para encontrar todos los temas
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function findTopics() {
  // Buscar directamente por los IDs
  const ids = [
    'd17fcc5f-71e6-46a4-bda6-d2fdf736151b',
    '6c8eb734-c022-45dc-b1ff-989431cc611e',
    '6be5f664-d4a2-4c17-89db-e9be6c115ad2',
    'bf5af91a-8616-45a0-8df0-b83ed330baeb',
    '892eb191-99dc-4c5a-bb52-0a40ac624019',
    '026c85a2-e96f-459d-886d-0ee63f5fe1e9'
  ];

  console.log('=== Buscando temas por ID ===\n');

  for (const id of ids) {
    const { data: topic, error } = await supabase
      .from('topics')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.log(`${id}: Error - ${error.message}`);
    } else if (topic) {
      console.log(`${id}:`);
      console.log(`  Número: ${topic.topic_number}`);
      console.log(`  Título: ${topic.title}`);
      console.log(`  Tipo: ${topic.position_type}`);
      console.log(`  Activo: ${topic.is_active}`);
    } else {
      console.log(`${id}: No encontrado`);
    }
    console.log();
  }

  // Listar todos los position_types únicos
  console.log('=== Position types en la base de datos ===\n');
  const { data: allTopics } = await supabase
    .from('topics')
    .select('position_type')
    .limit(1000);

  if (allTopics) {
    const types = [...new Set(allTopics.map(t => t.position_type))];
    console.log('Types únicos:', types.join(', '));
  }

  // Contar temas por tipo
  console.log('\n=== Conteo por tipo ===\n');
  const { data: topics2 } = await supabase
    .from('topics')
    .select('position_type, id');

  if (topics2) {
    const counts = {};
    for (const t of topics2) {
      counts[t.position_type] = (counts[t.position_type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(counts)) {
      console.log(`  ${type}: ${count} temas`);
    }
  }
}

findTopics().catch(console.error);
