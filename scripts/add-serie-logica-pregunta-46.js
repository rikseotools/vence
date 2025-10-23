import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addSerieLogicaPregunta46() {
  try {
    const supabase = getSupabase();
    
    // Buscar la sección de series numéricas
    const { data: sections, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id, category_id, section_key')
      .ilike('section_key', '%serie%');
    
    if (sectionError || !sections || sections.length === 0) {
      console.log('❌ Error al buscar secciones de series:', sectionError?.message || 'No sections found');
      return;
    }
    
    console.log('📋 Secciones encontradas:', sections.map(s => s.section_key));
    const section = sections[0]; // Usar la primera sección encontrada

    const questionData = {
      category_id: section.category_id,
      section_id: section.id,
      question_text: "Continúa la siguiente serie lógica: 21, 20, 40, 38, 76, 73, 146, ?",
      content_data: {
        pattern_type: "alternating_operations",
        solution_method: "manual"
      },
      explanation: `🔍 Análisis de la serie:
• Esta es una serie cíclica que alterna operaciones matemáticas
• Las operaciones siguen un esquema alterno: resta y multiplicación

📊 Patrón identificado:
• Serie alterno en las operaciones matemáticas: -1, ×2, -2, ×2, -3, ×2, -4, ...
• 21 (-1) → 20 (×2) → 40 (-2) → 38 (×2) → 76 (-3) → 73 (×2) → 146 (-4) → ?

✅ Aplicando el patrón:
• El último número es 146
• Siguiendo el esquema: 146 - 4 = 142

La respuesta correcta es D: 142`,
      question_subtype: "sequence_numeric",
      option_a: "149",
      option_b: "145",
      option_c: "292",
      option_d: "142",
      correct_option: 3, // D = 142
      is_active: true
    };

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select();

    if (error) {
      console.log('❌ Error al insertar pregunta:', error.message);
      return;
    }

    console.log('✅ Pregunta 46 - Serie lógica añadida exitosamente');
    console.log('📝 ID:', data[0]?.id);
    console.log('✅ Respuesta correcta: D (142)');
    console.log('🔄 Reutiliza el componente SequenceNumericQuestion existente');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

// Ejecutar directamente
addSerieLogicaPregunta46();