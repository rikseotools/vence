// Script para verificar secciones en Series numéricas
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function checkSections() {
  try {
    const supabase = getSupabase();
    
    // Buscar categoría "Series numéricas"
    const { data: category } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'series-numericas')
      .single();
      
    console.log(`📋 Categoría: ${category.display_name} (${category.category_key})`);
    
    // Buscar secciones existentes
    const { data: sections, error } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name, question_type')
      .eq('category_id', category.id);
      
    console.log('\n📋 Secciones existentes:');
    if (sections && sections.length > 0) {
      sections.forEach(sec => {
        console.log(`   - ${sec.section_key}: ${sec.display_name} (${sec.question_type})`);
      });
    } else {
      console.log('   No hay secciones en esta categoría');
    }
    
    // Si no hay secciones, crear una básica
    if (!sections || sections.length === 0) {
      console.log('\n🔧 Creando sección básica...');
      const { data: newSection, error: createError } = await supabase
        .from('psychometric_sections')
        .insert([{
          category_id: category.id,
          section_key: 'series-numericas',
          display_name: 'Series Numéricas',
          is_active: true,
          display_order: 1
        }])
        .select()
        .single();
        
      if (createError) {
        console.log('❌ Error creando sección:', createError.message);
        return;
      }
      
      console.log(`✅ Sección creada: ${newSection.display_name}`);
      
      // Ahora mover la pregunta
      const { data, error: moveError } = await supabase
        .from('psychometric_questions')
        .update({
          category_id: category.id,
          section_id: newSection.id
        })
        .eq('id', 'fb259e88-f01c-4105-885c-1e1da63d5b84')
        .select();
        
      if (moveError) {
        console.log('❌ Error moviendo pregunta:', moveError.message);
        return;
      }
      
      console.log('✅ Pregunta movida exitosamente');
      
      console.log('\n🔗 RUTAS ACTUALIZADAS:');
      console.log(`   📊 Categoría: http://localhost:3000/auxiliar-administrativo-estado/test/psicotecnicos/${category.category_key}`);
      console.log(`   🎯 Sección: http://localhost:3000/auxiliar-administrativo-estado/test/psicotecnicos/${category.category_key}?sections=${newSection.section_key}`);
      console.log('\n📋 VERIFICAR EN:');
      console.log(`   http://localhost:3000/psicotecnicos/test`);
    }
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

checkSections();