const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Ver distribución actual de exam_position
  const { data: questions } = await supabase
    .from('questions')
    .select('exam_position, exam_source')
    .eq('is_official_exam', true);

  const counts = {};
  let nullCount = 0;
  questions?.forEach(q => {
    if (q.exam_position) {
      counts[q.exam_position] = (counts[q.exam_position] || 0) + 1;
    } else {
      nullCount++;
    }
  });

  console.log('=== DISTRIBUCIÓN ACTUAL DE exam_position ===');
  console.log('');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pos, count]) => {
      console.log(pos.padEnd(40), count);
    });
  console.log('');
  console.log('NULL (sin asignar)'.padEnd(40), nullCount);
  console.log('');
  console.log('TOTAL:', questions?.length);

  // Mostrar algunas preguntas NULL para ver si se pueden derivar
  const nullQuestions = questions?.filter(q => q.exam_position === null)?.slice(0, 10);
  if (nullQuestions.length > 0) {
    console.log('\n=== PREGUNTAS SIN exam_position (primeras 10) ===');
    nullQuestions.forEach(q => {
      console.log('  exam_source:', q.exam_source || 'NULL');
    });
  }
})();
