import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addMinimoAsistentesPonenciasQuestion() {
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
      question_text: 'Según los datos anteriores de la Tabla Ponencias, ¿cuál es el mínimo de asistentes por la tarde en ponencias de tipo charla?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'TABLA PONENCIAS - ANÁLISIS POR TURNO Y TIPO',
        question_context: 'Calcula el total de asistentes (ponentes + alumnos) para ponencias tipo charla en turno de tarde:',
        tables: [
          {
            title: 'TABLA PONENCIAS',
            headers: ['TURNO', 'SALA', 'TEMA', 'TIPO', 'MATERIAL', 'ALUMNOS', 'PONENTES'],
            rows: [
              ['Mañana 1ª', '1', 'Comercial', 'Charla', 'Pdf', '111', '1'],
              ['Mañana 1ª', '2', 'Contabilidad', 'Mesa redonda', 'Word', '62', '17'],
              ['Mañana 2ª', '1', 'Recursos Humanos', 'Charla', 'Cd', '48', '6'],
              ['Mañana 2ª', '3', 'Administración', 'Laboratorio', 'Cd', '41', '2'],
              ['Mañana 3ª', '3', 'Comercial', 'Laboratorio', 'Pdf', '42', '11'],
              ['Tarde 1ª', '1', 'Administración', 'Charla', 'Pdf', '56', '13'],
              ['Tarde 1ª', '2', 'Contabilidad', 'Laboratorio', 'Cd', '39', '9'],
              ['Tarde 2ª', '1', 'Comercial', 'Laboratorio', 'Pdf', '48', '2'],
              ['Tarde 2ª', '3', 'Recursos Humanos', 'Laboratorio', 'Cd', '61', '5'],
              ['Tarde 3ª', '3', 'Administración', 'Charla', 'Pdf', '43', '5'],
              ['Tarde 3ª', '2', 'Contabilidad', 'Mesa redonda', 'Word', '54', '15'],
              ['Tarde 3ª', '1', 'Comercial', 'Charla', 'Pdf', '37', '3']
            ],
            highlighted_columns: [0, 3, 5, 6], // Resaltar TURNO, TIPO, ALUMNOS, PONENTES
            footer_note: 'El material para cada ponencia es entregado a cada ponente y alumno. Los asistentes a cada ponencia son los ponentes y alumnos.'
          }
        ],
        operation_type: 'filtered_sum_minimum',
        evaluation_description: 'Capacidad de filtrar datos por múltiples criterios (turno y tipo) y calcular sumas para encontrar el valor mínimo',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de análisis con filtros múltiples y búsqueda de valores mínimos. Evalúa la habilidad para aplicar criterios de selección específicos y realizar operaciones matemáticas con los datos filtrados."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Filtrar por criterios\n• Turno: 'Tarde' (filas 6-12)\n• Tipo: 'Charla'\n• Ponencias que cumplen ambos criterios\n\n📋 PASO 2: Identificar ponencias tarde + charla\n• Tarde 1ª - Administración - Charla: 56 alumnos + 13 ponentes = 69\n• Tarde 3ª - Administración - Charla: 43 alumnos + 5 ponentes = 48\n• Tarde 3ª - Comercial - Charla: 37 alumnos + 3 ponentes = 40 ✅\n\n🔢 PASO 3: Comparar totales\n• 69 asistentes (Tarde 1ª)\n• 48 asistentes (Tarde 3ª - Administración)\n• 40 asistentes (Tarde 3ª - Comercial) → MÍNIMO"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Identificación visual\n• Buscar filas que empiecen por 'Tarde'\n• De esas, buscar las que tengan 'Charla'\n• Solo hay 3 que cumplan ambos criterios\n\n📊 Método 2: Suma rápida\n• Tarde + Charla 1: 56+13 = 69\n• Tarde + Charla 2: 43+5 = 48\n• Tarde + Charla 3: 37+3 = 40 (el menor)\n\n💰 Método 3: Identificación del mínimo\n• 37+3 tiene los números más pequeños\n• 40 será el menor de los totales\n• Verificar que está en las opciones"
          }
        ]
      },
      option_a: '37',
      option_b: '48', 
      option_c: '40',
      option_d: '43',
      correct_option: 2, // C - 40 asistentes
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de mínimo asistentes ponencias...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de mínimo asistentes ponencias añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 40 asistentes (37 alumnos + 3 ponentes)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addMinimoAsistentesPonenciasQuestion();