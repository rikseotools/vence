import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteInsuranceQuestion() {
  const questionId = '21eb8c08-4a18-4191-af9a-0704fc44632b';
  
  console.log('🗑️ Eliminando pregunta de seguros...');
  console.log(`📋 ID: ${questionId}`);
  
  const { data, error } = await supabase
    .from('psychometric_questions')
    .delete()
    .eq('id', questionId)
    .select();
    
  if (error) {
    console.error('❌ Error eliminando pregunta:', error);
  } else {
    console.log('✅ Pregunta eliminada exitosamente');
    console.log('📊 Pregunta eliminada:');
    if (data && data.length > 0) {
      console.log(`   Texto: ${data[0].question_text}`);
      console.log(`   Tipo: ${data[0].question_subtype}`);
    }
  }
}

deleteInsuranceQuestion().catch(console.error);