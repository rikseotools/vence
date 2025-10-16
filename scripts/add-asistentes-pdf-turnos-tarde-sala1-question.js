import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addAsistentesPdfTurnosTardeSala1Question() {
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
      question_text: 'Según los datos anteriores de la Tabla Ponencias, ¿cuántos asistentes hay que requieren con material Pdf los turnos de tarde en la sala 1?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'TABLA PONENCIAS - MATERIAL PDF TURNOS TARDE SALA 1',
        question_context: 'Filtra y suma asistentes que cumplen todos los criterios: Material=PDF + Turno=Tarde + Sala=1:',
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
            highlighted_columns: [0, 1, 4, 5, 6], // Resaltar TURNO, SALA, MATERIAL, ALUMNOS, PONENTES
            highlighted_rows: [5, 7, 11], // Resaltar filas que cumplen criterios
            footer_note: 'Filtros: TURNO contiene "Tarde" + SALA = "1" + MATERIAL = "Pdf"'
          }
        ],
        operation_type: 'triple_filter_sum',
        evaluation_description: 'Capacidad de aplicar múltiples filtros simultáneos (turno, sala, material) y sumar asistentes',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de análisis con filtros múltiples específicos. Evalúa la habilidad para identificar filas que cumplen exactamente tres criterios simultáneos y sumar los valores correspondientes."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Aplicar filtros de turno\n• Buscar filas que contengan 'Tarde' en TURNO\n• Tarde 1ª, Tarde 2ª, Tarde 3ª cumplen\n\n📋 PASO 2: Aplicar filtro de sala\n• De las de tarde, buscar SALA = '1'\n• Tarde 1ª - Sala 1: ✓ (56+13=69)\n• Tarde 2ª - Sala 1: ✓ (48+2=50)\n• Tarde 3ª - Sala 1: ✓ (37+3=40)\n\n🔢 PASO 3: Aplicar filtro de material\n• De las anteriores, buscar MATERIAL = 'Pdf'\n• Tarde 1ª - Sala 1 - Pdf: 69 asistentes ✓\n• Tarde 2ª - Sala 1 - Pdf: 50 asistentes ✓\n• Tarde 3ª - Sala 1 - Pdf: 40 asistentes ✓\n• Total: 69 + 50 + 40 = 159 asistentes ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Filtrado progresivo\n• Paso 1: Marcar todas las filas 'Tarde'\n• Paso 2: De esas, marcar solo 'Sala 1'\n• Paso 3: De esas, marcar solo 'Pdf'\n• Quedan 3 filas válidas\n\n📊 Método 2: Búsqueda directa\n• Buscar combinación: Tarde + 1 + Pdf\n• Fila 6: Tarde 1ª-1-Pdf → 56+13=69\n• Fila 8: Tarde 2ª-1-Pdf → 48+2=50\n• Fila 12: Tarde 3ª-1-Pdf → 37+3=40\n• Suma: 69+50+40=159\n\n💰 Método 3: Verificación de exclusiones\n• Excluir mañanas (no tarde)\n• Excluir otras salas (no sala 1)\n• Excluir otros materiales (no Pdf)\n• Solo quedan 3 filas válidas"
          }
        ]
      },
      option_a: '54',
      option_b: '93', 
      option_c: '159',
      option_d: '37',
      correct_option: 2, // C - 159
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de asistentes PDF turnos tarde sala 1...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de asistentes PDF turnos tarde sala 1 añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 159 asistentes (69+50+40)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addAsistentesPdfTurnosTardeSala1Question();