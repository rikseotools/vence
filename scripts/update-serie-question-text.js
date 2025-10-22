// Script para actualizar el texto de la pregunta de serie numérica
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function updateQuestionText() {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        question_text: 'Continúa la siguiente serie numérica: 11, 11, 9, 9, 7, 7, ?'
      })
      .eq('id', 'fb259e88-f01c-4105-885c-1e1da63d5b84')
      .select();
      
    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }
    
    console.log('✅ Pregunta actualizada exitosamente');
    console.log(`📝 Nuevo texto: "Continúa la siguiente serie numérica: 11, 11, 9, 9, 7, 7, ?"`);
    console.log('\n🔗 VERIFICAR:');
    console.log(`   http://localhost:3000/debug/question/fb259e88-f01c-4105-885c-1e1da63d5b84`);
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

updateQuestionText();