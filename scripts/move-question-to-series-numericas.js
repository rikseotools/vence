// Script para mover la pregunta a la categoría "Series numéricas"
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function moveQuestionToSeriesNumericas() {
  try {
    const supabase = getSupabase();
    
    // Buscar categoría "Series numéricas"
    const { data: seriesCategory } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'series-numericas')
      .single();
      
    if (!seriesCategory) {
      console.log('❌ Categoría "series-numericas" no encontrada');
      return;
    }
    
    console.log(`✅ Categoría encontrada: ${seriesCategory.display_name}`);
    
    // Buscar o crear sección en "Series numéricas"
    let { data: section } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .eq('category_id', seriesCategory.id)
      .single();
      
    if (!section) {
      console.log('🔧 Creando sección "secuencias-aritmeticas" en Series numéricas...');
      const { data: newSection } = await supabase
        .from('psychometric_sections')
        .insert([{
          category_id: seriesCategory.id,
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
    
    // Mover la pregunta
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        category_id: seriesCategory.id,
        section_id: section.id
      })
      .eq('id', 'fb259e88-f01c-4105-885c-1e1da63d5b84')
      .select();
      
    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }
    
    console.log('✅ Pregunta movida exitosamente a "Series numéricas"');
    
    console.log('\n🔗 NUEVAS RUTAS:');
    console.log(`   📊 Categoría: http://localhost:3000/auxiliar-administrativo-estado/test/psicotecnicos/${seriesCategory.category_key}`);
    console.log(`   🎯 Sección: http://localhost:3000/auxiliar-administrativo-estado/test/psicotecnicos/${seriesCategory.category_key}?sections=${section.section_key}`);
    console.log(`   🔗 Debug: http://localhost:3000/debug/question/fb259e88-f01c-4105-885c-1e1da63d5b84`);
    
    console.log('\n📋 VERIFICAR EN:');
    console.log(`   http://localhost:3000/psicotecnicos/test`);
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

moveQuestionToSeriesNumericas();