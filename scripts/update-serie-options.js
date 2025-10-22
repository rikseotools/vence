// Script para verificar y actualizar las opciones de la pregunta
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function updateOptions() {
  try {
    const supabase = getSupabase();
    
    // Primero verificar el estado actual
    const { data: current } = await supabase
      .from('psychometric_questions')
      .select('option_a, option_b, option_c, option_d, correct_option')
      .eq('id', 'fb259e88-f01c-4105-885c-1e1da63d5b84')
      .single();
    
    console.log('📋 Estado actual de las opciones:');
    console.log(`  A: "${current?.option_a}"`);
    console.log(`  B: "${current?.option_b}"`);
    console.log(`  C: "${current?.option_c}"`);
    console.log(`  D: "${current?.option_d}"`);
    console.log(`  Correcta: ${current?.correct_option} (${['A','B','C','D'][current?.correct_option]})`);
    
    // Verificar si las opciones están vacías o son correctas
    if (!current?.option_a || current.option_a.trim() === '') {
      console.log('\n🔧 Actualizando opciones...');
      
      const { data, error } = await supabase
        .from('psychometric_questions')
        .update({
          option_a: '3',
          option_b: '1', 
          option_c: '5',
          option_d: '7',
          correct_option: 2 // C = 5
        })
        .eq('id', 'fb259e88-f01c-4105-885c-1e1da63d5b84')
        .select();
        
      if (error) {
        console.log('❌ Error:', error.message);
        return;
      }
      
      console.log('✅ Opciones actualizadas exitosamente');
      console.log('📝 Nuevas opciones:');
      console.log('  A: 3');
      console.log('  B: 1');
      console.log('  C: 5 ✅ (Correcta)');
      console.log('  D: 7');
    } else {
      console.log('\n✅ Las opciones ya están configuradas correctamente');
    }
    
    console.log('\n🔗 VERIFICAR:');
    console.log(`   http://localhost:3000/debug/question/fb259e88-f01c-4105-885c-1e1da63d5b84`);
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

updateOptions();