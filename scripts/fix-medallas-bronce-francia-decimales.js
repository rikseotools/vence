import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function fixMedallasBronceFranciaDecimales() {
  try {
    console.log('🔧 Corrigiendo opciones con decimales...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        option_a: '12',
        option_b: 'No se puede saber',
        option_c: '10',
        option_d: '9'
      })
      .eq('id', '46786641-7956-41b8-9e2c-f40c39fd5cb1')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al actualizar pregunta:', error);
      return;
    }

    console.log('✅ Opciones corregidas exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('🎯 Nuevas opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b, '← CORRECTA');
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('');
    console.log('🔗 REVISAR PREGUNTA CORREGIDA:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

fixMedallasBronceFranciaDecimales();