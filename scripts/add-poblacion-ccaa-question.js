import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addPoblacionCCAAQuestion() {
  try {
    console.log('🔍 Buscando categoría y sección...');
    
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'capacidad-administrativa')
      .single();

    if (categoryError || !category) {
      console.error('❌ Error al buscar categoría:', categoryError);
      return;
    }

    console.log('✅ Categoría encontrada:', category.display_name);

    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .eq('category_id', category.id)
      .eq('section_key', 'tablas')
      .single();

    if (sectionError || !section) {
      console.error('❌ Error al buscar sección:', sectionError);
      return;
    }

    console.log('✅ Sección encontrada:', section.display_name);

    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: '¿Qué diferencia de población existe entre las CCAA de Castilla-La Mancha y Castilla y León?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'DATOS DE POBLACIÓN EN MUNICIPIOS Y CCAA DE ESPAÑA',
        question_context: 'Observa la siguiente tabla de datos de población en municipios y CCAA:',
        tables: [
          {
            title: 'Datos de población en municipios y CCAA de España',
            headers: ['Municipios', 'Nº hab. 2020', 'Nº hab. 2019', 'Diferencia ±', 'CCAA pertenece', 'Población de la CCAA'],
            rows: [
              ['Medina del Campo', '20416', '20510', '94', 'Castilla y León', '2.383.702'],
              ['Coslada', '81391', '81661', '270', 'C. de Madrid', '6.917.111'],
              ['Muros', '8427', '8506', '129', 'Galicia', '2.699.938'],
              ['Montoro', '9283', '9364', '71', 'Andalucía', '8.600.224'],
              ['Membrilla', '5942', '6005', '63', 'Castilla La Mancha', '2.089.074']
            ],
            highlighted_columns: [4, 5], // Resaltar CCAA y Población CCAA
            highlighted_rows: [0, 4], // Resaltar Castilla y León y Castilla-La Mancha
            footer_note: 'Fuente parcial: INE'
          }
        ],
        operation_type: 'subtraction_calculation',
        evaluation_description: 'Capacidad de localizar información específica en tablas complejas y realizar operaciones de resta entre datos de diferentes filas',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de organización y manejo de datos tabulares complejos. Evalúa la habilidad para localizar información específica de CCAA en diferentes filas y realizar operaciones matemáticas de sustracción."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar las CCAA objetivo\n• Buscar 'Castilla y León' en la columna CCAA\n• Buscar 'Castilla La Mancha' en la columna CCAA\n• Localizar sus poblaciones respectivas\n\n📋 PASO 2: Extraer las poblaciones\n• Castilla y León: 2.383.702 habitantes\n• Castilla La Mancha: 2.089.074 habitantes\n• Verificar que son las CCAA correctas\n\n🔢 PASO 3: Calcular la diferencia\n• Mayor - Menor: 2.383.702 - 2.089.074\n• Diferencia: 294.628 habitantes ✅\n• Castilla y León tiene más población"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Búsqueda directa por CCAA\n• Localizar 'Castilla y León' → 2.383.702\n• Localizar 'Castilla La Mancha' → 2.089.074\n• Restar: mayor - menor\n\n📊 Método 2: Verificación rápida\n• 2.383.702 - 2.089.074 ≈ 2.384 - 2.089 = 295 mil\n• Buscar respuesta cerca de 294-295 mil\n\n💰 Método 3: Atención a detalles\n• No confundir municipios con CCAA\n• Verificar que se toman las poblaciones de CCAA\n• La diferencia siempre es positiva (mayor - menor)"
          }
        ]
      },
      option_a: '284629 habitantes',
      option_b: '284628 habitantes', 
      option_c: '294628 habitantes',
      option_d: '294728 habitantes',
      correct_option: 2, // C - 294628 habitantes
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de población CCAA...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de población CCAA añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 294.628 habitantes (2.383.702 - 2.089.074)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addPoblacionCCAAQuestion();