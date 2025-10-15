import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addPonenciasQuestion() {
  const questionData = {
    category_id: '55fd4bd0-faf2-4737-8203-4c41e30be41a', // Categoría capacidad-administrativa
    section_id: '72730b63-b10e-4777-b4bd-8fe7b69871a1', // Sección 'tablas' de capacidad-administrativa
    question_text: 'Según los datos anteriores de la Tabla Ponencias, ¿cuántos ponentes del segundo turno en mañana y tarde donde el tema fue "Recursos humanos" tienen de material un CD?',
    content_data: {
      chart_type: 'data_tables',
      chart_title: 'TABLA PONENCIAS',
      question_context: 'Según los datos anteriores de la Tabla Ponencias, ¿cuántos ponentes del segundo turno en mañana y tarde donde el tema fue "Recursos humanos" tienen de material un CD?',
      tables: [
        {
          title: 'Tabla Ponencias',
          headers: ['TURNO', 'SALA', 'TEMA', 'TIPO', 'MATERIAL', 'ALUMNOS', 'PONENTES'],
          rows: [
            ['Mañana 1°', '1', 'Comercial', 'Charla', 'Pdf', '41', '4'],
            ['Mañana 1°', '2', 'Contabilidad', 'Mesa redonda', 'Word', '52', '17'],
            ['Mañana 2°', '1', 'Recursos Humanos', 'Charla', 'Cd', '48', '6'],
            ['Mañana 2°', '3', 'Administración', 'Laboratorio', 'Cd', '41', '2'],
            ['Mañana 3°', '3', 'Comercial', 'Laboratorio', 'Pdf', '42', '11'],
            ['Tarde 1°', '1', 'Administración', 'Charla', 'Pdf', '56', '13'],
            ['Tarde 1°', '2', 'Contabilidad', 'Laboratorio', 'Cd', '39', '9'],
            ['Tarde 2°', '1', 'Comercial', 'Laboratorio', 'Pdf', '48', '2'],
            ['Tarde 2°', '3', 'Recursos Humanos', 'Laboratorio', 'Cd', '51', '5'],
            ['Tarde 3°', '3', 'Administración', 'Charla', 'Pdf', '43', '6'],
            ['Tarde 3°', '2', 'Contabilidad', 'Mesa redonda', 'Word', '54', '15'],
            ['Tarde 3°', '1', 'Comercial', 'Charla', 'Pdf', '37', '3']
          ]
        }
      ],
      explanation_sections: [
        {
          title: '💡 ¿Qué evalúa este ejercicio?',
          content: 'Capacidad para filtrar información en tablas aplicando múltiples criterios simultáneamente: turno específico (segundo), horario (mañana y tarde), tema específico (Recursos humanos) y tipo de material (CD). Esta habilidad es esencial en tareas administrativas de gestión de eventos y recursos.'
        },
        {
          title: '📊 ANÁLISIS PASO A PASO:',
          content: '📋 Paso 1 - Filtrar por segundo turno:\n✅ Mañana 2°: Recursos Humanos - CD - 6 ponentes\n✅ Tarde 2°: Recursos Humanos - CD - 5 ponentes\n❌ Otros turnos (1° y 3°): No cumplen criterio\n\n📋 Paso 2 - Verificar tema "Recursos humanos":\n✅ Mañana 2°, Sala 1: Recursos Humanos ✓\n✅ Tarde 2°, Sala 3: Recursos Humanos ✓\n\n📋 Paso 3 - Verificar material CD:\n✅ Mañana 2°: Material = Cd ✓\n✅ Tarde 2°: Material = Cd ✓\n\n📋 Paso 4 - Sumar ponentes:\n✅ Mañana 2°: 6 ponentes\n✅ Tarde 2°: 5 ponentes\n✅ TOTAL: 6 + 5 = 11 ponentes'
        },
        {
          title: '⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)',
          content: '🔍 Método 1: Filtrado sistemático\n• Marcar todas las filas de "2°" turno\n• De esas, quedarse solo con "Recursos Humanos"\n• Verificar que el material sea "Cd"\n• Sumar los ponentes de las filas que cumplan todos los criterios\n\n📊 Método 2: Búsqueda visual dirigida\n• Buscar directamente "Recursos Humanos" en la columna TEMA\n• Verificar que sean turno "2°" (mañana o tarde)\n• Confirmar material "Cd"\n• Leer columna PONENTES de esas filas\n\n💰 Método 3: Descarte de opciones\n• Solo hay 2 filas que cumplen todos los criterios\n• Una tiene 6 ponentes, otra tiene 5 ponentes\n• Total debe ser 6 + 5 = 11\n• Si alguna opción no es 11, se puede descartar rápidamente'
        }
      ]
    },
    option_a: '6',
    option_b: '15', 
    option_c: '11',
    option_d: '5',
    correct_option: 2, // C = 11 (6 + 5 ponentes)
    explanation: null, // Se maneja en el componente
    question_subtype: 'data_tables', // Requerido para el switch en PsychometricTestLayout
    is_active: true
  };

  try {
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select();

    if (error) {
      console.error('❌ Error inserting question:', error);
      return;
    }

    console.log('✅ Pregunta de Tabla Ponencias añadida exitosamente');
    console.log('📝 ID:', data[0]?.id);
    console.log('✅ Respuesta correcta: C (11 ponentes)');
    console.log('♻️  Reutiliza el componente DataTableQuestion existente');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    console.log('');
    console.log('📊 Análisis de la respuesta:');
    console.log('   • Mañana 2° - Recursos Humanos - Cd: 6 ponentes');
    console.log('   • Tarde 2° - Recursos Humanos - Cd: 5 ponentes');
    console.log('   • TOTAL: 6 + 5 = 11 ponentes');

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

addPonenciasQuestion();