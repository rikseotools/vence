import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addVehiculosSinVenderQuestion() {
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
      question_text: '¿Cuántos vehículos se han quedado sin vender?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'EMPRESA "RUEDA S" - ANÁLISIS DE VENTAS',
        question_context: 'Calcula la diferencia entre el total de vehículos disponibles y los vehículos vendidos:',
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
            highlighted_columns: [1, 7], // Resaltar Total vehículos y Vehículos vendidos
            footer_note: 'Calcular: Total de vehículos - Vehículos vendidos = Vehículos sin vender'
          }
        ],
        operation_type: 'column_subtraction',
        evaluation_description: 'Capacidad de realizar operaciones de resta entre dos totales de columnas para obtener una diferencia',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de análisis de inventario y ventas. Evalúa la habilidad para calcular stock no vendido mediante la diferencia entre inventario total y ventas realizadas."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Calcular total de vehículos\n• SEAT: 75 vehículos\n• VW: 60 vehículos\n• RENAULT: 95 vehículos\n• VOLVO: 15 vehículos\n• BMW: 25 vehículos\n• Total: 75 + 60 + 95 + 15 + 25 = 270\n\n📋 PASO 2: Calcular total vendidos\n• SEAT: 30 vendidos\n• VW: 15 vendidos\n• RENAULT: 65 vendidos\n• VOLVO: 7 vendidos\n• BMW: 10 vendidos\n• Total vendidos: 30 + 15 + 65 + 7 + 10 = 127\n\n🔢 PASO 3: Calcular diferencia\n• Sin vender = Total - Vendidos\n• 270 - 127 = 143 vehículos ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma por columnas\n• Sumar columna 'Total de vehículos': 270\n• Sumar columna 'Vehículos vendidos': 127\n• Restar: 270 - 127 = 143\n\n📊 Método 2: Cálculo por marcas\n• SEAT: 75-30 = 45 sin vender\n• VW: 60-15 = 45 sin vender\n• RENAULT: 95-65 = 30 sin vender\n• VOLVO: 15-7 = 8 sin vender\n• BMW: 25-10 = 15 sin vender\n• Total: 45+45+30+8+15 = 143\n\n💰 Método 3: Verificación rápida\n• Total aproximado: ~270\n• Vendidos aproximado: ~130\n• Diferencia: ~140 vehículos"
          }
        ]
      },
      option_a: '140',
      option_b: '133', 
      option_c: '153',
      option_d: '143',
      correct_option: 3, // D - 143 vehículos
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de vehículos sin vender...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de vehículos sin vender añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d, '← CORRECTA');
    console.log('✅ Respuesta correcta: 143 vehículos (270 total - 127 vendidos)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addVehiculosSinVenderQuestion();