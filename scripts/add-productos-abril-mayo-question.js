import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addProductosAbrilMayoQuestion() {
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
      question_text: '¿Cuántas unidades del Producto C se vendieron en total durante los meses de abril y mayo?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'VENTAS MENSUALES POR PRODUCTO',
        question_context: 'Observa la siguiente tabla de ventas mensuales por productos y calcula el total requerido:',
        tables: [
          {
            title: 'Ventas mensuales por producto',
            headers: ['MES', 'Producto A (unidades)', 'Producto B (unidades)', 'Producto C (unidades)', 'Total Ventas (euros)'],
            rows: [
              ['Enero', '150', '80', '120', '4.200'],
              ['Febrero', '180', '95', '110', '4.750'],
              ['Marzo', '210', '100', '130', '5.500'],
              ['Abril', '160', '85', '140', '4.600'],
              ['Mayo', '200', '110', '150', '6.000']
            ],
            highlighted_columns: [3], // Resaltar columna Producto C
            highlighted_rows: [3, 4], // Resaltar filas Abril y Mayo
            footer_note: 'Cálculo: Producto C abril + Producto C mayo'
          }
        ],
        operation_type: 'sum_calculation',
        evaluation_description: 'Capacidad de localizar datos específicos en una tabla (Producto C) y sumar valores de períodos específicos (abril y mayo)',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de organización y manejo de datos tabulares. Evalúa la habilidad para localizar información específica en tablas de datos y realizar operaciones matemáticas básicas con múltiples valores."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar la columna relevante\n• Localizar 'Producto C (unidades)' en la tabla\n• Ignorar: Producto A, Producto B, Total Ventas\n\n📋 PASO 2: Identificar los meses objetivo\n• Abril: 140 unidades\n• Mayo: 150 unidades\n• Ignorar: Enero, Febrero, Marzo\n\n🔢 PASO 3: Realizar la suma\n• Abril: 140 unidades\n• Mayo: 150 unidades\n• Total: 140 + 150 = 290 unidades ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Localización visual rápida\n• Encontrar la columna 'Producto C'\n• Buscar las filas de 'Abril' y 'Mayo'\n• Sumar los dos valores directamente\n\n📊 Método 2: Verificación cruzada\n• Abril: 140 unidades (fila 4, columna Producto C)\n• Mayo: 150 unidades (fila 5, columna Producto C)\n• Suma: 140 + 150 = 290\n\n💰 Método 3: Descarte de opciones\n• Verificar que la suma sea lógica\n• 290 debe estar entre las opciones disponibles\n• Evitar confundir con otros productos o meses"
          }
        ]
      },
      option_a: '310',
      option_b: '290', 
      option_c: '288',
      option_d: '315',
      correct_option: 1, // B - 290 unidades
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de productos abril-mayo...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de productos abril-mayo añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b, '← CORRECTA');
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 290 unidades (140 + 150)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addProductosAbrilMayoQuestion();