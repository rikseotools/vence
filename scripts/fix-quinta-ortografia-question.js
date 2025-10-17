import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function fixQuintaOrthographyQuestion() {
  try {
    console.log('🔍 Buscando quinta pregunta de ortografía para corregir...');
    
    // Find the question by its text content
    const { data: question, error: findError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, content_data')
      .eq('question_text', '¿Cuántos errores ortográficos se han cometido en la siguiente frase?')
      .contains('content_data', { original_text: 'El tahur utilizo un as que llevaba en la vocamanga de la lebita.' })
      .single();

    if (findError || !question) {
      console.error('❌ Error al buscar pregunta:', findError);
      return;
    }

    console.log('📝 Pregunta encontrada, ID:', question.id);

    // Update with corrected content
    const updatedContentData = {
      chart_type: 'error_detection',
      original_text: 'El tahur utilizo un as que llevaba en la vocamanga de la lebita.',
      correct_text: 'El tahúr utilizó un has que llevaba en la bocamanga de la levita.',
      error_count: 5,
      errors_found: [
        {
          incorrect: 'tahur',
          correct: 'tahúr',
          position: 2,
          error_type: 'acentuación',
          explanation: 'Lleva tilde: tahúr'
        },
        {
          incorrect: 'utilizo',
          correct: 'utilizó',
          position: 3,
          error_type: 'acentuación', 
          explanation: 'Lleva tilde: utilizó'
        },
        {
          incorrect: 'as',
          correct: 'has',
          position: 5,
          error_type: 'ortografía',
          explanation: 'Con "h" (verbo haber): has'
        },
        {
          incorrect: 'vocamanga',
          correct: 'bocamanga',
          position: 9,
          error_type: 'ortografía',
          explanation: 'Se escribe con "b": bocamanga'
        },
        {
          incorrect: 'lebita',
          correct: 'levita',
          position: 12,
          error_type: 'ortografía',
          explanation: 'Se escribe con "v": levita'
        }
      ],
      operation_type: 'orthographic_sentence_count',
      evaluation_description: 'Capacidad de identificar errores ortográficos en frases contextuales'
    };

    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({ content_data: updatedContentData })
      .eq('id', question.id)
      .select('id, question_text, content_data');

    if (error) {
      console.error('❌ Error al actualizar pregunta:', error);
      return;
    }

    console.log('✅ Quinta pregunta de ortografía corregida exitosamente');
    console.log('📝 ID:', question.id);
    console.log('✅ Ahora muestra correctamente 5 errores: tahur→tahúr, utilizo→utilizó, as→has, vocamanga→bocamanga, lebita→levita');

    return question.id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

fixQuintaOrthographyQuestion();