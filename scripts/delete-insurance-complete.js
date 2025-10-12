import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteInsuranceComplete() {
  const questionId = '21eb8c08-4a18-4191-af9a-0704fc44632b';
  
  console.log('🗑️ Eliminando pregunta de seguros y datos relacionados...');
  console.log(`📋 ID: ${questionId}`);
  
  try {
    // Primero eliminar respuestas asociadas
    console.log('🔄 Eliminando respuestas asociadas...');
    const { data: answersData, error: answersError } = await supabase
      .from('psychometric_test_answers')
      .delete()
      .eq('question_id', questionId)
      .select('id');
      
    if (answersError) {
      console.error('❌ Error eliminando respuestas:', answersError);
      return;
    }
    
    console.log(`✅ ${answersData?.length || 0} respuestas eliminadas`);
    
    // Luego eliminar la pregunta
    console.log('🔄 Eliminando pregunta...');
    const { data: questionData, error: questionError } = await supabase
      .from('psychometric_questions')
      .delete()
      .eq('id', questionId)
      .select('question_text, question_subtype');
      
    if (questionError) {
      console.error('❌ Error eliminando pregunta:', questionError);
      return;
    }
    
    console.log('✅ Pregunta eliminada exitosamente');
    if (questionData && questionData.length > 0) {
      console.log(`📊 Pregunta eliminada:`);
      console.log(`   Texto: ${questionData[0].question_text}`);
      console.log(`   Tipo: ${questionData[0].question_subtype}`);
    }
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

deleteInsuranceComplete().catch(console.error);