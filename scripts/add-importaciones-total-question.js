import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addImportacionesTotalQuestion() {
  try {
    console.log('🔍 Buscando categoría y sección...');
    
    // 1. Buscar la categoría 'capacidad-administrativa'
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

    // 2. Buscar la sección 'tablas' dentro de la categoría
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

    // 3. Datos de la pregunta específica de importaciones vs exportaciones
    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: '¿Hay más importaciones o exportaciones?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'TABLA DE COMERCIO EXTERIOR',
        question_context: '¿Hay más importaciones o exportaciones?',
        tables: [
          {
            title: 'Comercio Exterior por Sectores',
            headers: ['Bienes', 'Exportaciones', 'Importaciones', 'Millones obtenidos en €'],
            rows: [
              ['Productos agrícolas', '702,7', '6583,2', '1572,3'],
              ['Elementos de transporte', '6502,5', '8472,6', '21384,6'],
              ['Maquinaria', '1017,9', '17894,1', '17654,3'],
              ['Productos industriales', '9421', '18562,6', '28973,6'],
              ['Alimentos y bebidas', '13250,8', '12003,2', '57964,2'],
              ['Productos energéticos', '57369,2', '26039,2', '43847,1'],
              ['Automóviles', '18597,6', '18123,8', '39876,8'],
              ['Bienes de consumo', '23010,7', '38562,7', '8972,1'],
              ['Otros bienes', '1627,2', '3321,3', '5684,3']
            ],
            highlighted_rows: 'all', // Resaltar todas las filas para suma total
            highlighted_columns: [1, 2], // Resaltar columnas Exportaciones e Importaciones
            footer_note: 'Se realiza la suma de ambas columnas y se compara.'
          }
        ],
        operation_type: 'column_totals_comparison',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de sumar múltiples valores en columnas y realizar comparaciones entre totales. Evalúa la precisión en operaciones aritméticas con muchos números y la organización mental del cálculo."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar columnas a comparar\n• Columna 'Exportaciones' (índice 2)\n• Columna 'Importaciones' (índice 3)\n\n📋 PASO 2: Sumar todas las exportaciones\n• 702,7 + 6502,5 + 1017,9 + 9421 + 13250,8 + 57369,2 + 18597,6 + 23010,7 + 1627,2\n• Total Exportaciones = 133.499,6\n\n💡 PASO 3: Sumar todas las importaciones\n• 6583,2 + 8472,6 + 17894,1 + 18562,6 + 12003,2 + 26039,2 + 18123,8 + 38562,7 + 3321,3\n• Total Importaciones = 149.562,7\n\n🔢 PASO 4: Comparar totales\n• Importaciones (149.562,7) > Exportaciones (133.499,6)\n• Diferencia: 16.063,1 millones €"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma por bloques\n• Agrupar números grandes: 57369,2 + 23010,7 + 18597,6 ≈ 99.000\n• Sumar el resto y añadir al bloque\n• Hacer lo mismo para ambas columnas\n\n📊 Método 2: Estimación rápida\n• Exportaciones: ~133.000 (aprox)\n• Importaciones: ~150.000 (aprox)\n• Claramente las importaciones son mayores\n\n💰 Método 3: Descarte visual\n• Comparar valores grandes fila por fila\n• Productos energéticos: Exp(57369) > Imp(26039)\n• Pero otros sectores compensan la diferencia\n• Opción B (Importaciones) es la más lógica"
          }
        ]
      },
      option_a: 'Son mayores las exportaciones por 53628,6',
      option_b: 'Importaciones',
      option_c: 'Exportaciones',
      option_d: 'Igual',
      correct_option: 1, // B
      explanation: null, // Se maneja en componente
      question_subtype: 'data_tables',
      is_active: true
    };

    // 4. Insertar la pregunta
    console.log('📝 Insertando pregunta de importaciones vs exportaciones...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta 18 añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b, '← CORRECTA');
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: Importaciones (149.562,7) > Exportaciones (133.499,6)');
    console.log('💡 Diferencia: 16.063,1 millones € a favor de importaciones');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar la función
addImportacionesTotalQuestion();