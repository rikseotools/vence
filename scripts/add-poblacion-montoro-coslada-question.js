import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addPoblacionMontoroCosladaQuestion() {
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

    // 3. Datos de la pregunta específica de población Montoro + Coslada 2019
    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: '¿Qué población tendremos si sumamos el número de habitantes del 2019 de los municipios de Montoro y Coslada?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'DATOS DE POBLACIÓN EN MUNICIPIOS Y CCAA DE ESPAÑA',
        question_context: '¿Qué población tendremos si sumamos el número de habitantes del 2019 de los municipios de Montoro y Coslada?',
        tables: [
          {
            title: 'Datos de población en municipios y CCAA de España',
            headers: ['Municipios', 'Nº hab. 2020', 'Nº hab. 2019', 'Diferen. (-)', 'CCAA pertenece', 'Población de la CCAA'],
            rows: [
              ['Medina del Campo', '20416', '20510', '94', 'Castilla y León', '2.383.702'],
              ['Coslada', '81391', '81661', '270', 'C. de Madrid', '6.917.111'],
              ['Muros', '8427', '8556', '129', 'Galicia', '2.699.938'],
              ['Montoro', '9293', '9364', '71', 'Andalucía', '8.600.224'],
              ['Membrilla', '5942', '6005', '63', 'Castilla La Mancha', '2.069.074']
            ],
            highlighted_rows: [1, 3], // Resaltar filas de Coslada y Montoro (índices 1, 3)
            highlighted_columns: [0, 2], // Resaltar columnas Municipios y Nº hab. 2019
            source: 'Fuente parcial: INE'
          }
        ],
        operation_type: 'simple_addition',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de localización de datos específicos en tabla y realización de operaciones aritméticas básicas. Evalúa la precisión en la identificación de filas y columnas correctas."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar municipios objetivo\n• Localizar fila de 'Montoro'\n• Localizar fila de 'Coslada'\n\n📋 PASO 2: Seleccionar columna correcta\n• La pregunta pide datos del año 2019\n• Usar columna 'Nº hab. 2019' (no 2020)\n\n💡 PASO 3: Extraer valores exactos\n• Montoro 2019: 9.364 habitantes\n• Coslada 2019: 81.661 habitantes\n\n🔢 PASO 4: Realizar suma\n• 9.364 + 81.661 = 91.025 habitantes"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Localización visual\n• Buscar nombres específicos en primera columna\n• Seguir fila hasta columna '2019'\n• Extraer valores exactos\n\n📊 Método 2: Cálculo mental rápido\n• 9.364 ≈ 9.400 (redondeo)\n• 81.661 ≈ 81.700 (redondeo)\n• 9.400 + 81.700 = 91.100\n• Buscar opción más cercana\n\n💰 Método 3: Descarte de opciones\n• Opción A (91025): ✅ Muy cercana al cálculo exacto\n• Opción B (90025): 1000 menos, error significativo\n• Opción C (91125): 100 más, pequeño error\n• Opción D (90684): Valores incorrectos sumados"
          }
        ]
      },
      option_a: '91025',
      option_b: '90025',
      option_c: '91125',
      option_d: '90684',
      correct_option: 0, // A
      explanation: null, // Se maneja en componente
      question_subtype: 'data_tables',
      is_active: true
    };

    // 4. Insertar la pregunta
    console.log('📝 Insertando pregunta de población Montoro + Coslada 2019...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta 17 añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a, '← CORRECTA');
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: Montoro 2019 (9364) + Coslada 2019 (81661) = 91025');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar la función
addPoblacionMontoroCosladaQuestion();