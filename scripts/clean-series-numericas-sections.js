// Script para limpiar subcategorías innecesarias en Series numéricas
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function cleanSections() {
  try {
    const supabase = getSupabase();
    
    // Buscar categoría "Series numéricas"
    const { data: category } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'series-numericas')
      .single();
      
    console.log(`📋 Categoría: ${category.display_name}`);
    
    // Buscar TODAS las secciones en esta categoría
    const { data: allSections } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .eq('category_id', category.id);
      
    console.log('\n📋 Secciones encontradas:');
    allSections?.forEach(sec => {
      console.log(`   - ${sec.section_key}: ${sec.display_name}`);
    });
    
    // Eliminar TODAS las secciones actuales
    if (allSections && allSections.length > 0) {
      console.log('\n🗑️ Eliminando todas las secciones existentes...');
      
      const { error: deleteError } = await supabase
        .from('psychometric_sections')
        .delete()
        .eq('category_id', category.id);
        
      if (deleteError) {
        console.log('❌ Error eliminando secciones:', deleteError.message);
        return;
      }
      
      console.log(`✅ Eliminadas ${allSections.length} secciones`);
    }
    
    // Crear UNA SOLA sección simple
    console.log('\n🔧 Creando una sección unificada...');
    const { data: newSection, error: createError } = await supabase
      .from('psychometric_sections')
      .insert([{
        category_id: category.id,
        section_key: 'general',
        display_name: 'General',
        is_active: true,
        display_order: 1
      }])
      .select()
      .single();
      
    if (createError) {
      console.log('❌ Error creando sección:', createError.message);
      return;
    }
    
    console.log(`✅ Sección única creada: ${newSection.display_name}`);
    
    // Mover la pregunta a la nueva sección
    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update({
        section_id: newSection.id
      })
      .eq('id', 'fb259e88-f01c-4105-885c-1e1da63d5b84');
      
    if (updateError) {
      console.log('❌ Error moviendo pregunta:', updateError.message);
      return;
    }
    
    console.log('✅ Pregunta actualizada a la nueva sección');
    
    console.log('\n📊 RESULTADO:');
    console.log('   - 1 sola sección: "General"');
    console.log('   - 1 pregunta movida correctamente');
    console.log('   - No más subcategorías innecesarias');
    
    console.log('\n🔗 VERIFICAR:');
    console.log(`   http://localhost:3000/psicotecnicos/test`);
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

cleanSections();