/**
 * Script para encontrar preguntas que faltan en la BD
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const examData = require('../data/examenes-oficiales/auxiliar-administrativo-estado/OEP-2023-2024/Convocatoria 9 julio 2024.json');

function norm(t) {
  return t.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getKey(t) {
  return norm(t).substring(0, 35);
}

async function main() {
  console.log('=== BUSCANDO PREGUNTAS FALTANTES ===\n');

  // Obtener todas las preguntas de la BD
  const { data: dbQuestions, error: e1 } = await supabase
    .from('questions')
    .select('question_text')
    .eq('exam_date', '2024-07-09')
    .eq('is_active', true);

  const { data: dbPsycho, error: e2 } = await supabase
    .from('psychometric_questions')
    .select('question_text')
    .eq('exam_date', '2024-07-09')
    .eq('is_active', true);

  if (e1 || e2) {
    console.error('Error:', e1 || e2);
    return;
  }

  // Crear set de preguntas en BD
  const dbKeys = new Set();
  [...dbQuestions, ...dbPsycho].forEach(q => {
    dbKeys.add(getKey(q.question_text));
  });

  console.log('Preguntas en BD:', dbKeys.size);
  console.log('');

  // Buscar faltantes de primera parte
  console.log('=== PRIMERA PARTE - FALTANTES ===');
  let faltanPrimera = 0;
  examData.primera_parte?.preguntas?.forEach((p, i) => {
    const key = getKey(p.pregunta);
    const found = [...dbKeys].some(dbKey =>
      dbKey.includes(key.substring(0, 25)) || key.includes(dbKey.substring(0, 25))
    );
    if (!found) {
      faltanPrimera++;
      console.log(`P${i+1}: ${p.pregunta.substring(0, 60)}...`);
    }
  });
  console.log(`Total faltantes primera parte: ${faltanPrimera}`);

  // Buscar faltantes de segunda parte
  console.log('');
  console.log('=== SEGUNDA PARTE - FALTANTES ===');
  let faltanSegunda = 0;
  examData.segunda_parte?.preguntas?.forEach((p, i) => {
    const key = getKey(p.pregunta);
    const found = [...dbKeys].some(dbKey =>
      dbKey.includes(key.substring(0, 25)) || key.includes(dbKey.substring(0, 25))
    );
    if (!found) {
      faltanSegunda++;
      console.log(`P${i+1}: ${p.pregunta.substring(0, 60)}...`);
    }
  });
  console.log(`Total faltantes segunda parte: ${faltanSegunda}`);

  console.log('');
  console.log('=== RESUMEN ===');
  console.log('Primera parte JSON:', examData.primera_parte?.preguntas?.length);
  console.log('Primera parte faltantes:', faltanPrimera);
  console.log('Segunda parte JSON:', examData.segunda_parte?.preguntas?.length);
  console.log('Segunda parte faltantes:', faltanSegunda);
  console.log('Total faltantes:', faltanPrimera + faltanSegunda);
}

main();
