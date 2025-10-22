// Script para probar la lógica de conteo del frontend
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Simulamos la misma lógica que usa el frontend
const blockSections = {
  'series-numericas': ['series-numericas']
}

async function testCounting() {
  try {
    const supabase = getSupabase();
    
    console.log('🧪 PROBANDO LÓGICA DE CONTEO DEL FRONTEND');
    
    // Obtener preguntas como hace el frontend
    const { data, error } = await supabase
      .from('psychometric_questions')
      .select('id, category_id, question_subtype')
      .eq('is_active', true);

    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }

    // Contar para series-numericas usando la nueva lógica
    const categoryKey = 'series-numericas';
    
    // 1. Conteo total de categoria
    const categoryCount = data.filter(q => 
      q.question_subtype === 'sequence_numeric'
    ).length;
    
    console.log(`📊 Conteo total de categoría "${categoryKey}": ${categoryCount}`);
    
    // 2. Conteo por subcategorías
    const counts = {};
    
    // Inicializar contadores
    if (blockSections[categoryKey]) {
      blockSections[categoryKey].forEach(section => {
        counts[section] = 0;
      });
    }
    
    // Contar preguntas por sección
    data.forEach(question => {
      if (categoryKey === 'series-numericas') {
        if (question.question_subtype === 'sequence_numeric') {
          counts['series-numericas'] = (counts['series-numericas'] || 0) + 1;
        }
      }
    });
    
    console.log(`📊 Conteos por subcategoría:`, counts);
    
    // 3. Simular lo que mostraría el frontend
    const sectionsArray = blockSections[categoryKey] || [];
    const selectedSectionsCount = sectionsArray.length; // Asumiendo todas seleccionadas
    const totalSections = sectionsArray.length;
    const totalQuestions = categoryCount;
    
    console.log('\n🎯 LO QUE MOSTRARÍA EL FRONTEND:');
    console.log(`   "${selectedSectionsCount}/${totalSections} subcategorías • ${totalQuestions} preguntas"`);
    
    if (selectedSectionsCount === 1 && totalSections === 1 && totalQuestions === 1) {
      console.log('✅ ¡CORRECTO! Debería mostrar "1/1 subcategorías • 1 pregunta"');
    } else {
      console.log('❌ Algo está mal. Debería ser "1/1 subcategorías • 1 pregunta"');
    }
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

testCounting();