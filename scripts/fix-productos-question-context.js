import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function fixProductosQuestionContext() {
  try {
    console.log('🔍 Buscando pregunta con ID específico...');
    
    // 1. Buscar la pregunta problemática
    const { data: question, error: fetchError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, content_data')
      .eq('id', 'a7e4c75b-eb83-4d34-b23a-99675b2edb16')
      .single();

    if (fetchError || !question) {
      console.error('❌ Error al buscar pregunta:', fetchError);
      return;
    }

    console.log('✅ Pregunta encontrada:', question.question_text);
    console.log('🔍 Contexto actual:', question.content_data?.question_context);

    // 2. Actualizar el content_data para corregir el question_context duplicado
    const updatedContentData = {
      ...question.content_data,
      question_context: 'Observa la siguiente tabla de ventas mensuales por productos y calcula el promedio requerido:'
    };

    // 3. Actualizar la pregunta
    console.log('📝 Actualizando question_context...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({ content_data: updatedContentData })
      .eq('id', 'a7e4c75b-eb83-4d34-b23a-99675b2edb16')
      .select('id, question_text, content_data');

    if (error) {
      console.error('❌ Error al actualizar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta actualizada exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🔧 Nuevo contexto:', data[0].content_data.question_context);
    console.log('');
    console.log('🔗 REVISAR PREGUNTA CORREGIDA:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar la función
fixProductosQuestionContext();