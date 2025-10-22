// Script para añadir la pregunta específica de la imagen
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addPreguntaImagenSerie() {
  try {
    const supabase = getSupabase();
    
    // Buscar categoría existente - puede ser capacidad-administrativa o razonamiento-numerico
    const { data: category } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'razonamiento-numerico')
      .single();
      
    if (!category) {
      console.log('❌ Categoría no encontrada');
      return;
    }
    
    // Buscar sección existente en esa categoría
    const { data: section } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .eq('category_id', category.id)
      .limit(1)
      .single();
      
    if (!section) {
      console.log('❌ No hay secciones en la categoría');
      return;
    }
    
    console.log(`✅ Usando: ${category.display_name} > ${section.display_name}`);
    
    // DATOS DE LA PREGUNTA DE LA IMAGEN:
    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: 'Continúa la siguiente serie numérica: 11, 11, 9, 9, 7, 7, ?',
      content_data: {
        chart_type: 'text_question',
        sequence: [11, 11, 9, 9, 7, 7, '?'],
        pattern_type: 'intercalated',
        pattern_description: 'Series intercaladas: dos números iguales restando 2 cada vez'
      },
      option_a: '3',
      option_b: '1',
      option_c: '5',
      option_d: '7',
      correct_option: 2, // C = 5
      question_subtype: 'sequence_numeric',
      explanation: 'Series numéricas intercaladas. El patrón es: números repetidos que van restando 2. 11,11 → 9,9 → 7,7 → 5,5. Por tanto, el siguiente número es 5.',
      is_active: true
    };
    
    // Insertar la pregunta
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select();
      
    if (error) {
      console.log('❌ Error al insertar:', error.message);
      return;
    }
    
    console.log('✅ Pregunta de serie numérica intercalada añadida exitosamente');
    console.log(`📝 ID: ${data[0]?.id}`);
    console.log(`✅ Serie: 11, 11, 9, 9, 7, 7, ?`);
    console.log(`✅ Respuesta correcta: C = 5 (patrón: números repetidos -2)`);
    console.log(`📊 Tipo: Series intercaladas`);
    
    console.log('\n🔗 REVISAR PREGUNTA:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    
    console.log('\n🎯 RUTAS DEL TEST:');
    console.log(`   📊 Categoría completa: http://localhost:3000/auxiliar-administrativo-estado/test/psicotecnicos/${category.category_key}`);
    console.log(`   🎯 Sección específica: http://localhost:3000/auxiliar-administrativo-estado/test/psicotecnicos/${category.category_key}?sections=${section.section_key}`);
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

addPreguntaImagenSerie();