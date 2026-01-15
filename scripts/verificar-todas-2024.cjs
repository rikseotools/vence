/**
 * Verificar TODAS las preguntas 2024 contra el JSON original
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const indexToLetter = ['A', 'B', 'C', 'D'];

async function verificar() {
  // Leer JSON original
  const jsonData = JSON.parse(
    fs.readFileSync('./scripts/data/examen_aux_2024_informatica.json', 'utf8')
  );

  // Obtener preguntas de BD
  const { data: bdQuestions } = await supabase
    .from('questions')
    .select('*')
    .ilike('exam_source', '%diciembre 2024%');

  console.log('=== VERIFICACIÓN COMPLETA EXAMEN 2024 ===\n');
  console.log('Preguntas en JSON:', jsonData.questions.length);
  console.log('Preguntas en BD:', bdQuestions.length);
  console.log('');

  let correctas = 0;
  let errores = [];

  for (const jsonQ of jsonData.questions) {
    // Buscar en BD por texto similar
    const bdQ = bdQuestions.find(b =>
      b.question_text.substring(0, 40) === jsonQ.question_text.substring(0, 40)
    );

    if (!bdQ) {
      console.log('⚠️  No encontrada en BD:', jsonQ.id_examen);
      continue;
    }

    // Verificar respuesta correcta
    if (bdQ.correct_option !== jsonQ.correct_option) {
      errores.push({
        id: jsonQ.id_examen,
        pregunta: jsonQ.question_text.substring(0, 50),
        jsonResp: indexToLetter[jsonQ.correct_option],
        bdResp: indexToLetter[bdQ.correct_option],
        bdId: bdQ.id
      });
    } else {
      correctas++;
    }

    // Verificar que las opciones coinciden
    if (bdQ.option_a !== jsonQ.option_a ||
        bdQ.option_b !== jsonQ.option_b ||
        bdQ.option_c !== jsonQ.option_c ||
        bdQ.option_d !== jsonQ.option_d) {
      console.log('⚠️  Opciones diferentes en', jsonQ.id_examen);
      console.log('   JSON A:', jsonQ.option_a.substring(0, 30));
      console.log('   BD A:  ', bdQ.option_a.substring(0, 30));
    }
  }

  console.log('\n=== RESUMEN ===');
  console.log('✅ Correctas:', correctas);
  console.log('❌ Errores:', errores.length);

  if (errores.length > 0) {
    console.log('\n=== ERRORES ENCONTRADOS ===');
    errores.forEach(e => {
      console.log('\n❌', e.id);
      console.log('   Pregunta:', e.pregunta + '...');
      console.log('   JSON dice:', e.jsonResp);
      console.log('   BD dice:', e.bdResp);
      console.log('   ID BD:', e.bdId);
    });
  } else {
    console.log('\n🎉 Todas las preguntas están correctas');
  }
}

verificar().catch(console.error);
