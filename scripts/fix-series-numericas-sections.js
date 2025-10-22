// Script para arreglar las subcategorías de Series numéricas
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function fixSections() {
  try {
    const supabase = getSupabase();
    
    // Buscar categoría "Series numéricas"
    const { data: category } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'series-numericas')
      .single();
      
    console.log(`📋 Categoría: ${category.display_name}`);
    
    // Buscar todas las secciones
    const { data: allSections } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .eq('category_id', category.id);
      
    console.log('\n📋 Secciones actuales:');
    allSections?.forEach(sec => {
      console.log(`   - ${sec.section_key}: ${sec.display_name} (ID: ${sec.id})`);
    });
    
    // Verificar cuántas preguntas hay en cada sección
    for (const section of allSections || []) {
      const { data: questions, count } = await supabase
        .from('psychometric_questions')
        .select('id', { count: 'exact' })
        .eq('section_id', section.id);
        
      console.log(`   📊 ${section.section_key}: ${count || 0} preguntas`);
    }
    
    // Si hay más de una sección, mantener solo la que tiene preguntas
    if (allSections && allSections.length > 1) {
      console.log('\n🔧 Hay múltiples secciones. Consolidando...');
      
      // Encontrar la sección que tiene nuestra pregunta
      let sectionWithQuestion = null;
      for (const section of allSections) {
        const { data } = await supabase
          .from('psychometric_questions')
          .select('id')
          .eq('section_id', section.id)
          .eq('id', 'fb259e88-f01c-4105-885c-1e1da63d5b84');
          
        if (data && data.length > 0) {
          sectionWithQuestion = section;
          break;
        }
      }
      
      if (sectionWithQuestion) {
        console.log(`✅ Pregunta está en: ${sectionWithQuestion.display_name}`);
        
        // Eliminar las otras secciones (que están vacías)
        const sectionsToDelete = allSections.filter(s => s.id !== sectionWithQuestion.id);
        
        for (const section of sectionsToDelete) {
          console.log(`🗑️ Eliminando sección vacía: ${section.display_name}`);
          
          const { error } = await supabase
            .from('psychometric_sections')
            .delete()
            .eq('id', section.id);
            
          if (error) {
            console.log(`❌ Error eliminando ${section.display_name}:`, error.message);
          } else {
            console.log(`✅ Eliminada: ${section.display_name}`);
          }
        }
      }
    }
    
    console.log('\n📊 VERIFICAR RESULTADO:');
    console.log(`   http://localhost:3000/psicotecnicos/test`);
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

fixSections();