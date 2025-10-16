import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addSumaDiferenciasPoblacionQuestion() {
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
      question_text: 'Si sumásemos la cantidad total de las diferencias de habitantes de los cinco municipios representados en la tabla, ¿qué cantidad saldría?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'DATOS DE POBLACIÓN EN MUNICIPIOS Y CCAA DE ESPAÑA',
        question_context: 'Suma todas las diferencias de habitantes (columna Diferencia (±)):',
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
            highlighted_columns: [3], // Resaltar columna Diferencia (±)
            footer_note: 'Sumar todos los valores de la columna "Diferencia (±)": 94 + 270 + 129 + 71 + 63'
          }
        ],
        operation_type: 'simple_sum',
        evaluation_description: 'Capacidad de sumar valores específicos de una columna de datos demográficos',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de análisis de datos demográficos. Evalúa la habilidad para identificar y sumar valores específicos de una columna numérica en una tabla de datos."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar la columna objetivo\n• Buscar en 'Diferencia (±)'\n• Ignorar otras columnas numéricas\n\n📋 PASO 2: Extraer todos los valores\n• Medina del Campo: 94\n• Coslada: 270\n• Muros: 129\n• Montoro: 71\n• Membrilla: 63\n\n🔢 PASO 3: Sumar todos los valores\n• 94 + 270 + 129 + 71 + 63 = 627 ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma por grupos\n• Grupo 1: 94 + 270 = 364\n• Grupo 2: 129 + 71 = 200\n• Grupo 3: 63\n• Total: 364 + 200 + 63 = 627\n\n📊 Método 2: Suma progresiva\n• 94 + 270 = 364\n• 364 + 129 = 493\n• 493 + 71 = 564\n• 564 + 63 = 627\n\n💰 Método 3: Verificación mental\n• Números redondos: ~100 + 270 + 130 + 70 + 60 ≈ 630\n• Ajuste fino: 627 (muy cercano a estimación)"
          }
        ]
      },
      option_a: '737',
      option_b: '637', 
      option_c: '627',
      option_d: '727',
      correct_option: 2, // C - 627
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de suma diferencias población...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de suma diferencias población añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 627 (94+270+129+71+63)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addSumaDiferenciasPoblacionQuestion();