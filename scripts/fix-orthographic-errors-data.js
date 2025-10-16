import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function fixOrthographicErrorsData() {
  try {
    console.log('🔧 Corrigiendo datos de errores ortográficos...');
    
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

    // Corregir los datos - texto CON errores y explicaciones correctas
    const correctedContentData = {
      chart_type: 'error_detection',
      // Texto CON errores (sin tildes donde deberían llevar)
      original_text: 'La cegadora luz que provenia de los automobiles no permitia a los ciclistas avanzar la cuesta de la montaña.',
      // Texto correcto
      correct_text: 'La cegadora luz que provenía de los automóviles no permitía a los ciclistas avanzar la cuesta de la montaña.',
      error_count: 3, // Solo 3 errores reales
      errors_found: [
        {
          incorrect: 'provenia',
          correct: 'provenía',
          position: 8,
          error_type: 'acentuación',
          explanation: 'Falta tilde: provenía'
        },
        {
          incorrect: 'automobiles',
          correct: 'automóviles',
          position: 12,
          error_type: 'acentuación',
          explanation: 'Falta tilde: automóviles'
        },
        {
          incorrect: 'permitia',
          correct: 'permitía',
          position: 15,
          error_type: 'acentuación',
          explanation: 'Falta tilde: permitía'
        }
      ],
      operation_type: 'orthographic_error_count',
      evaluation_description: 'Capacidad de identificar errores ortográficos de acentuación en textos'
    };

    // También necesito corregir las opciones y la respuesta correcta
    const updateData = {
      content_data: correctedContentData,
      option_a: '5',
      option_b: '1', 
      option_c: '3', // Respuesta correcta: 3 errores
      option_d: '2',
      correct_option: 2 // C (3 errores)
    };

    // Actualizar cada pregunta
    for (const question of questions) {
      console.log(`📝 Corrigiendo datos de pregunta ID: ${question.id}`);
      
      const { error: updateError } = await supabase
        .from('psychometric_questions')
        .update(updateData)
        .eq('id', question.id);

      if (updateError) {
        console.error(`❌ Error al actualizar pregunta ${question.id}:`, updateError);
      } else {
        console.log(`✅ Pregunta ${question.id} corregida exitosamente`);
        console.log('📝 Texto con errores: provenia, automobiles, permitia');
        console.log('📝 Respuesta correcta: 3 errores');
      }
    }

    console.log('✅ Proceso completado - Datos corregidos con errores reales');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

fixOrthographicErrorsData();