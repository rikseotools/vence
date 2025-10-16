import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function fixErrorDetectionDuplication() {
  try {
    console.log('🔍 Buscando pregunta de detección de errores...');
    
    // Buscar la pregunta existente
    const { data: questions, error: searchError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text')
      .eq('question_subtype', 'error_detection');

    if (searchError) {
      console.error('❌ Error al buscar pregunta:', searchError);
      return;
    }

    if (!questions || questions.length === 0) {
      console.log('⚠️ No se encontró pregunta de detección de errores');
      return;
    }

    console.log(`✅ Encontradas ${questions.length} pregunta(s) de detección de errores`);

    // Actualizar cada pregunta
    for (const question of questions) {
      console.log(`📝 Actualizando pregunta ID: ${question.id}`);
      console.log(`📄 Texto anterior: ${question.question_text}`);
      
      const { error: updateError } = await supabase
        .from('psychometric_questions')
        .update({
          question_text: 'Identifica todos los errores ortográficos en el texto presentado. ¿Cuántos errores ortográficos encuentras?'
        })
        .eq('id', question.id);

      if (updateError) {
        console.error(`❌ Error al actualizar pregunta ${question.id}:`, updateError);
      } else {
        console.log(`✅ Pregunta ${question.id} actualizada exitosamente`);
        console.log(`📄 Nuevo texto: 'Identifica todos los errores ortográficos en el texto presentado. ¿Cuántos errores ortográficos encuentras?'`);
      }
    }

    console.log('✅ Proceso completado - Se eliminó la duplicación del texto');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

fixErrorDetectionDuplication();