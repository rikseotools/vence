/**
 * Script para encontrar T307
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function findT307() {
  console.log('=== Buscando tema T307 o similar ===\n');

  // Buscar por número de tema
  const { data: t307 } = await supabase
    .from('topics')
    .select('*')
    .eq('topic_number', 307)
    .eq('position_type', 'administrativo');

  if (t307 && t307.length > 0) {
    console.log('Tema 307 encontrado:');
    for (const t of t307) {
      console.log(`  ID: ${t.id}`);
      console.log(`  Título: ${t.title}`);
    }
  } else {
    console.log('Tema 307 NO encontrado');
  }
  console.log();

  // Buscar temas con "igualdad" en el título
  const { data: igualdad } = await supabase
    .from('topics')
    .select('*')
    .ilike('title', '%igualdad%');

  console.log('Temas con "igualdad" en el título:');
  if (igualdad && igualdad.length > 0) {
    for (const t of igualdad) {
      console.log(`  T${t.topic_number}: ${t.title} (${t.position_type})`);
      console.log(`    ID: ${t.id}`);
    }
  } else {
    console.log('  Ninguno encontrado');
  }
  console.log();

  // Listar todos los temas del bloque III (300s) de administrativo
  console.log('Todos los temas del Bloque III (administrativo):');
  const { data: bloque3 } = await supabase
    .from('topics')
    .select('*')
    .eq('position_type', 'administrativo')
    .gte('topic_number', 301)
    .lte('topic_number', 399)
    .order('topic_number');

  if (bloque3) {
    for (const t of bloque3) {
      console.log(`  T${t.topic_number}: ${t.title}`);
      console.log(`    ID: ${t.id}`);
    }
  }
}

findT307().catch(console.error);
