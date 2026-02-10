require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('questions')
    .select('id, question_text, exam_source, is_official_exam')
    .eq('is_active', true)
    .order('question_text');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const textMap = new Map();
  data.forEach(q => {
    const normalized = q.question_text.trim().toLowerCase();
    if (!textMap.has(normalized)) {
      textMap.set(normalized, []);
    }
    textMap.get(normalized).push(q);
  });

  const duplicates = [];
  for (const [text, questions] of textMap) {
    if (questions.length > 1) {
      duplicates.push({ text: questions[0].question_text, questions });
    }
  }

  console.log('Total preguntas activas:', data.length);
  console.log('Preguntas con duplicados:', duplicates.length);
  console.log('\n===========================================\n');

  duplicates.forEach((dup, i) => {
    console.log('--- DUPLICADO', i + 1, '---');
    console.log('Texto:', dup.text.substring(0, 120) + '...');
    console.log('Copias:', dup.questions.length);
    dup.questions.forEach((q, j) => {
      console.log('  ', j + 1 + ')', q.id.substring(0, 8) + '...', q.is_official_exam ? 'OFICIAL' : 'no-oficial', '-', (q.exam_source || 'sin examen').substring(0, 60));
    });
    console.log('');
  });
})();
