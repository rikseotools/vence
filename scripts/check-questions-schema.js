import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function checkSchema() {
  try {
    const supabase = getSupabase();
    
    // Buscar una pregunta existente para ver la estructura
    const { data: questions, error } = await supabase
      .from('psychometric_questions')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }
    
    if (questions && questions.length > 0) {
      console.log('📋 COLUMNAS DISPONIBLES:');
      Object.keys(questions[0]).forEach(key => {
        console.log(`  - ${key}: ${typeof questions[0][key]}`);
      });
    } else {
      console.log('❌ No hay preguntas en la tabla');
    }
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

checkSchema();