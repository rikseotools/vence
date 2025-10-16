import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function removeSpecificExplanation() {
  try {
    console.log('🔄 Removiendo explicación específica para usar explicación dinámica...');
    
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

    // Actualizar cada pregunta para remover explanation_sections
    for (const question of questions) {
      console.log(`📝 Removiendo explanation_sections de pregunta ID: ${question.id}`);
      
      const updatedContentData = { ...question.content_data };
      delete updatedContentData.explanation_sections;
      
      const { error: updateError } = await supabase
        .from('psychometric_questions')
        .update({
          content_data: updatedContentData
        })
        .eq('id', question.id);

      if (updateError) {
        console.error(`❌ Error al actualizar pregunta ${question.id}:`, updateError);
      } else {
        console.log(`✅ Pregunta ${question.id} actualizada para usar explicación dinámica`);
      }
    }

    console.log('✅ Proceso completado - Ahora usa explicación dinámica basada en errors_found');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

removeSpecificExplanation();