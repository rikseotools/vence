const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const jsonData = require('./data/examenes-oficiales/auxiliar-administrativo-estado/OEP-2023-2024/Convocatoria 9 julio 2024.json');

const num = parseInt(process.argv[2]) || 1;
const p = jsonData.segunda_parte.preguntas[num - 1];

(async () => {
  console.log('═'.repeat(70));
  console.log('SEGUNDA PARTE - PREGUNTA ' + num + ' de 50');
  console.log('═'.repeat(70));
  console.log('');
  console.log('📋 PREGUNTA:');
  console.log(p.pregunta);
  console.log('');
  console.log('OPCIONES:');
  console.log('  A)', p.opciones.a);
  console.log('  B)', p.opciones.b);
  console.log('  C)', p.opciones.c);
  console.log('  D)', p.opciones.d);
  console.log('');
  console.log('✅ RESPUESTA CORRECTA:', p.respuesta_correcta.toUpperCase());
  console.log('');
  console.log('─'.repeat(70));
  console.log('🔍 BUSCANDO EN BD...');
  
  const searchText = p.pregunta.substring(0, 40);
  const { data } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, is_official_exam, exam_source, is_active')
    .ilike('question_text', '%' + searchText + '%');
  
  if (!data || data.length === 0) {
    console.log('❌ NO ENCONTRADA en BD - Hay que crearla');
  } else {
    data.forEach((q, i) => {
      const correctLetter = ['A', 'B', 'C', 'D'][q.correct_option];
      const status = q.is_active ? '🟢 Activa' : '🔴 Inactiva';
      console.log('');
      console.log('📌 ENCONTRADA:');
      console.log('   ID:', q.id);
      console.log('   Estado:', status);
      console.log('   Correcta BD:', correctLetter);
      console.log('   is_official:', q.is_official_exam);
      console.log('   exam_source:', q.exam_source || '(null)');
    });
  }
})();
