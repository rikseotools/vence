import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addPorcentajePoblacionMedinaQuestion() {
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
      question_text: 'Respecto al número de habitantes del 2020 en el municipio de Medina del Campo, ¿Qué porcentaje representa la diferencia (-) de población de dicho municipio?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'DATOS DE POBLACIÓN EN MUNICIPIOS Y CCAA',
        question_context: 'Calcula el porcentaje que representa la diferencia poblacional respecto al total de 2020:',
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
            highlighted_columns: [1, 3], // Resaltar habitantes 2020 y diferencia
            highlighted_rows: [0], // Resaltar Medina del Campo
            footer_note: 'Fuente parcial: INE. Calcular: (Diferencia / Población 2020) × 100'
          }
        ],
        operation_type: 'percentage_calculation',
        evaluation_description: 'Capacidad de calcular porcentajes a partir de datos tabulares, aplicando la fórmula (parte/total) × 100',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de cálculo de porcentajes en contextos demográficos. Evalúa la habilidad para aplicar fórmulas matemáticas básicas a datos reales de población y expresar resultados en forma porcentual."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar los datos de Medina del Campo\n• Población 2020: 20.416 habitantes\n• Diferencia: 94 habitantes (reducción)\n• Necesitamos: porcentaje que representa la diferencia\n\n📋 PASO 2: Aplicar la fórmula del porcentaje\n• Fórmula: (Diferencia / Población 2020) × 100\n• Cálculo: (94 / 20.416) × 100\n• 94 ÷ 20.416 = 0,0046\n• 0,0046 × 100 = 0,46%\n\n✅ PASO 3: Verificar el resultado\n• 0,46% es un porcentaje pequeño y lógico\n• Representa una pérdida poblacional mínima\n• Coincide con las opciones disponibles"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Aproximación rápida\n• 94 / 20.000 ≈ 0,005 = 0,5%\n• La respuesta estará cerca de 0,5%\n• Buscar 0,46% entre las opciones\n\n📊 Método 2: Cálculo mental simplificado\n• 100 / 20.000 = 0,5%\n• 94 es ligeramente menor que 100\n• Por tanto será ligeramente menor que 0,5%\n\n💰 Método 3: División por etapas\n• 94 / 20.416\n• ≈ 94 / 20.000 = 0,0047\n• × 100 = 0,47% ≈ 0,46%"
          }
        ]
      },
      option_a: '0,46 %',
      option_b: '0,45 %', 
      option_c: '0,56 %',
      option_d: '1,46 %',
      correct_option: 0, // A - 0,46%
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de porcentaje población...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de porcentaje población añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a, '← CORRECTA');
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 0,46% (94/20416 × 100)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addPorcentajePoblacionMedinaQuestion();