import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addPonenciasTableQuestion() {
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

    // 3. Datos de la pregunta específica de tabla de ponencias
    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: 'Según los datos anteriores de la Tabla Ponencias, ¿cuántos asistentes acuden en la tarde en la sala 1?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'TABLA PONENCIAS',
        question_context: 'Según los datos anteriores de la Tabla Ponencias, ¿cuántos asistentes acuden en la tarde en la sala 1?',
        tables: [
          {
            title: 'TABLA PONENCIAS',
            headers: ['TURNO', 'SALA', 'TEMA', 'TIPO', 'MATERIAL', 'ALUMNOS', 'PONENTES'],
            rows: [
              ['Mañana 1º', '1', 'Comercial', 'Charla', 'Pdf', '41', '4'],
              ['Mañana 1º', '2', 'Contabilidad', 'Mesa redonda', 'Word', '52', '17'],
              ['Mañana 2º', '1', 'Recursos Humanos', 'Charla', 'Cd', '48', '6'],
              ['Mañana 2º', '3', 'Administración', 'Laboratorio', 'Cd', '41', '2'],
              ['Mañana 3º', '3', 'Comercial', 'Laboratorio', 'Pdf', '42', '11'],
              ['Tarde 1º', '1', 'Administración', 'Charla', 'Pdf', '56', '13'],
              ['Tarde 1º', '2', 'Contabilidad', 'Laboratorio', 'Cd', '38', '6'],
              ['Tarde 2º', '1', 'Comercial', 'Laboratorio', 'Pdf', '48', '2'],
              ['Tarde 2º', '3', 'Recursos Humanos', 'Laboratorio', 'Cd', '51', '5'],
              ['Tarde 3º', '3', 'Administración', 'Charla', 'Pdf', '43', '1'],
              ['Tarde 3º', '2', 'Contabilidad', 'Mesa redonda', 'Word', '54', '15'],
              ['Tarde 3º', '1', 'Comercial', 'Charla', 'Pdf', '37', '3']
            ],
            highlighted_rows: [5, 7, 11], // Resaltar filas de Tarde + Sala 1 (índices: 5, 7, 11)
            highlighted_columns: [0, 1, 5, 6], // Resaltar columnas TURNO, SALA, ALUMNOS, PONENTES
            footer_note: 'El material para cada ponencia es entregado a cada ponente y alumno. Los asistentes a cada ponencia son los ponentes y alumnos'
          }
        ],
        operation_type: 'filtering_and_summing',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de filtrado de datos según múltiples criterios y suma de valores de diferentes columnas. Evalúa la comprensión lectora de definiciones y la aplicación precisa de filtros combinados."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar criterios\n• TURNO = 'Tarde' (Tarde 1º, Tarde 2º, Tarde 3º)\n• SALA = '1'\n• Combinar ambos criterios con operador AND\n\n📋 PASO 2: Localizar filas que cumplen ambos criterios\n• Tarde 1º + Sala 1: 56 alumnos + 13 ponentes\n• Tarde 2º + Sala 1: 48 alumnos + 2 ponentes\n• Tarde 3º + Sala 1: 37 alumnos + 3 ponentes\n\n💡 PASO 3: Interpretar correctamente 'asistentes'\n• Según nota al pie: 'Los asistentes a cada ponencia son los ponentes y alumnos'\n• Por tanto: Asistentes = Alumnos + Ponentes"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Filtrado sistemático\n• Marcar mentalmente las filas con 'Tarde'\n• De esas, seleccionar solo las de 'Sala 1'\n• Sumar ambas columnas numéricas por fila\n\n📊 Método 2: Cálculo directo\n• Fila 6: (56+13) = 69\n• Fila 8: (48+2) = 50\n• Fila 12: (37+3) = 40\n• Total: 69+50+40 = 159\n\n💰 Método 3: Descarte de opciones\n• Opción A (119): Muy bajo, falta incluir ponentes\n• Opción B (159): ✅ Coincide con cálculo completo\n• Opción C (141): Solo suma alumnos (56+48+37)\n• Opción D (93): Demasiado bajo, error de cálculo"
          }
        ]
      },
      option_a: '119',
      option_b: '159',
      option_c: '141',
      option_d: '93',
      correct_option: 1, // B
      explanation: null, // Se maneja en componente
      question_subtype: 'data_tables',
      is_active: true
    };

    // 4. Insertar la pregunta
    console.log('📝 Insertando pregunta de tabla ponencias...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de tabla ponencias añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b, '← CORRECTA');
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: Tarde Sala 1 → (56+13)+(48+2)+(37+3) = 69+50+40 = 159 asistentes');
    console.log('💡 Clave: "Asistentes" = Alumnos + Ponentes según nota al pie');
    console.log('');
    console.log('♻️  Reutiliza el componente DataTableQuestion existente - no se necesitan cambios');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    // 5. Verificar el conteo de preguntas en la sección
    const { count } = await supabase
      .from('psychometric_questions')
      .select('*', { count: 'exact', head: true })
      .eq('section_id', section.id)
      .eq('is_active', true);

    console.log('📊 Total de preguntas activas en la sección "tablas":', count);

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar la función
addPonenciasTableQuestion();