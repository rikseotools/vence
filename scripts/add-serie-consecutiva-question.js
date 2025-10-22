// Script para añadir pregunta 04 de series numéricas consecutivas
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addSerieConsecutivaQuestion() {
  try {
    const supabase = getSupabase();
    
    console.log('🔍 Añadiendo pregunta 04: Serie consecutiva...');
    
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
      question_text: 'Indique el número que continúa la serie: 1-3-5-7-9-11-?',
      question_subtype: 'sequence_numeric',
      option_a: '19',
      option_b: '13', 
      option_c: '17',
      option_d: '15',
      correct_option: 1, // B = index 1
      explanation: 'Se trata de una serie de números impares consecutivos. Cada número se obtiene sumando 2 al anterior:\n1 + 2 = 3\n3 + 2 = 5\n5 + 2 = 7\n7 + 2 = 9\n9 + 2 = 11\n11 + 2 = 13',
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
    
    console.log('✅ Pregunta 04 añadida exitosamente:');
    console.log(`   📝 ID: ${data[0].id}`);
    console.log(`   🎯 Texto: ${questionData.question_text}`);
    console.log(`   ✅ Respuesta correcta: B (${questionData.option_b})`);
    
    console.log('\n🔗 URLs de verificación:');
    console.log(`   🧪 Debug: http://localhost:3000/debug/question/${data[0].id}`);
    console.log(`   📊 Test: http://localhost:3000/psicotecnicos/test`);
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addSerieConsecutivaQuestion();