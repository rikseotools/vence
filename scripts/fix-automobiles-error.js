import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function fixAutomobilesError() {
  try {
    console.log('🔧 Corrigiendo error de "automobiles" → "automóviles"...');
    
    // Buscar la pregunta existente
    const { data: questions, error: searchError } = await supabase
      .from('psychometric_questions')
      .select('id, content_data')
      .eq('question_subtype', 'error_detection');

    if (searchError) {
      console.error('❌ Error al buscar pregunta:', searchError);
      return;
    }

    if (!questions || questions.length === 0) {
      console.log('⚠️ No se encontró pregunta de detección de errores');
      return;
    }

    // Corregir la explicación del error de "automobiles"
    for (const question of questions) {
      console.log(`📝 Corrigiendo explicación de pregunta ID: ${question.id}`);
      
      const updatedContentData = { ...question.content_data };
      
      // Buscar y corregir el error de automobiles
      if (updatedContentData.errors_found) {
        updatedContentData.errors_found = updatedContentData.errors_found.map(error => {
          if (error.incorrect === 'automobiles') {
            return {
              ...error,
              explanation: 'Falta tilde y se escribe con "v": automóviles'
            };
          }
          return error;
        });
      }
      
      const { error: updateError } = await supabase
        .from('psychometric_questions')
        .update({
          content_data: updatedContentData
        })
        .eq('id', question.id);

      if (updateError) {
        console.error(`❌ Error al actualizar pregunta ${question.id}:`, updateError);
      } else {
        console.log(`✅ Pregunta ${question.id} corregida exitosamente`);
        console.log('📝 Explicación corregida: "Falta tilde y se escribe con v: automóviles"');
      }
    }

    console.log('✅ Proceso completado - Error de automobiles corregido');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

fixAutomobilesError();