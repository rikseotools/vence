import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function checkQuestionExplanation() {
  try {
    const supabase = getSupabase();
    
    const questionId = '215ce411-6f64-4195-986a-d1e4806551cb';
    
    const { data: question, error } = await supabase
      .from('psychometric_questions')
      .select('*')
      .eq('id', questionId)
      .single();
    
    if (error) {
      console.log('❌ Error al buscar pregunta:', error.message);
      return;
    }
    
    console.log('📋 DATOS DE LA PREGUNTA:');
    console.log('ID:', question.id);
    console.log('Tipo:', question.question_subtype);
    console.log('Texto:', question.question_text);
    console.log('');
    
    console.log('📊 CONTENT_DATA:');
    console.log(JSON.stringify(question.content_data, null, 2));
    console.log('');
    
    console.log('📝 EXPLANATION:');
    console.log('Tipo:', typeof question.explanation);
    console.log('Valor:', question.explanation);
    console.log('');
    
    console.log('🔗 Debug URL:');
    console.log(`http://localhost:3000/debug/question/${questionId}`);
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

checkQuestionExplanation();