// Script para añadir pregunta de serie numérica a psicotécnicos
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addSerieNumericaQuestion() {
  try {
    const supabase = getSupabase();
    
    console.log('🔍 Buscando categoría "Series Numéricas"...');
    
    // Buscar categoría
    const { data: category } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'series-numericas')
      .single();
      
    if (!category) {
      console.log('❌ Categoría "series-numericas" no encontrada');
      return;
    }
    
    console.log(`✅ Categoría: ${category.display_name}`);
    
    // Buscar o crear sección
    let { data: section } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .eq('category_id', category.id)
      .single();
      
    if (!section) {
      console.log('🔧 Creando sección "secuencias-aritmeticas"...');
      const { data: newSection } = await supabase
        .from('psychometric_sections')
        .insert([{
          category_id: category.id,
          section_key: 'secuencias-aritmeticas',
          display_name: 'Secuencias Aritméticas',
          question_type: 'sequence_numeric',
          is_active: true,
          display_order: 1
        }])
        .select()
        .single();
      section = newSection;
    }
    
    console.log(`✅ Sección: ${section.display_name}`);
    
    // ¿Podrías describir los datos específicos de la pregunta de la imagen?
    // Por ahora creo una pregunta de ejemplo:
    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: 'Continúa la siguiente serie numérica: 2, 6, 18, 54, ?',
      content_data: {
        chart_type: 'sequence_numeric',
        sequence: [2, 6, 18, 54, '?'],
        pattern_type: 'geometric',
        pattern_description: 'Cada término se multiplica por 3',
        step: 3,
        operation: 'multiplicación'
      },
      option_a: '108',
      option_b: '162',
      option_c: '216', 
      option_d: '180',
      correct_option: 1, // B = 162
      difficulty_level: 3,
      estimated_time_seconds: 90,
      question_subtype: 'text_question', // Usa componente estándar
      is_active: true
    };
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select();
      
    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }
    
    console.log('✅ Pregunta añadida exitosamente');
    console.log(`📝 ID: ${data[0]?.id}`);
    console.log(`✅ Respuesta correcta: 162 (54 × 3)`);
    
    console.log('\n🔗 REVISAR PREGUNTA:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    
    console.log('\n🎯 RUTA DEL TEST:');
    console.log(`   http://localhost:3000/psicotecnicos/${category.category_key}/${section.section_key}`);
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

// Ejecutar
addSerieNumericaQuestion();