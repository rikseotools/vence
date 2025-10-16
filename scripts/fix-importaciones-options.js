import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function fixImportacionesOptions() {
  try {
    console.log('🔧 Actualizando opciones de respuesta para números exactos...');
    
    const questionId = '2ba122f2-d9f4-4ed5-a7e7-f6ae0c49aa4b';
    
    // Actualizar las opciones de respuesta con números exactos
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        option_a: 'Exportaciones: 75',
        option_b: 'Importaciones: 145', 
        option_c: 'Son iguales',
        option_d: 'Exportaciones: 145'
      })
      .eq('id', questionId)
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al actualizar opciones:', error);
      return;
    }

    console.log('✅ Opciones de respuesta actualizadas exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Nuevas opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b, '← CORRECTA');
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('');
    console.log('💡 Ahora las opciones muestran los totales exactos:');
    console.log('   • Exportaciones: 20+30+25 = 75');
    console.log('   • Importaciones: 45+60+40 = 145');
    console.log('   • Respuesta clara: B) Importaciones: 145');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA CON OPCIONES EXACTAS:');
    console.log(`   http://localhost:3000/debug/question/${questionId}`);

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar la función
fixImportacionesOptions();