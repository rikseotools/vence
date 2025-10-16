import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addVehiculosGarantiasExcluirRenaultQuestion() {
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
      question_text: '¿Cuántos vehículos totales corresponden a marcas que ofrecen garantía de 1 año en vehículo O garantía de 3 años en piezas?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'EMPRESA "RUEDA S" - VEHÍCULOS POR TIPO DE GARANTÍA',
        question_context: 'Suma los vehículos de marcas que tienen "SI" en al menos una de las dos garantías:',
        tables: [
          {
            title: 'EMPRESA "Rueda s"',
            headers: ['Marcas comerciales', 'Total de vehículos', 'Vehículos híbridos', 'Vehículos gasolina', 'Vehículos diésel', '1 año en vehículo', '3 años en piezas', 'Vehículos vendidos'],
            rows: [
              ['SEAT', '75', '5', '35', '35', 'SI', 'NO', '30'],
              ['VW', '60', '15', '40', '5', 'SI', 'SI', '15'],
              ['RENAULT', '95', '25', '10', '60', 'NO', 'NO', '65'],
              ['VOLVO', '15', '3', '10', '2', 'NO', 'SI', '7'],
              ['BMW', '25', '5', '12', '8', 'NO', 'SI', '10']
            ],
            highlighted_columns: [1, 5, 6], // Resaltar total vehículos y garantías
            highlighted_rows: [0, 1, 3, 4], // Resaltar marcas con garantías (excluir RENAULT)
            footer_note: 'Buscar marcas con "SI" en "1 año en vehículo" O "3 años en piezas" (o ambas)'
          }
        ],
        operation_type: 'conditional_sum_exclusion',
        evaluation_description: 'Capacidad de filtrar datos por criterios múltiples y excluir elementos que no cumplen condiciones',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de análisis de datos con condiciones lógicas. Evalúa la habilidad para identificar marcas que ofrecen al menos uno de los dos tipos de garantía mostrados en la tabla."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Revisar garantías por marca\n• SEAT: 1 año vehículo=SI, 3 años piezas=NO → Tiene garantía ✓\n• VW: 1 año vehículo=SI, 3 años piezas=SI → Tiene garantía ✓\n• RENAULT: 1 año vehículo=NO, 3 años piezas=NO → Sin garantía ✗\n• VOLVO: 1 año vehículo=NO, 3 años piezas=SI → Tiene garantía ✓\n• BMW: 1 año vehículo=NO, 3 años piezas=SI → Tiene garantía ✓\n\n📋 PASO 2: Sumar vehículos de marcas con garantías\n• SEAT: 75 vehículos (garantía 1 año vehículo)\n• VW: 60 vehículos (ambas garantías)\n• VOLVO: 15 vehículos (garantía 3 años piezas)\n• BMW: 25 vehículos (garantía 3 años piezas)\n\n🔢 PASO 3: Calcular total\n• 75 + 60 + 15 + 25 = 175 vehículos ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Identificación rápida\n• Buscar filas con al menos un 'SI' en garantías\n• Solo RENAULT tiene ambas en 'NO'\n• Sumar el resto: 75+60+15+25 = 175\n\n📊 Método 2: Exclusión directa\n• Total general: 75+60+95+15+25 = 270\n• Excluir RENAULT: 270-95 = 175\n• Verificar que RENAULT no tiene garantías\n\n💰 Método 3: Agrupación mental\n• Marcas grandes: SEAT(75) + VW(60) = 135\n• Marcas pequeñas: VOLVO(15) + BMW(25) = 40\n• Total válido: 135+40 = 175"
          }
        ]
      },
      option_a: '135',
      option_b: '40', 
      option_c: '175',
      option_d: '270',
      correct_option: 2, // C - 175
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de vehículos con garantías (excluyendo Renault)...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de vehículos con garantías añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 175 vehículos (marcas con al menos 1 garantía)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addVehiculosGarantiasExcluirRenaultQuestion();