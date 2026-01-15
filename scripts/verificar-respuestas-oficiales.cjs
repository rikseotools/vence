/**
 * Verificar que las respuestas en BD coinciden con plantillas definitivas
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Plantilla DEFINITIVA 2023 - Segunda Parte (preguntas de informática 11-50)
const plantilla2023 = {
  11: 0, 12: 2, 13: 3, 14: 2, 15: 0,  // a, c, d, c, a
  16: 0, 17: 3, 18: 2, 19: 1, 20: 0,  // a, d, c, b, a
  21: 0, 22: 3, 23: 0, 24: 0, 25: 2,  // a, d, a, a, c
  26: 0, 27: 1, 28: 0, 29: 1, 30: 3,  // a, b, a, b, d
  31: 0, 32: 1, 33: 0, 34: 2, 35: 1,  // a, b, a, c, b
  36: 1, 37: 3, 38: 3, 39: 1, 40: 2,  // b, d, d, b, c
  41: 1,                               // b (SQL)
  // 42, 43 anuladas
  44: 3, 45: 2, 46: 0, 47: 3, 48: 1,  // d, c, a, d, b
  49: 3, 50: 2                         // d, c
};

// Plantilla DEFINITIVA 2024 - Segunda Parte (preguntas de informática 1-50)
const plantilla2024 = {
  1: 0, 2: 1, 3: 3, 4: 1, 5: 3,       // a, b, d, b, d
  6: 2, 7: 3, 8: 3, 9: 0, 10: 1,      // c, d, d, a, b
  11: 0, 12: 0, 13: 1, 14: 3, 15: 3,  // a, a, b, d, d
  16: 0, 17: 2, 18: 2, 19: 1, 20: 3,  // a, c, c, b, d
  21: 3, 22: 3, 23: 1, 24: 0, 25: 0,  // d, d, b, a, a
  26: 3, 27: 2, 28: 1, 29: 3, 30: 0,  // d, c, b, d, a
  31: 1, 32: 1, 33: 2, 34: 3, 35: 3,  // b, b, c, d, d
  36: 1, 37: 1, 38: 1, 39: 2, 40: 3,  // b, b, b, c, d
  41: 2, 42: 0, 43: 3, 44: 2, 45: 2,  // c, a, d, c, c
  46: 0, 47: 2, 48: 3, 49: 0, 50: 2   // a, c, d, a, c
};

const indexToLetter = ['A', 'B', 'C', 'D'];

async function verificar() {
  let errores = 0;
  let correctas = 0;

  console.log('=== VERIFICACIÓN PREGUNTAS 2023 ===\n');

  // Obtener preguntas 2023
  const { data: preguntas2023 } = await supabase
    .from('questions')
    .select('id, question_text, correct_option, option_a, option_b, option_c, option_d')
    .ilike('exam_source', '%septiembre 2023%');

  // Verificar algunas preguntas clave de 2023
  const verificaciones2023 = [
    { texto: 'Word 2019', numPlantilla: 11, esperado: 'Autoajustar a la ventana' },
    { texto: 'periférico de entrada', numPlantilla: 12, esperado: 'Cámara web' },
    { texto: 'Microsoft Edge', numPlantilla: 17, esperado: 'Microsoft Edge' },
    { texto: 'DHCP', numPlantilla: 20, esperado: 'DHCP' },
    { texto: 'Windows + E', numPlantilla: 21, esperado: 'Windows + E' },
    { texto: 'Editor de Registro', numPlantilla: 24, esperado: 'Editor de Registro' },
    { texto: 'JavaScript', numPlantilla: 30, esperado: 'JavaScript' },
    { texto: 'SQL', numPlantilla: 41, esperado: 'SQL' },
    { texto: 'SMTP', numPlantilla: 47, esperado: 'protocolo de transferencia simple' },
  ];

  for (const v of verificaciones2023) {
    const pregunta = preguntas2023.find(p => p.question_text.includes(v.texto));
    if (!pregunta) {
      console.log('⚠️  No encontrada pregunta con:', v.texto);
      continue;
    }

    const opciones = [pregunta.option_a, pregunta.option_b, pregunta.option_c, pregunta.option_d];
    const respuestaEnBD = opciones[pregunta.correct_option];
    const esperadoIndex = plantilla2023[v.numPlantilla];

    if (pregunta.correct_option === esperadoIndex) {
      console.log('✅ P' + v.numPlantilla + ': ' + indexToLetter[pregunta.correct_option] + ' = ' + respuestaEnBD.substring(0, 40));
      correctas++;
    } else {
      console.log('❌ ERROR P' + v.numPlantilla + ':');
      console.log('   BD dice: ' + indexToLetter[pregunta.correct_option] + ') ' + respuestaEnBD.substring(0, 50));
      console.log('   Plantilla dice: ' + indexToLetter[esperadoIndex]);
      errores++;
    }
  }

  console.log('\n=== VERIFICACIÓN PREGUNTAS 2024 ===\n');

  // Obtener preguntas 2024
  const { data: preguntas2024 } = await supabase
    .from('questions')
    .select('id, question_text, correct_option, option_a, option_b, option_c, option_d')
    .ilike('exam_source', '%diciembre 2024%');

  // Verificar algunas preguntas clave de 2024
  const verificaciones2024 = [
    { texto: 'disipador', numPlantilla: 15, esperado: 'd' },  // Recoger el calor del microprocesador
    { texto: 'Python', numPlantilla: 17, esperado: 'c' },      // Lenguaje de programación
    { texto: 'Apache', numPlantilla: 49, esperado: 'a' },      // Software de servidor web
    { texto: 'Copilot', numPlantilla: 48, esperado: 'd' },     // Microsoft
    { texto: 'DIASEM', numPlantilla: 38, esperado: 'b' },      // Función Excel
    { texto: 'gráfico dinámico', numPlantilla: 40, esperado: 'd' }, // Actualizar automáticamente
  ];

  for (const v of verificaciones2024) {
    const pregunta = preguntas2024.find(p => p.question_text.toLowerCase().includes(v.texto.toLowerCase()));
    if (!pregunta) {
      console.log('⚠️  No encontrada pregunta con:', v.texto);
      continue;
    }

    const opciones = [pregunta.option_a, pregunta.option_b, pregunta.option_c, pregunta.option_d];
    const respuestaEnBD = opciones[pregunta.correct_option];
    const esperadoIndex = plantilla2024[v.numPlantilla];

    if (pregunta.correct_option === esperadoIndex) {
      console.log('✅ P' + v.numPlantilla + ': ' + indexToLetter[pregunta.correct_option] + ' = ' + respuestaEnBD.substring(0, 40));
      correctas++;
    } else {
      console.log('❌ ERROR P' + v.numPlantilla + ':');
      console.log('   BD dice: ' + indexToLetter[pregunta.correct_option] + ') ' + respuestaEnBD.substring(0, 50));
      console.log('   Plantilla dice: ' + indexToLetter[esperadoIndex]);
      errores++;
    }
  }

  console.log('\n=== RESUMEN ===');
  console.log('✅ Correctas:', correctas);
  console.log('❌ Errores:', errores);

  if (errores === 0) {
    console.log('\n🎉 Todas las verificaciones pasaron correctamente');
  }
}

verificar().catch(console.error);
