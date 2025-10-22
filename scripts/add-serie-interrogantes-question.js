// Script para añadir pregunta 03 de series numéricas con interrogantes
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addSerieInterrogantesQuestion() {
  try {
    const supabase = getSupabase();
    
    console.log('🔍 Añadiendo pregunta 03: Series con interrogantes...');
    
    // Buscar categoría y sección de Series numéricas
    const { data: category } = await supabase
      .from('psychometric_categories')
      .select('id')
      .eq('category_key', 'series-numericas')
      .single();
      
    if (!category) {
      console.log('❌ Categoría "series-numericas" no encontrada');
      return;
    }
    
    const { data: section } = await supabase
      .from('psychometric_sections')
      .select('id')
      .eq('category_id', category.id)
      .single();
      
    if (!section) {
      console.log('❌ Sección de series numéricas no encontrada');
      return;
    }
    
    // Crear la pregunta
    const questionData = {
      id: randomUUID(),
      category_id: category.id,
      section_id: section.id,
      question_text: 'Dada la siguiente serie numérica, averigüe el valor de los interrogantes:\n(3-6-4), (5-15-11), (¿-¿-¿?), (12-60-44)',
      question_subtype: 'sequence_numeric',
      option_a: '2 - 4 - 8',
      option_b: '8 - 8 - 16', 
      option_c: '8 - 32 - 24',
      option_d: '4 - 8 - 16',
      correct_option: 2, // C = index 2
      explanation: 'Analizando los patrones en cada grupo:\n- Primer número: 3, 5, ?, 12 (secuencia +2, +3, +4)\n- Segundo número: se multiplica el primero por diferentes factores\n- Tercer número: se resta un valor específico del segundo\n\nPara (¿-¿-¿?): 8, 32, 24',
      is_active: true,
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select();
      
    if (error) {
      console.log('❌ Error insertando pregunta:', error.message);
      return;
    }
    
    console.log('✅ Pregunta 03 añadida exitosamente:');
    console.log(`   📝 ID: ${data[0].id}`);
    console.log(`   🎯 Texto: ${questionData.question_text.substring(0, 50)}...`);
    console.log(`   ✅ Respuesta correcta: C (${questionData.option_c})`);
    
    console.log('\n🔗 URLs de verificación:');
    console.log(`   🧪 Debug: http://localhost:3000/debug/question/${data[0].id}`);
    console.log(`   📊 Test: http://localhost:3000/psicotecnicos/test`);
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addSerieInterrogantesQuestion();