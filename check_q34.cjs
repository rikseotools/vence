const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const fullIds = [
    'bb0cffb2-', // Pregunta 3
    '0ed295e1-'  // Pregunta 4
  ];

  for (const prefix of fullIds) {
    const { data: questions } = await supabase
      .from('questions')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation')
      .like('id', prefix + '%');

    for (const q of questions || []) {
      console.log('═'.repeat(80));
      console.log('ID:', q.id);
      console.log('PREGUNTA COMPLETA:');
      console.log(q.question_text);
      console.log();
      console.log('OPCIONES:');
      console.log('A)', q.option_a);
      console.log('B)', q.option_b);
      console.log('C)', q.option_c);
      console.log('D)', q.option_d);
      console.log();
      console.log('RESPUESTA MARCADA:', ['A', 'B', 'C', 'D'][q.correct_option]);
      console.log();
      console.log('EXPLICACIÓN ACTUAL:');
      console.log(q.explanation || '(sin explicación)');
      console.log();
    }
  }
})();
