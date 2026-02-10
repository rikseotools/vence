/**
 * Sincronizar partes del examen: ir pregunta por pregunta del JSON
 * y marcar cada una en la BD con su parte correcta
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const examData = require('../data/examenes-oficiales/auxiliar-administrativo-estado/OEP-2023-2024/Convocatoria 9 julio 2024.json');

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50);
}

async function findInDB(preguntaText) {
  const searchKey = normalize(preguntaText);

  // Buscar en questions
  const { data: questions } = await supabase
    .from('questions')
    .select('id, question_text, exam_source')
    .ilike('exam_source', '%Auxiliar Administrativo Estado%OEP 2023-2024%')
    .eq('is_active', true);

  for (const q of questions || []) {
    if (normalize(q.question_text).includes(searchKey.substring(0, 35)) ||
        searchKey.includes(normalize(q.question_text).substring(0, 35))) {
      return { table: 'questions', ...q };
    }
  }

  // Buscar en psychometric_questions
  const { data: psychometric } = await supabase
    .from('psychometric_questions')
    .select('id, question_text, exam_source')
    .ilike('exam_source', '%Auxiliar Administrativo Estado%OEP 2023-2024%')
    .eq('is_active', true);

  for (const q of psychometric || []) {
    if (normalize(q.question_text).includes(searchKey.substring(0, 35)) ||
        searchKey.includes(normalize(q.question_text).substring(0, 35))) {
      return { table: 'psychometric_questions', ...q };
    }
  }

  return null;
}

async function updatePart(table, id, currentSource, parte) {
  // Quitar parte anterior si existe
  let newSource = currentSource
    .replace(/ - Primera parte/g, '')
    .replace(/ - Segunda parte/g, '')
    .trim();

  // Añadir nueva parte
  newSource += ` - ${parte === 'primera' ? 'Primera' : 'Segunda'} parte`;

  await supabase
    .from(table)
    .update({ exam_source: newSource })
    .eq('id', id);

  return newSource;
}

async function main() {
  console.log('=== SINCRONIZANDO PARTES DEL EXAMEN ===\n');

  let found = 0;
  let notFound = 0;
  let updated = 0;

  // PRIMERA PARTE
  console.log('--- PRIMERA PARTE (60 preguntas) ---\n');

  for (let i = 0; i < examData.primera_parte.preguntas.length; i++) {
    const p = examData.primera_parte.preguntas[i];
    const num = i + 1;

    const result = await findInDB(p.pregunta);

    if (result) {
      found++;
      const hasCorrectPart = result.exam_source?.includes('Primera parte');

      if (!hasCorrectPart) {
        if (process.argv.includes('--apply')) {
          await updatePart(result.table, result.id, result.exam_source, 'primera');
          console.log(`P${num}: ✅ Actualizada a Primera parte`);
          updated++;
        } else {
          console.log(`P${num}: ⚠️  Falta marcar Primera parte`);
          console.log(`      "${p.pregunta.substring(0, 50)}..."`);
        }
      } else {
        console.log(`P${num}: ✓ OK (Primera parte)`);
      }
    } else {
      notFound++;
      console.log(`P${num}: ❌ NO ENCONTRADA`);
      console.log(`      "${p.pregunta.substring(0, 50)}..."`);
    }
  }

  // SEGUNDA PARTE
  console.log('\n--- SEGUNDA PARTE (50 preguntas) ---\n');

  for (let i = 0; i < examData.segunda_parte.preguntas.length; i++) {
    const p = examData.segunda_parte.preguntas[i];
    const num = i + 1;

    const result = await findInDB(p.pregunta);

    if (result) {
      found++;
      const hasCorrectPart = result.exam_source?.includes('Segunda parte');

      if (!hasCorrectPart) {
        if (process.argv.includes('--apply')) {
          await updatePart(result.table, result.id, result.exam_source, 'segunda');
          console.log(`P${num}: ✅ Actualizada a Segunda parte`);
          updated++;
        } else {
          console.log(`P${num}: ⚠️  Falta marcar Segunda parte`);
          console.log(`      "${p.pregunta.substring(0, 50)}..."`);
        }
      } else {
        console.log(`P${num}: ✓ OK (Segunda parte)`);
      }
    } else {
      notFound++;
      console.log(`P${num}: ❌ NO ENCONTRADA`);
      console.log(`      "${p.pregunta.substring(0, 50)}..."`);
    }
  }

  console.log('\n=== RESUMEN ===');
  console.log('Encontradas:', found);
  console.log('No encontradas:', notFound);
  if (process.argv.includes('--apply')) {
    console.log('Actualizadas:', updated);
  } else {
    console.log('\nPara aplicar cambios: node scripts/sync_exam_parts.cjs --apply');
  }
}

main();
