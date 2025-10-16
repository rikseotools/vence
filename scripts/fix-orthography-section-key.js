import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function fixOrthographySectionKey() {
  try {
    console.log('🔧 Corrigiendo section_key de deteccion_errores → ortografia...');
    
    // Buscar la sección actual
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name, category_id')
      .eq('section_key', 'deteccion_errores')
      .single();

    if (sectionError || !section) {
      console.error('❌ Error al buscar sección deteccion_errores:', sectionError);
      return;
    }

    console.log('✅ Sección encontrada:', section.display_name);

    // Cambiar el section_key a 'ortografia'
    const { error: updateError } = await supabase
      .from('psychometric_sections')
      .update({
        section_key: 'ortografia',
        display_name: 'Ortografía'
      })
      .eq('id', section.id);

    if (updateError) {
      console.error('❌ Error al actualizar sección:', updateError);
      return;
    }

    console.log('✅ Sección actualizada exitosamente');
    console.log('📝 section_key: deteccion_errores → ortografia');
    console.log('📝 display_name: Detección de errores → Ortografía');

    // Verificar que las preguntas siguen asociadas correctamente
    const { data: questions, error: questionsError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text')
      .eq('section_id', section.id);

    if (questionsError) {
      console.error('❌ Error al verificar preguntas:', questionsError);
      return;
    }

    console.log(`\n📊 Preguntas asociadas a esta sección: ${questions?.length || 0}`);
    questions?.forEach((question, index) => {
      console.log(`${index + 1}. ${question.question_text.substring(0, 60)}...`);
    });

    console.log('\n✅ Proceso completado - Ahora la sección debería aparecer como "Ortografía" en la UI');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

fixOrthographySectionKey();