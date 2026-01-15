/**
 * Corregir preguntas 2024 que tienen errores
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function corregir() {
  // Leer JSON original (fuente de verdad)
  const jsonData = JSON.parse(
    fs.readFileSync('./scripts/data/examen_aux_2024_informatica.json', 'utf8')
  );

  // Obtener preguntas de BD del examen 2024
  const { data: bdQuestions } = await supabase
    .from('questions')
    .select('*')
    .ilike('exam_source', '%diciembre 2024%');

  console.log('=== CORRIGIENDO PREGUNTAS EXAMEN 2024 ===\n');

  let corregidas = 0;
  let errores = 0;

  for (const jsonQ of jsonData.questions) {
    // Buscar en BD por texto similar
    const bdQ = bdQuestions.find(b =>
      b.question_text.substring(0, 40) === jsonQ.question_text.substring(0, 40)
    );

    if (!bdQ) {
      continue;
    }

    // Verificar si necesita corrección
    const needsCorrection =
      bdQ.correct_option !== jsonQ.correct_option ||
      bdQ.option_a !== jsonQ.option_a ||
      bdQ.option_b !== jsonQ.option_b ||
      bdQ.option_c !== jsonQ.option_c ||
      bdQ.option_d !== jsonQ.option_d;

    if (needsCorrection) {
      const { error } = await supabase
        .from('questions')
        .update({
          option_a: jsonQ.option_a,
          option_b: jsonQ.option_b,
          option_c: jsonQ.option_c,
          option_d: jsonQ.option_d,
          correct_option: jsonQ.correct_option,
          updated_at: new Date().toISOString()
        })
        .eq('id', bdQ.id);

      if (error) {
        console.log('❌ Error en', jsonQ.id_examen + ':', error.message);
        errores++;
      } else {
        console.log('✅ Corregida:', jsonQ.id_examen);
        corregidas++;
      }
    }
  }

  console.log('\n=== RESUMEN ===');
  console.log('✅ Corregidas:', corregidas);
  console.log('❌ Errores:', errores);
}

corregir().catch(console.error);
