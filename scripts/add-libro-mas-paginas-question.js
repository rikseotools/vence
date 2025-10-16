import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addLibroMasPaginasQuestion() {
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
      question_text: '¿Cuál es el título del libro que más páginas posee?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'CATÁLOGO DE LIBROS',
        question_context: 'Observa el catálogo de libros y encuentra el que tiene mayor número de páginas:',
        tables: [
          {
            title: 'Catálogo de libros',
            headers: ['AÑO', 'TIPO', 'Nº PÁGINAS', 'NOMBRE'],
            rows: [
              ['1943', 'Ensayo', '105', '"La problemática de los medicamentos"'],
              ['1985', 'Novela', '324', '"La casa mágica"'],
              ['1976', 'Poema', '56', '"Poemas de amor"'],
              ['1836', 'Novela', '287', '"El maletín sangriento"'],
              ['1920', 'Ensayo', '193', '"Educar en los tiempos de hoy"']
            ],
            highlighted_columns: [2, 3], // Resaltar páginas y nombre
            footer_note: 'Buscar el mayor número en la columna "Nº PÁGINAS"'
          }
        ],
        operation_type: 'maximum_value',
        evaluation_description: 'Capacidad de localizar el valor máximo en una columna numérica específica y asociarlo con el dato correspondiente en otra columna',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de búsqueda de valores extremos en tablas. Evalúa la habilidad para localizar el valor máximo en una columna numérica y relacionarlo correctamente con la información asociada."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar la columna objetivo\n• Buscar en 'Nº PÁGINAS'\n• Ignorar: AÑO, TIPO\n• Relacionar con: NOMBRE\n\n📋 PASO 2: Comparar valores numéricos\n• 105 páginas → 'La problemática de los medicamentos'\n• 324 páginas → 'La casa mágica' ✅\n• 56 páginas → 'Poemas de amor'\n• 287 páginas → 'El maletín sangriento'\n• 193 páginas → 'Educar en los tiempos de hoy'\n\n🏆 PASO 3: Identificar el máximo\n• 324 páginas es el valor más alto\n• Corresponde a 'La casa mágica'\n• Verificar que está en las opciones de respuesta"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Escaneo visual rápido\n• Buscar números que empiecen por 3 (300+)\n• Solo hay uno: 324\n• Corresponde a 'La casa mágica'\n\n📊 Método 2: Comparación directa\n• Revisar cada número de páginas\n• 324 claramente supera a todos los demás\n• No necesitas comparar todos si 324 ya es obviamente el mayor\n\n💰 Método 3: Verificación por opciones\n• Si las opciones están dadas, verificar el número de páginas de cada título\n• 'La casa mágica' tendrá el número más alto"
          }
        ]
      },
      option_a: '"La casa mágica"',
      option_b: '"Poemas de amor"', 
      option_c: '"Educar en los tiempos de hoy"',
      option_d: '"El maletín sangriento"',
      correct_option: 0, // A - "La casa mágica" (324 páginas)
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de libro con más páginas...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de libro con más páginas añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a, '← CORRECTA');
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: "La casa mágica" (324 páginas)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addLibroMasPaginasQuestion();