// Script para debug profundo de Series numéricas
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function deepDebug() {
  try {
    const supabase = getSupabase();
    
    console.log('🔍 DEBUG PROFUNDO - Series numéricas');
    
    // 1. Buscar todas las categorías con "series" o "numeri"
    const { data: allCategories } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name, is_active')
      .or('category_key.ilike.%series%,category_key.ilike.%numeri%,display_name.ilike.%series%,display_name.ilike.%numeri%');
    
    console.log('\n📋 TODAS las categorías relacionadas con series/números:');
    allCategories?.forEach(cat => {
      console.log(`   - ${cat.category_key}: ${cat.display_name} (activa: ${cat.is_active})`);
    });
    
    // 2. Para cada categoría, buscar sus secciones
    for (const cat of allCategories || []) {
      console.log(`\n🔍 Secciones en "${cat.display_name}":`);
      
      const { data: sections } = await supabase
        .from('psychometric_sections')
        .select('id, section_key, display_name, is_active')
        .eq('category_id', cat.id);
        
      if (sections && sections.length > 0) {
        for (const sec of sections) {
          const { data: questions, count } = await supabase
            .from('psychometric_questions')
            .select('id, question_text', { count: 'exact' })
            .eq('section_id', sec.id)
            .eq('is_active', true);
            
          console.log(`   └─ ${sec.section_key}: ${sec.display_name} (activa: ${sec.is_active}) - ${count || 0} preguntas`);
          
          questions?.forEach(q => {
            console.log(`      📝 ${q.id}: ${q.question_text.substring(0, 50)}...`);
          });
        }
      } else {
        console.log('   └─ Sin secciones');
      }
    }
    
    // 3. Buscar nuestra pregunta específica
    console.log('\n🎯 PREGUNTA ESPECÍFICA:');
    const { data: ourQuestion } = await supabase
      .from('psychometric_questions')
      .select(`
        id, question_text, is_active,
        psychometric_sections!inner(section_key, display_name, is_active,
          psychometric_categories!inner(category_key, display_name, is_active)
        )
      `)
      .eq('id', 'fb259e88-f01c-4105-885c-1e1da63d5b84')
      .single();
    
    if (ourQuestion) {
      const cat = ourQuestion.psychometric_sections.psychometric_categories;
      const sec = ourQuestion.psychometric_sections;
      
      console.log(`   📝 ID: ${ourQuestion.id}`);
      console.log(`   📝 Texto: ${ourQuestion.question_text}`);
      console.log(`   📝 Activa: ${ourQuestion.is_active}`);
      console.log(`   📂 Categoría: ${cat.category_key} (${cat.display_name}) - Activa: ${cat.is_active}`);
      console.log(`   📁 Sección: ${sec.section_key} (${sec.display_name}) - Activa: ${sec.is_active}`);
    } else {
      console.log('   ❌ No se encontró nuestra pregunta');
    }
    
    // 4. Contar total real
    console.log('\n📊 CONTEO REAL:');
    
    const { data: seriesCategory } = await supabase
      .from('psychometric_categories')
      .select('id')
      .eq('category_key', 'series-numericas')
      .single();
    
    if (seriesCategory) {
      const { count: sectionsCount } = await supabase
        .from('psychometric_sections')
        .select('id', { count: 'exact' })
        .eq('category_id', seriesCategory.id)
        .eq('is_active', true);
        
      const { count: questionsCount } = await supabase
        .from('psychometric_questions')
        .select('id', { count: 'exact' })
        .eq('category_id', seriesCategory.id)
        .eq('is_active', true);
        
      console.log(`   📊 Secciones activas: ${sectionsCount || 0}`);
      console.log(`   📊 Preguntas activas: ${questionsCount || 0}`);
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

deepDebug();