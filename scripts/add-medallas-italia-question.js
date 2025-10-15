import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addMedallasItaliaQuestion() {
  const questionData = {
    category_id: '55fd4bd0-faf2-4737-8203-4c41e30be41a', // Categoría capacidad-administrativa
    section_id: '72730b63-b10e-4777-b4bd-8fe7b69871a1', // Sección 'tablas' de capacidad-administrativa
    question_text: '¿Cuántas medallas de bronce ganó Italia en total en los JJ.OO de verano en los que ha participado?',
    content_data: {
      chart_type: 'data_tables',
      chart_title: 'PARTICIPACIÓN Y MEDALLAS JJ.OO DE VERANO',
      question_context: '¿Cuántas medallas de bronce ganó Italia en total en los JJ.OO de verano en los que ha participado?',
      tables: [
        {
          title: 'Participación y Medallas JJ.OO de verano',
          headers: ['País', 'Participación JJ.OO verano', 'Participación JJ.OO invierno', 'Medallas obtenidas JJ.OO de verano (Oro)', 'Medallas obtenidas JJ.OO de verano (Plata)', 'Medallas obtenidas JJ.OO de verano (Bronce)', 'Total Medallas'],
          rows: [
            ['Alemania', '17', '12', '239', '267', '291', '797'],
            ['Francia', '29', '24', '231', '256', '285', '772'],
            ['España', '24', '21', '48', '72', '49', '169'],
            ['Italia', '28', '24', '222', '195', '215', '632'],
            ['Grecia', '29', '19', '36', '45', '41', '122']
          ]
        }
      ],
      explanation_sections: [
        {
          title: '💡 ¿Qué evalúa este ejercicio?',
          content: 'Capacidad para localizar información específica en una tabla de datos. Esta habilidad de búsqueda y extracción de datos es fundamental en tareas administrativas y análisis deportivos.'
        },
        {
          title: '📊 ANÁLISIS PASO A PASO:',
          content: '📋 Paso 1 - Localizar fila de Italia:\n✅ Buscar "Italia" en la primera columna de la tabla\n✅ Encontrar la fila correspondiente\n\n📋 Paso 2 - Identificar columna correcta:\n✅ Buscar columna "Medallas obtenidas JJ.OO de verano (Bronce)"\n✅ Es la sexta columna de la tabla\n\n📋 Paso 3 - Leer el valor:\n✅ En la intersección de fila Italia y columna Bronce\n✅ El valor es: 215 medallas de bronce'
        },
        {
          title: '⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)',
          content: '🔍 Método 1: Búsqueda sistemática\n• Buscar "Italia" en primera columna\n• Seguir la fila hacia la derecha\n• Localizar columna "Bronce"\n• Leer el valor directamente: 215\n\n📊 Método 2: Orientación visual\n• Italia está en la 4ª fila\n• Medallas bronce está en la 6ª columna\n• Intersección: 215 medallas\n\n💰 Método 3: Descarte de opciones\n• Las opciones son números decimales pero la pregunta pide total\n• Buscar en las opciones el número que aparece en la tabla\n• Solo 215 tendría sentido como total de medallas'
        }
      ]
    },
    option_a: '222',
    option_b: '195', 
    option_c: '215',
    option_d: '632',
    correct_option: 2, // C = 215 (medallas de bronce totales de Italia)
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

    console.log('✅ Pregunta de Medallas Italia añadida exitosamente');
    console.log('📝 ID:', data[0]?.id);
    console.log('✅ Respuesta correcta: C (215 medallas)');
    console.log('♻️  Reutiliza el componente DataTableQuestion existente');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    console.log('');
    console.log('📊 Extracción del dato:');
    console.log('   • Fila: Italia');
    console.log('   • Columna: Medallas de bronce JJ.OO verano');
    console.log('   • Valor: 215 medallas de bronce totales');

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

addMedallasItaliaQuestion();