import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addVehiculosGasolinaVolvoVWQuestion() {
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
      question_text: '¿Qué cantidad de vehículos del tipo de combustible gasolina habría entre la marca Volvo y la marca VW?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'EMPRESA "RUEDA S" - VEHÍCULOS POR COMBUSTIBLE',
        question_context: 'Suma los vehículos de gasolina de las dos marcas especificadas:',
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
            highlighted_columns: [3], // Resaltar vehículos gasolina
            highlighted_rows: [1, 3], // Resaltar VW y VOLVO
            footer_note: 'Sumar: Vehículos gasolina VW + Vehículos gasolina VOLVO'
          }
        ],
        operation_type: 'selective_sum',
        evaluation_description: 'Capacidad de localizar datos específicos de marcas seleccionadas en una columna determinada y sumarlos',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de análisis selectivo en datos automotrices. Evalúa la habilidad para localizar información específica de marcas determinadas y realizar operaciones aritméticas simples."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar la columna objetivo\n• Buscar en 'Vehículos gasolina'\n• Ignorar: híbridos, diésel, total\n\n📋 PASO 2: Localizar las marcas solicitadas\n• VW: 40 vehículos gasolina\n• VOLVO: 10 vehículos gasolina\n• Ignorar: SEAT, RENAULT, BMW\n\n🔢 PASO 3: Sumar los valores\n• VW gasolina: 40\n• VOLVO gasolina: 10\n• Total: 40 + 10 = 50 vehículos ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Localización directa\n• Buscar filas VW y VOLVO\n• Ir a columna 'Vehículos gasolina'\n• Sumar: 40 + 10 = 50\n\n📊 Método 2: Verificación visual\n• VW tiene 40 (número alto)\n• VOLVO tiene 10 (número bajo)\n• 40 + 10 = 50 (cálculo mental inmediato)\n\n💰 Método 3: Descarte de otras marcas\n• Solo interesan VW y VOLVO\n• Ignorar completamente SEAT, RENAULT, BMW\n• Enfocarse solo en las 2 filas relevantes"
          }
        ]
      },
      option_a: '75',
      option_b: '60', 
      option_c: '40',
      option_d: '50',
      correct_option: 3, // D - 50 vehículos
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de vehículos gasolina Volvo+VW...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de vehículos gasolina Volvo+VW añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d, '← CORRECTA');
    console.log('✅ Respuesta correcta: 50 vehículos (40 VW + 10 VOLVO)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addVehiculosGasolinaVolvoVWQuestion();