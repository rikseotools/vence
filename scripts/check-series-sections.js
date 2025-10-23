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
    
    // Buscar todas las categorías
    const { data: categories, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('*')
      .order('display_order');
    
    if (categoryError) {
      console.log('❌ Error al buscar categorías:', categoryError.message);
      return;
    }
    
    console.log('📋 CATEGORÍAS DISPONIBLES:');
    categories.forEach(cat => {
      console.log(`  - ${cat.category_key}: ${cat.display_name}`);
    });
    
    // Buscar secciones relacionadas con series
    const { data: sections, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select(`
        *,
        psychometric_categories!inner(category_key, display_name)
      `)
      .order('display_order');
    
    if (sectionError) {
      console.log('❌ Error al buscar secciones:', sectionError.message);
      return;
    }
    
    console.log('\n📋 SECCIONES DISPONIBLES:');
    sections.forEach(section => {
      console.log(`  - ${section.psychometric_categories.category_key}/${section.section_key}: ${section.display_name}`);
    });
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

checkSections();