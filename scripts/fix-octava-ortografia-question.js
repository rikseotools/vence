import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function fixOctavaOrthographyQuestion() {
  try {
    console.log('🔍 Buscando octava pregunta de ortografía para corregir...');
    
    // Find the question by its text content
    const { data: question, error: findError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, content_data, option_a, option_b, option_c, option_d, correct_option')
      .eq('question_text', 'Señale la cantidad de errores ortográficos cometidos en la siguiente frase:')
      .contains('content_data', { original_text: 'Deberíamos errar ésa yegua zaina antes de que venga éste a recogerla junto a la vaya del cercado.' })
      .single();

    if (findError || !question) {
      console.error('❌ Error al buscar pregunta:', findError);
      return;
    }

    console.log('📝 Pregunta encontrada, ID:', question.id);

    // Update with corrected content - change from 5 to 4 errors
    const updatedContentData = {
      chart_type: 'error_detection',
      original_text: 'Deberíamos errar ésa yegua zaina antes de que venga éste a recogerla junto a la vaya del cercado.',
      correct_text: 'Deberíamos herrar esa yegua zaina antes de que venga este a recogerla junto a la valla del cercado.',
      error_count: 4, // Changed from 5 to 4
      errors_found: [
        {
          incorrect: 'errar',
          correct: 'herrar',
          position: 2,
          error_type: 'ortografía',
          explanation: 'Con "h" (poner herraduras): herrar'
        },
        {
          incorrect: 'ésa',
          correct: 'esa',
          position: 3,
          error_type: 'acentuación',
          explanation: 'Sin tilde: esa'
        },
        {
          incorrect: 'éste',
          correct: 'este',
          position: 10,
          error_type: 'acentuación',
          explanation: 'Sin tilde: este'
        },
        {
          incorrect: 'vaya',
          correct: 'valla',
          position: 16,
          error_type: 'ortografía',
          explanation: 'Con "ll" (muro, barrera): valla'
        }
      ],
      operation_type: 'orthographic_sentence_count',
      evaluation_description: 'Capacidad de identificar errores ortográficos en frases contextuales'
    };

    // Update both content_data and correct_option (now should be option C = 4)
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({ 
        content_data: updatedContentData,
        correct_option: 2 // C = 4 errores (índice 2)
      })
      .eq('id', question.id)
      .select('id, question_text, content_data, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al actualizar pregunta:', error);
      return;
    }

    console.log('✅ Octava pregunta de ortografía corregida exitosamente');
    console.log('📝 ID:', question.id);
    console.log('✅ Ahora muestra correctamente 4 errores (opción C)');
    console.log('✅ Errores: errar→herrar, ésa→esa, éste→este, vaya→valla');

    return question.id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

fixOctavaOrthographyQuestion();