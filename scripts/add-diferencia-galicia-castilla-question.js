import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addDiferenciaGaliciaCastillaQuestion() {
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
      question_text: '¿Qué diferencia hay de población entre las CCAA de Galicia y la CCAA de Castilla La Mancha?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'POBLACIÓN DE CCAA ESPAÑOLAS',
        question_context: 'Calcula la diferencia de población entre las dos CCAA especificadas:',
        tables: [
          {
            title: 'Datos de población en municipios y CCAA de España',
            headers: ['Municipios', 'Nº hab. 2020', 'Nº hab. 2019', 'Diferencia (±)', 'CCAA pertenece', 'Población de la CCAA'],
            rows: [
              ['Medina del Campo', '20416', '20510', '94', 'Castilla y León', '2.383.702'],
              ['Coslada', '81391', '81661', '270', 'C. de Madrid', '6.917.111'],
              ['Muros', '8427', '8506', '129', 'Galicia', '2.699.938'],
              ['Montoro', '9293', '9364', '71', 'Andalucía', '8.600.224'],
              ['Membrilla', '5942', '6005', '63', 'Castilla La Mancha', '2.089.074']
            ],
            highlighted_columns: [4, 5], // Resaltar CCAA y Población CCAA
            highlighted_rows: [2, 4], // Resaltar Galicia y Castilla La Mancha
            footer_note: 'Fuente parcial: INE. Calcular: Galicia - Castilla La Mancha'
          }
        ],
        operation_type: 'subtraction_calculation',
        evaluation_description: 'Capacidad de localizar datos específicos de CCAA en diferentes filas y realizar operaciones de resta',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de manejo de datos demográficos en tablas. Evalúa la habilidad para localizar información específica de comunidades autónomas y realizar operaciones aritméticas de sustracción."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Localizar las CCAA objetivo\n• Buscar 'Galicia' en la columna CCAA\n• Buscar 'Castilla La Mancha' en la columna CCAA\n• Identificar sus poblaciones respectivas\n\n📋 PASO 2: Extraer las poblaciones\n• Galicia: 2.699.938 habitantes\n• Castilla La Mancha: 2.089.074 habitantes\n• Verificar que son las CCAA correctas\n\n🔢 PASO 3: Calcular la diferencia\n• Mayor - Menor: 2.699.938 - 2.089.074\n• Diferencia: 610.864 habitantes ✅\n• Galicia tiene más población que Castilla La Mancha"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo mental aproximado\n• Galicia: ~2.700.000\n• Castilla La Mancha: ~2.100.000\n• Diferencia: ~600.000 habitantes\n\n📊 Método 2: Verificación por aproximación\n• 2.700.000 - 2.100.000 = 600.000\n• Buscar respuesta cerca de 600.000\n• 610.864 está en el rango esperado\n\n💰 Método 3: Identificación rápida\n• Localizar las dos CCAA en la tabla\n• Galicia > Castilla La Mancha (números mayores)\n• Restar directamente: 2.699.938 - 2.089.074"
          }
        ]
      },
      option_a: '510864 habitantes',
      option_b: '610874 habitantes', 
      option_c: '710874 habitantes',
      option_d: '610864 habitantes',
      correct_option: 3, // D - 610864 habitantes
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de diferencia Galicia-Castilla...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de diferencia Galicia-Castilla añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d, '← CORRECTA');
    console.log('✅ Respuesta correcta: 610.864 habitantes (2.699.938 - 2.089.074)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addDiferenciaGaliciaCastillaQuestion();