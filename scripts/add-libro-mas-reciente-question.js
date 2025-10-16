import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addLibroMasRecienteQuestion() {
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
      question_text: '¿Cuál es el libro más reciente?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'CATÁLOGO DE LIBROS POR AÑO DE PUBLICACIÓN',
        question_context: 'Identifica el libro publicado en el año más reciente:',
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
            highlighted_columns: [0, 3], // Resaltar año y nombre
            footer_note: 'Buscar el año más alto en la columna "AÑO"'
          }
        ],
        operation_type: 'maximum_value_date',
        evaluation_description: 'Capacidad de localizar el valor máximo en una columna de fechas/años y asociarlo con el dato correspondiente',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de análisis temporal en datos bibliográficos. Evalúa la habilidad para identificar el valor máximo en una columna de años y relacionarlo con la información asociada."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar la columna objetivo\n• Buscar en 'AÑO'\n• Ignorar: TIPO, Nº PÁGINAS\n• Relacionar con: NOMBRE\n\n📋 PASO 2: Comparar todos los años\n• 1943 → 'La problemática de los medicamentos'\n• 1985 → 'La casa mágica' ✅\n• 1976 → 'Poemas de amor'\n• 1836 → 'El maletín sangriento'\n• 1920 → 'Educar en los tiempos de hoy'\n\n🏆 PASO 3: Identificar el año más reciente\n• 1985 es el año más alto (más reciente)\n• Corresponde a 'La casa mágica'\n• Verificar que está en las opciones de respuesta"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Escaneo visual rápido\n• Buscar años que empiecen por 19 (1900+)\n• Solo hay tres: 1943, 1976, 1985\n• 1985 es el mayor\n\n📊 Método 2: Comparación directa\n• 1985 vs otros años del siglo XX\n• 1985 > 1976 > 1943 > 1920\n• 1985 es claramente el más reciente\n\n💰 Método 3: Ordenamiento mental\n• Siglo XIX: 1836\n• Siglo XX temprano: 1920, 1943\n• Siglo XX tardío: 1976, 1985\n• 1985 es el último cronológicamente"
          }
        ]
      },
      option_a: '"Poemas de amor"',
      option_b: '"Educar en los tiempos de hoy"', 
      option_c: '"El maletín sangriento"',
      option_d: '"La casa mágica"',
      correct_option: 3, // D - "La casa mágica" (1985)
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de libro más reciente...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de libro más reciente añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d, '← CORRECTA');
    console.log('✅ Respuesta correcta: "La casa mágica" (año 1985)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addLibroMasRecienteQuestion();