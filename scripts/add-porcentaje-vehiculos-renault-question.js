import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addPorcentajeVehiculosRenaultQuestion() {
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
      question_text: 'En la categoría de vehículos vendidos, ¿Qué porcentaje representan los vehículos vendidos de Renault sobre el total de vehículos vendidos?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'EMPRESA "RUEDA S" - VEHÍCULOS POR MARCA',
        question_context: 'Calcula el porcentaje que representan los vehículos Renault sobre el total de vehículos vendidos:',
        tables: [
          {
            title: 'Empresa "Rueda S" - Número de vehículos según el tipo de combustible utilizado - Garantía',
            headers: ['Marcas comerciales', 'Total de vehículos', 'Vehículos híbridos', 'Vehículos gasolina', 'Vehículos diésel', '1 año en vehículo', '3 años en piezas', 'Vehículos vendidos'],
            rows: [
              ['SEAT', '75', '5', '35', '35', 'SI', 'NO', '30'],
              ['VW', '60', '15', '40', '5', 'SI', 'SI', '15'],
              ['RENAULT', '95', '25', '10', '60', 'NO', 'NO', '65'],
              ['VOLVO', '15', '3', '10', '2', 'NO', 'SI', '7'],
              ['BMW', '25', '5', '12', '8', 'NO', 'SI', '10']
            ],
            highlighted_columns: [7], // Resaltar vehículos vendidos
            highlighted_rows: [2], // Resaltar RENAULT
            footer_note: 'Calcular: (Vehículos vendidos Renault / Total vehículos vendidos) × 100'
          }
        ],
        operation_type: 'percentage_calculation',
        evaluation_description: 'Capacidad de calcular porcentajes específicos de una marca sobre el total de ventas en datos comerciales',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de análisis porcentual en datos comerciales. Evalúa la habilidad para calcular la participación de mercado de una marca específica sobre el total de ventas."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar datos de Renault\n• Vehículos vendidos Renault: 65\n• Buscar en la fila de RENAULT, columna 'Vehículos vendidos'\n\n📋 PASO 2: Calcular total de vehículos vendidos\n• SEAT: 30\n• VW: 15\n• RENAULT: 65\n• VOLVO: 7\n• BMW: 10\n• Total vendidos: 30 + 15 + 65 + 7 + 10 = 127\n\n🔢 PASO 3: Aplicar fórmula porcentual\n• Fórmula: (65 / 127) × 100\n• 65 ÷ 127 = 0,511\n• 0,511 × 100 = 51,1% ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Aproximación rápida\n• Renault: 65, Total aprox. 130\n• 65/130 ≈ 50%\n• Buscar respuesta cerca del 50%\n\n📊 Método 2: Cálculo mental simplificado\n• 65/127 ≈ 65/130 = 0,5 = 50%\n• Renault representa aproximadamente la mitad\n\n💰 Método 3: Suma directa\n• Sumar solo la columna 'Vehículos vendidos'\n• Renault claramente es el mayor (65)\n• Debe ser más del 40% del total"
          }
        ]
      },
      option_a: '51,1 %',
      option_b: '41,1 %', 
      option_c: '60,7 %',
      option_d: '55,5 %',
      correct_option: 0, // A - 51,1%
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de porcentaje vehículos Renault...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de porcentaje vehículos Renault añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a, '← CORRECTA');
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 51,1% (65/127 × 100)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addPorcentajeVehiculosRenaultQuestion();