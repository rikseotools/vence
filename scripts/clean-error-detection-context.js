import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function cleanErrorDetectionContext() {
  try {
    console.log('🔍 Limpiando contexto repetitivo de la pregunta de detección de errores...');
    
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

    // Actualizar cada pregunta
    for (const question of questions) {
      console.log(`📝 Limpiando pregunta ID: ${question.id}`);
      
      // Remover el campo question_context que era repetitivo
      const updatedContentData = { ...question.content_data };
      delete updatedContentData.question_context;
      
      const { error: updateError } = await supabase
        .from('psychometric_questions')
        .update({
          content_data: updatedContentData
        })
        .eq('id', question.id);

      if (updateError) {
        console.error(`❌ Error al actualizar pregunta ${question.id}:`, updateError);
      } else {
        console.log(`✅ Pregunta ${question.id} limpiada exitosamente`);
        console.log(`📄 Se removió el campo question_context repetitivo`);
      }
    }

    console.log('✅ Proceso completado - Se eliminaron todos los textos repetitivos');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

cleanErrorDetectionContext();