// Script para verificar rutas de psicotécnicos
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function checkRoutes() {
  try {
    const supabase = getSupabase();
    
    // Buscar categorías y secciones disponibles
    const { data: categories } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('is_active', true)
      .order('display_order');
    
    console.log('📋 Categorías y rutas disponibles:');
    for (const cat of categories || []) {
      console.log(`\n🔹 ${cat.category_key}: ${cat.display_name}`);
      
      const { data: sections } = await supabase
        .from('psychometric_sections')
        .select('section_key, display_name')
        .eq('category_id', cat.id)
        .eq('is_active', true)
        .order('display_order');
      
      for (const sec of sections || []) {
        console.log(`   └─ ${sec.section_key}: ${sec.display_name}`);
        console.log(`      http://localhost:3000/psicotecnicos/${cat.category_key}/${sec.section_key}`);
      }
    }
    
    // Verificar nuestra pregunta específica
    console.log('\n🔍 Verificando pregunta específica:');
    const { data: question } = await supabase
      .from('psychometric_questions')
      .select(`
        id,
        question_text,
        psychometric_sections!inner(section_key, display_name,
          psychometric_categories!inner(category_key, display_name)
        )
      `)
      .eq('id', 'fb259e88-f01c-4105-885c-1e1da63d5b84')
      .single();
    
    if (question) {
      const cat = question.psychometric_sections.psychometric_categories;
      const sec = question.psychometric_sections;
      console.log(`✅ Pregunta encontrada en:`);
      console.log(`   Categoría: ${cat.category_key} (${cat.display_name})`);
      console.log(`   Sección: ${sec.section_key} (${sec.display_name})`);
      console.log(`   URL correcta: http://localhost:3000/psicotecnicos/${cat.category_key}/${sec.section_key}`);
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

checkRoutes();