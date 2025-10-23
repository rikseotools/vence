import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addSerieAritmeticaPregunta44() {
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
      question_text: "¿Qué número continúa la serie? 23, 31, 39, 47, 55, ?",
      content_data: {
        pattern_type: "arithmetic",
        solution_method: "manual"
      },
      explanation: `🔍 Análisis de la serie:
• Esta es una serie aritmética con diferencia constante
• Calculamos las diferencias entre términos consecutivos

📊 Patrón identificado:
• 31 - 23 = 8
• 39 - 31 = 8
• 47 - 39 = 8
• 55 - 47 = 8
• Diferencia constante: +8

✅ Aplicando el patrón:
• Siguiente término: 55 + 8 = 63

La respuesta correcta es C: 63`,
      question_subtype: "sequence_numeric",
      option_a: "72",
      option_b: "76",
      option_c: "63",
      option_d: "68",
      correct_option: 2, // C = 63
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

    console.log('✅ Pregunta 44 - Serie aritmética añadida exitosamente');
    console.log('📝 ID:', data[0]?.id);
    console.log('✅ Respuesta correcta: C (63)');
    console.log('🔄 Reutiliza el componente SequenceNumericQuestion existente');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

// Ejecutar directamente
addSerieAritmeticaPregunta44();