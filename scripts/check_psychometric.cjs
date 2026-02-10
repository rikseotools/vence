const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data } = await supabase
    .from('psychometric_questions')
    .select('id, question_text, exam_source, exam_date')
    .eq('exam_date', '2024-07-09')
    .eq('is_active', true)
    .ilike('exam_source', '%Auxiliar Administrativo Estado%');

  // Separar por tipo
  const cuadro = data.filter(q =>
    q.question_text.includes('cuadro Biblioteca') ||
    q.question_text.includes('cuadro Laboratorios')
  );
  const otras = data.filter(q =>
    !q.question_text.includes('cuadro Biblioteca') &&
    !q.question_text.includes('cuadro Laboratorios')
  );

  console.log('Del cuadro (REALES del examen):', cuadro.length);
  console.log('Otras (NO son del examen julio 2024):', otras.length);
  console.log('');

  console.log('=== PREGUNTAS DEL CUADRO (Primera parte) ===');
  cuadro.forEach((q, i) => {
    console.log((i+1) + ')', q.question_text.substring(0, 55) + '...');
    console.log('   exam_source:', q.exam_source?.substring(0, 70));
  });

  console.log('');
  console.log('=== OTRAS PREGUNTAS (NO del examen) ===');
  otras.slice(0, 5).forEach((q, i) => {
    console.log((i+1) + ')', q.question_text.substring(0, 55) + '...');
  });
  if (otras.length > 5) {
    console.log('... y', otras.length - 5, 'más');
  }
})();
