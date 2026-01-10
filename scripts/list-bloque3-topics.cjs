/**
 * Script para listar temas del Bloque III
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function listTopics() {
  console.log('=== Temas de Administrativo C1 (Bloque III relacionados) ===\n');

  // Buscar todos los temas de administrativo-estado
  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('position_type', 'administrativo-estado')
    .order('topic_number', { ascending: true });

  if (!topics) {
    console.log('No se encontraron temas');
    return;
  }

  console.log(`Total temas encontrados: ${topics.length}\n`);

  // Mostrar temas del Bloque III (normalmente 301-307 o similar)
  const bloque3 = topics.filter(t => t.topic_number >= 301 && t.topic_number <= 399);

  console.log('Temas del Bloque III (300s):');
  for (const t of bloque3) {
    console.log(`  T${t.topic_number}: ${t.title} (ID: ${t.id})`);
  }
  console.log();

  // También mostrar los IDs que se dieron como input
  console.log('Verificando IDs proporcionados:');
  const ids = [
    'd17fcc5f-71e6-46a4-bda6-d2fdf736151b',
    '6c8eb734-c022-45dc-b1ff-989431cc611e',
    '6be5f664-d4a2-4c17-89db-e9be6c115ad2',
    'bf5af91a-8616-45a0-8df0-b83ed330baeb',
    '892eb191-99dc-4c5a-bb52-0a40ac624019',
    '026c85a2-e96f-459d-886d-0ee63f5fe1e9'
  ];

  for (const id of ids) {
    const topic = topics.find(t => t.id === id);
    if (topic) {
      console.log(`  ${id} -> T${topic.topic_number}: ${topic.title}`);
    } else {
      console.log(`  ${id} -> NO ENCONTRADO`);
    }
  }
}

listTopics().catch(console.error);
