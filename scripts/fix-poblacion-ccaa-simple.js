import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function fixPoblacionCCAASimple() {
  try {
    console.log('🔧 Simplificando opciones de población...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        option_a: '200.000 habitantes',
        option_b: '250.000 habitantes',
        option_c: '300.000 habitantes',
        option_d: '350.000 habitantes',
        correct_option: 2 // C - 300.000 (más cercano a 294.628)
      })
      .eq('id', '6db5f3d6-a965-4bcf-9ac7-1d03fc28c709')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al actualizar pregunta:', error);
      return;
    }

    console.log('✅ Opciones simplificadas exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('🎯 Nuevas opciones (cálculo mental):');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('');
    console.log('💡 Cálculo mental: 2.400.000 - 2.100.000 ≈ 300.000');
    console.log('✅ Respuesta real: 294.628 → más cercana a 300.000');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA SIMPLIFICADA:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

fixPoblacionCCAASimple();