import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function deleteDiferenciaMedallasQuestion() {
  try {
    console.log('🗑️ Eliminando pregunta de diferencia medallas...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .delete()
      .eq('id', '797dd55b-304f-46b5-aa54-0acc044e47e6')
      .select('id, question_text');

    if (error) {
      console.error('❌ Error al eliminar pregunta:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Pregunta eliminada exitosamente');
      console.log('📝 ID eliminado:', data[0].id);
      console.log('📊 Pregunta eliminada:', data[0].question_text);
    } else {
      console.log('⚠️ No se encontró la pregunta para eliminar');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

deleteDiferenciaMedallasQuestion();