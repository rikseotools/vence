import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function simplifyErrorDetectionExplanation() {
  try {
    console.log('📝 Simplificando explicación de detección de errores ortográficos...');
    
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

    // Nueva explicación didáctica y simple
    const newExplanationSections = [
      {
        title: "📝 Análisis del texto:",
        content: "En la frase 'La cegadora luz que provenía de los automóbiles no permitía a los ciclistas avanzar la cuesta de la montaña' encontramos los siguientes errores:\n\n• cegadora → cegadora (No lleva tilde - palabra llana terminada en vocal)\n• provenía → provenía (No lleva tilde - palabra llana terminada en vocal)\n• automóbiles → automóviles (Sí lleva tilde - palabra esdrújula)\n• permitía → permitía (No lleva tilde - palabra llana terminada en vocal)\n• cuesta → cuesta (No lleva tilde - palabra llana terminada en vocal)\n\nEn este caso, todas las palabras están correctamente escritas.\nRespuesta: 0 errores ortográficos."
      }
    ];

    // Actualizar cada pregunta
    for (const question of questions) {
      console.log(`📝 Actualizando explicación de pregunta ID: ${question.id}`);
      
      const updatedContentData = { 
        ...question.content_data,
        explanation_sections: newExplanationSections
      };
      
      const { error: updateError } = await supabase
        .from('psychometric_questions')
        .update({
          content_data: updatedContentData
        })
        .eq('id', question.id);

      if (updateError) {
        console.error(`❌ Error al actualizar pregunta ${question.id}:`, updateError);
      } else {
        console.log(`✅ Explicación simplificada para pregunta ${question.id}`);
      }
    }

    console.log('✅ Proceso completado - Explicación simplificada y didáctica');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

simplifyErrorDetectionExplanation();