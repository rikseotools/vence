import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addPorcentajeVolvoTotalEmpresaQuestion() {
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
      question_text: 'Indique el porcentaje que representa el total de vehículos de la marca Volvo sobre el total de vehículos de la empresa "Rueda s":',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'EMPRESA "RUEDA S" - PORCENTAJE DE PARTICIPACIÓN VOLVO',
        question_context: 'Calcula qué porcentaje representan los vehículos Volvo del total de la empresa:',
        tables: [
          {
            title: 'EMPRESA "Rueda s"',
            headers: ['Marcas comerciales', 'Total de vehículos', 'Vehículos híbridos', 'Vehículos gasolina', 'Vehículos diésel', '1 año en vehículo', '3 años en piezas', 'Vehículos vendidos'],
            rows: [
              ['SEAT', '60', '5', '35', '35', 'SI', 'NO', '30'],
              ['VW', '50', '15', '40', '5', 'SI', 'SI', '15'],
              ['RENAULT', '80', '25', '10', '60', 'NO', 'NO', '65'],
              ['VOLVO', '10', '3', '10', '2', 'NO', 'SI', '7'],
              ['BMW', '40', '5', '12', '8', 'NO', 'SI', '10']
            ],
            highlighted_columns: [1], // Resaltar total de vehículos
            highlighted_rows: [3], // Resaltar VOLVO
            footer_note: 'Fórmula: (Vehículos Volvo / Total empresa) × 100 = (10 / 240) × 100'
          }
        ],
        operation_type: 'percentage_calculation',
        evaluation_description: 'Capacidad de calcular porcentajes simples en datos empresariales',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de cálculo porcentual básico. Evalúa la habilidad para determinar qué proporción representa una parte específica respecto al total y convertirla a porcentaje."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar vehículos Volvo\n• VOLVO: 10 vehículos\n\n📋 PASO 2: Calcular total de vehículos\n• SEAT: 60 + VW: 50 + RENAULT: 80 + VOLVO: 10 + BMW: 40\n• Total empresa: 60+50+80+10+40 = 240 vehículos\n\n🔢 PASO 3: Aplicar fórmula porcentual\n• Porcentaje = (Parte / Total) × 100\n• (10 / 240) × 100 = (1/24) × 100\n• Resultado: 4,17% ≈ 4,2% ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Simplificación de fracción\n• 10/240 = 1/24\n• 1 ÷ 24 ≈ 0,042 = 4,2%\n\n📊 Método 2: Cálculo mental directo\n• 10/240 = 10/240 = 1/24\n• 100 ÷ 24 ≈ 4,17%\n• Redondeo: 4,2%\n\n💰 Método 3: Estimación por proximidad\n• 10/250 = 4% (estimación baja)\n• 10/240 > 4% (real es mayor)\n• Aproximadamente 4,2%"
          }
        ]
      },
      option_a: '5,0 %',
      option_b: '4,2 %', 
      option_c: '3,5 %',
      option_d: '4,8 %',
      correct_option: 1, // B - 4,2%
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de porcentaje Volvo sobre total empresa...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de porcentaje Volvo añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d, '← CORRECTA');
    console.log('✅ Respuesta correcta: 5,55% (15/270 × 100)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addPorcentajeVolvoTotalEmpresaQuestion();