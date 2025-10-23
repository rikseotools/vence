import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addSerieCiclicaPregunta43() {
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
      question_text: "Averigüe el número que continuaría la siguiente serie: 2, 4, 8, 4, 6, 12, 6, 8, ?",
      content_data: {
        pattern_type: "cyclical",
        solution_method: "manual"
      },
      explanation: `🔍 Análisis de la serie:
• Esta es una serie cíclica que combina operaciones correlativas e intercaladas
• El patrón se repite cada cierto número de términos

📊 Patrón identificado:
• Esquema matemático: +2, ×2, ÷2; y se va repitiendo a lo largo de toda la serie
• Serie: 2 (+2) → 4 (×2) → 8 (÷2) → 4 (+2) → 6 (×2) → 12 (÷2) → 6 (+2) → 8 (×2) → ?

✅ Aplicando el patrón:
• El último número de la serie es 8
• Según el esquema cíclico: 8 × 2 = 16

La respuesta correcta es B: 16`,
      question_subtype: "sequence_numeric",
      option_a: "15",
      option_b: "16",
      option_c: "4", 
      option_d: "10",
      correct_option: 1, // B = 16
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

    console.log('✅ Pregunta 43 - Serie cíclica añadida exitosamente');
    console.log('📝 ID:', data[0]?.id);
    console.log('✅ Respuesta correcta: B (16)');
    console.log('🔄 Reutiliza el componente SequenceNumericQuestion existente');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

// Ejecutar directamente
addSerieCiclicaPregunta43();