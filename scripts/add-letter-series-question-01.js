import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addLetterSeriesQuestion01() {
  try {
    const supabase = getSupabase();
    
    // Buscar la categoría de series de letras
    const { data: categories, error: catError } = await supabase
      .from('psychometric_categories')
      .select('*')
      .eq('category_key', 'series-letras');
    
    if (catError || !categories || categories.length === 0) {
      console.log('❌ Error al buscar categoría de series de letras:', catError?.message || 'No category found');
      return;
    }
    
    const category = categories[0];
    console.log('✅ Categoría encontrada:', category.display_name);

    // Buscar o crear sección de series de letras correlativas
    let section;
    const { data: sections, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('*')
      .eq('category_id', category.id)
      .eq('section_key', 'series-letras-correlativas');

    if (sectionError) {
      console.log('❌ Error al buscar secciones:', sectionError.message);
      return;
    }

    if (sections && sections.length > 0) {
      section = sections[0];
      console.log('✅ Sección encontrada:', section.display_name);
    } else {
      // Crear la sección
      console.log('📝 Creando nueva sección: series-letras-correlativas');
      const { data: newSection, error: createError } = await supabase
        .from('psychometric_sections')
        .insert([{
          category_id: category.id,
          section_key: 'series-letras-correlativas',
          display_name: 'Series de letras correlativas',
          description: 'Series de letras que siguen patrones correlativas y lógicos',
          is_active: true
        }])
        .select();

      if (createError) {
        console.log('❌ Error al crear sección:', createError.message);
        return;
      }

      section = newSection[0];
      console.log('✅ Sección creada:', section.display_name);
    }

    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: "¿Qué letra continúa la serie? c, d, c, d, e, e, f, e, f, g, ?",
      content_data: {
        pattern_type: "correlative_letter",
        solution_method: "manual",
        sequence: ["c", "d", "c", "d", "e", "e", "f", "e", "f", "g", "?"]
      },
      explanation: `🔍 Análisis de la serie de letras:
• Serie de letras correlativas con patrón de repetición específico
• Se repite una serie de 2 letras, luego la siguiente letra se repite dos veces

📊 Patrón identificado:
• Se repite una serie de 2 letras: c,d
• La siguiente letra que correspondería se repite dos veces con la siguiente: e,e
• Luego f,e,f y finalmente g
• Patrón: c,d,c,d,e,e,f,e,f,g...

✅ Aplicando el patrón:
• La serie seguiría: g,h,g,h,i,i,j...
• En esta serie: Se repite una serie de 2 letras, la siguiente letra que correspondería se repite dos veces con la siguiente
• Por ello la serie seguiría: g,h,g,h,i,i,j,i,j,k,cd,e,ef,g...
• Respuesta correcta: g

La respuesta correcta es A: G`,
      question_subtype: "sequence_letter",
      option_a: "G",
      option_b: "H", 
      option_c: "F",
      option_d: "E",
      correct_option: 0, // A = G
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

    console.log('✅ Pregunta 01 - Serie de letras añadida exitosamente');
    console.log('📝 ID:', data[0]?.id);
    console.log('✅ Respuesta correcta: A (G)');
    console.log('🔄 Usa el nuevo componente SequenceLetterQuestion');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

// Ejecutar directamente
addLetterSeriesQuestion01();