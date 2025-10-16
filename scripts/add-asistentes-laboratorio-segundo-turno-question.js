import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addAsistentesLaboratorioSegundoTurnoQuestion() {
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
      question_text: 'Según los datos anteriores de la Tabla Ponencias, ¿cuál es el total de asistentes en el segundo turno de mañana o tarde en una ponencia de tipo Laboratorio donde el tema no fue Recursos Humanos?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'TABLA PONENCIAS - ANÁLISIS DE ASISTENCIA POR FILTROS',
        question_context: 'Filtra las ponencias por los criterios específicos y suma los asistentes totales:',
        tables: [
          {
            title: 'TABLA PONENCIAS',
            headers: ['TURNO', 'SALA', 'TEMA', 'TIPO', 'MATERIAL', 'ALUMNOS', 'PONENTES'],
            rows: [
              ['Mañana 1ª', '1', 'Comercial', 'Charla', 'Pdf', '41', '1'],
              ['Mañana 1ª', '2', 'Contabilidad', 'Mesa redonda', 'Word', '52', '17'],
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
            highlighted_columns: [0, 2, 3, 5, 6], // Resaltar TURNO, TEMA, TIPO, ALUMNOS, PONENTES
            footer_note: 'Filtros: Segundo turno (2ª) + Tipo Laboratorio + Tema NO Recursos Humanos'
          }
        ],
        operation_type: 'multiple_filter_sum',
        evaluation_description: 'Capacidad de aplicar múltiples filtros simultáneos (turno, tipo, exclusión de tema) y sumar resultados',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de análisis con filtros complejos y exclusiones. Evalúa la habilidad para aplicar múltiples criterios de selección, incluyendo criterios de exclusión, y realizar operaciones matemáticas con los datos filtrados."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Aplicar filtros\n• Turno: 'Mañana 2ª' o 'Tarde 2ª'\n• Tipo: 'Laboratorio'\n• Tema: NO 'Recursos Humanos'\n\n📋 PASO 2: Identificar ponencias que cumplen\n• Mañana 2ª - Administración - Laboratorio: 41+2 = 43 ✓\n• Tarde 2ª - Comercial - Laboratorio: 48+2 = 50 ✓\n• (Tarde 2ª - Recursos Humanos - Laboratorio: EXCLUIDO)\n\n🔢 PASO 3: Sumar asistentes totales\n• Mañana 2ª Administración: 43 asistentes\n• Tarde 2ª Comercial: 50 asistentes\n• Total: 43 + 50 = 93 asistentes ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Filtro por pasos\n• Paso 1: Buscar '2ª' en TURNO\n• Paso 2: De esas, buscar 'Laboratorio' en TIPO\n• Paso 3: Excluir 'Recursos Humanos' en TEMA\n• Solo quedan 2 filas válidas\n\n📊 Método 2: Identificación visual\n• Mañana 2ª + Laboratorio + NO RRHH: 41+2\n• Tarde 2ª + Laboratorio + NO RRHH: 48+2\n• Suma: 43+50 = 93\n\n💰 Método 3: Verificación de exclusión\n• Tarde 2ª tiene 2 laboratorios\n• Uno es RRHH (excluir), otro es Comercial (incluir)\n• Solo contar el de Comercial"
          }
        ]
      },
      option_a: '50',
      option_b: '93', 
      option_c: '43',
      option_d: '89',
      correct_option: 1, // B - 93 asistentes
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de asistentes laboratorio segundo turno...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de asistentes laboratorio segundo turno añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b, '← CORRECTA');
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 93 asistentes (43 Mañana 2ª + 50 Tarde 2ª)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addAsistentesLaboratorioSegundoTurnoQuestion();