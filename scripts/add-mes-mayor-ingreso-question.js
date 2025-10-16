import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addMesMayorIngresoQuestion() {
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
      question_text: '¿En qué mes la tienda obtuvo el mayor ingreso total por ventas?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'VENTAS MENSUALES DE LA TIENDA',
        question_context: 'Observa la tabla de ventas mensuales y identifica el mes con mayor ingreso total:',
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
            highlighted_columns: [4], // Resaltar Total Ventas
            footer_note: 'Buscar el mayor valor en la columna "Total Ventas (euros)"'
          }
        ],
        operation_type: 'maximum_value',
        evaluation_description: 'Capacidad de localizar el valor máximo en una columna específica de datos financieros y asociarlo con el período correspondiente',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de análisis de datos financieros en tablas. Evalúa la habilidad para localizar valores máximos en datos de ventas y relacionarlos con períodos específicos de tiempo."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar la columna objetivo\n• Buscar en 'Total Ventas (euros)'\n• Ignorar: unidades de productos individuales\n• Relacionar con: MES\n\n📋 PASO 2: Comparar valores por mes\n• Enero: 4.200 euros\n• Febrero: 4.750 euros\n• Marzo: 5.500 euros\n• Abril: 4.600 euros\n• Mayo: 6.000 euros ✅\n\n🏆 PASO 3: Identificar el máximo\n• 6.000 euros es el valor más alto\n• Corresponde al mes de Mayo\n• Verificar que está en las opciones de respuesta"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Escaneo visual rápido\n• Buscar números que empiecen por 6 (6.000+)\n• Solo hay uno: 6.000\n• Corresponde a Mayo\n\n📊 Método 2: Comparación progresiva\n• Enero: 4.200 → Mayo: 6.000 (Mayo gana)\n• Febrero: 4.750 → Mayo: 6.000 (Mayo gana)\n• Y así sucesivamente\n\n💰 Método 3: Ordenamiento mental\n• 6.000 > 5.500 > 4.750 > 4.600 > 4.200\n• Mayo > Marzo > Febrero > Abril > Enero\n• Mayo es claramente el ganador"
          }
        ]
      },
      option_a: 'Enero',
      option_b: 'Abril', 
      option_c: 'Mayo',
      option_d: 'Marzo',
      correct_option: 2, // C - Mayo (6.000 euros)
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de mes con mayor ingreso...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de mes con mayor ingreso añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: Mayo (6.000 euros)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addMesMayorIngresoQuestion();