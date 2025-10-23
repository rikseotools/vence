import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function deleteSeriesQuestions() {
  try {
    const supabase = getSupabase();
    
    const questionIds = [
      '215ce411-6f64-4195-986a-d1e4806551cb', // Pregunta 84
      '57bf9f54-6d43-4b98-9966-ac4befa493d2'  // Pregunta 85
    ];

    for (const questionId of questionIds) {
      const { error } = await supabase
        .from('psychometric_questions')
        .delete()
        .eq('id', questionId);

      if (error) {
        console.log(`❌ Error al eliminar pregunta ${questionId}:`, error.message);
      } else {
        console.log(`✅ Pregunta ${questionId} eliminada exitosamente`);
      }
    }

    console.log('');
    console.log('🧹 Preguntas de series numéricas eliminadas completamente');

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

deleteSeriesQuestions();