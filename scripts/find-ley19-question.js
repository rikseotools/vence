import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function findLey19Question() {
  try {
    console.log('🔍 Buscando pregunta sobre Ley 19/2013 y artículo 21...');
    
    // Buscar por opción A específica
    const { data: questions1, error: error1 } = await supabase
      .from('questions')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, article_reference, law_reference')
      .ilike('option_a', '%Solo cuando lo solicite el interesado%')
      .limit(3);

    if (questions1 && questions1.length > 0) {
      console.log('✅ Encontrada por opción A:');
      questions1.forEach((q, i) => {
        console.log(`\n--- PREGUNTA ${i + 1} ---`);
        console.log('ID:', q.id);
        console.log('Pregunta:', q.question_text);
        console.log('A)', q.option_a);
        console.log('B)', q.option_b);
        console.log('C)', q.option_c);
        console.log('D)', q.option_d);
        console.log('Correcta:', ['A', 'B', 'C', 'D'][q.correct_option]);
        console.log('Artículo:', q.article_reference);
        console.log('Ley:', q.law_reference);
      });
    }

    // Buscar por contenido del artículo 21
    console.log('\n🔍 Búsqueda alternativa por artículo 21...');
    const { data: questions2, error: error2 } = await supabase
      .from('questions')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option')
      .ilike('question_text', '%artículo 21%')
      .ilike('question_text', '%obligación de resolver%')
      .limit(3);

    if (questions2 && questions2.length > 0) {
      console.log('✅ Encontrada por texto del artículo:');
      questions2.forEach((q, i) => {
        console.log(`\n--- PREGUNTA ${i + 1} ---`);
        console.log('ID:', q.id);
        console.log('Pregunta:', q.question_text);
        console.log('A)', q.option_a);
        console.log('B)', q.option_b);
        console.log('C)', q.option_c);
        console.log('D)', q.option_d);
        console.log('Correcta:', ['A', 'B', 'C', 'D'][q.correct_option]);
      });
    }

    // Buscar por opción B
    console.log('\n🔍 Búsqueda por opción B...');
    const { data: questions3, error: error3 } = await supabase
      .from('questions')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option')
      .ilike('option_b', '%Respecto de todas las Administraciones Públicas%')
      .limit(3);

    if (questions3 && questions3.length > 0) {
      console.log('✅ Encontrada por opción B:');
      questions3.forEach((q, i) => {
        console.log(`\n--- PREGUNTA ${i + 1} ---`);
        console.log('ID:', q.id);
        console.log('Pregunta:', q.question_text);
        console.log('A)', q.option_a);
        console.log('B)', q.option_b);
        console.log('C)', q.option_c);
        console.log('D)', q.option_d);
        console.log('Correcta:', ['A', 'B', 'C', 'D'][q.correct_option]);
      });
    }

    if ((!questions1 || questions1.length === 0) && 
        (!questions2 || questions2.length === 0) && 
        (!questions3 || questions3.length === 0)) {
      console.log('❌ No se encontró ninguna pregunta con esos criterios');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar la función
findLey19Question();