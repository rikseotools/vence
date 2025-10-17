import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function getOrthographyQuestionsIds() {
  try {
    console.log('🔍 Obteniendo IDs de todas las preguntas de ortografía...');
    
    const { data: questions, error } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, content_data, created_at')
      .eq('question_subtype', 'error_detection')
      .contains('content_data', { chart_type: 'error_detection' })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener preguntas:', error);
      return;
    }

    console.log(`📝 Encontradas ${questions.length} preguntas de ortografía:`);
    console.log('');

    questions.forEach((q, index) => {
      const questionNumber = index + 1;
      console.log(`Pregunta ${questionNumber.toString().padStart(2, '0')}: http://localhost:3000/psicotecnicos/test?questionIds=${q.id}`);
    });

    console.log('');
    console.log('🔗 TODAS LAS PREGUNTAS JUNTAS:');
    const allIds = questions.map(q => q.id).join(',');
    console.log(`http://localhost:3000/psicotecnicos/test?questionIds=${allIds}`);

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

getOrthographyQuestionsIds();