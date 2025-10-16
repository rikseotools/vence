import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addSegurosClasificacionQuestion() {
  const questionData = {
    category_id: '55fd4bd0-faf2-4737-8203-4c41e30be41a', // Categoría capacidad-administrativa
    section_id: '72730b63-b10e-4777-b4bd-8fe7b69871a1', // Sección 'tablas' de capacidad-administrativa
    question_text: 'Aplicando las reglas de clasificación, ¿qué letra le corresponde al seguro de 4000 EUROS, tipo ACCIDENTES, contratado el 14/09/2016?',
    content_data: {
      chart_type: 'data_tables',
      chart_title: 'CLASIFICACIÓN DE SEGUROS',
      tables: [
        {
          title: 'Criterios de Clasificación',
          headers: ['Criterio', 'Descripción'],
          rows: [
            ['1. Marque A en la columna 1', 'Seguro de incendios o accidentes, desde 1500 a 4500 euros inclusive, contratado entre el 15 de marzo de 2016 y el 10 de mayo de 2017'],
            ['2. Marque B en la columna 2', 'Seguro de vida o de accidentes, hasta 3000 euros inclusive, contratado entre el 15 de octubre de 2016 y el 20 de agosto de 2017'],
            ['3. Marque C en la columna 3', 'Seguro de incendios o de vida, desde 2000 a 5000 euros inclusive, contratado entre el 10 de febrero de 2016 y el 15 de junio de 2017'],
            ['4. Marque D', 'Si no se cumple ninguna de las condiciones anteriores']
          ]
        },
        {
          title: 'Datos del Seguro a Clasificar',
          headers: ['Concepto', 'Valor'],
          rows: [
            ['Tipo', 'Seguro de accidentes'],
            ['Importe', '4000 euros'],
            ['Fecha contrato', '14/09/2016']
          ]
        }
      ],
      explanation_sections: [
        {
          title: '💡 ¿Qué evalúa este ejercicio?',
          content: 'Capacidad para aplicar criterios de clasificación múltiples, verificando simultáneamente tipo de seguro, rango de importe y período de contratación. Esta habilidad es esencial en tareas administrativas de categorización y procesamiento de documentos.'
        },
        {
          title: '📊 ANÁLISIS PASO A PASO:',
          content: '📋 Datos del seguro:\n✅ Tipo: Accidentes\n✅ Importe: 4000 euros\n✅ Fecha: 14/09/2016\n\n📋 Verificación criterio A:\n✅ ¿Incendios o accidentes? → Accidentes ✓\n✅ ¿Entre 1500-4500 euros? → 4000 está en rango ✓\n✅ ¿Entre 15/03/2016 y 10/05/2017? → 14/09/2016 está en rango ✓\n✅ CUMPLE criterio A\n\n📋 Verificación otros criterios:\n❌ Criterio B: Pide hasta 3000 euros (4000 > 3000)\n❌ Criterio C: Pide incendios o vida (no accidentes)\n❌ Criterio D: Solo si no se cumple ninguno anterior'
        },
        {
          title: '⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)',
          content: '🔍 Método 1: Verificación sistemática\n• Anotar datos del seguro (tipo, importe, fecha)\n• Revisar cada criterio punto por punto\n• Marcar el primero que cumpla TODOS los requisitos\n\n📊 Método 2: Descarte por incompatibilidad\n• Si el tipo de seguro no coincide, descartar\n• Si el importe está fuera de rango, descartar\n• Si la fecha está fuera del período, descartar\n\n💰 Método 3: Orden de prioridad\n• Los criterios parecen tener prioridad (A>B>C>D)\n• Empezar por A y verificar si cumple todos los requisitos\n• Si A cumple, esa es la respuesta (no revisar B,C,D)'
        }
      ]
    },
    option_a: 'D',
    option_b: 'B', 
    option_c: 'A',
    option_d: 'C',
    correct_option: 2, // C = A (cumple criterio A: accidentes, 1500-4500€, 15/03/2016-10/05/2017)
    explanation: null,
    question_subtype: 'data_tables',
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

    console.log('✅ Pregunta de Clasificación de Seguros añadida exitosamente');
    console.log('📝 ID:', data[0]?.id);
    console.log('✅ Respuesta correcta: C (A)');
    console.log('♻️  Reutiliza el componente DataTableQuestion existente');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    console.log('');
    console.log('📊 Verificación del criterio A:');
    console.log('   • Tipo: Accidentes ✓ (incendios o accidentes)');
    console.log('   • Importe: 4000€ ✓ (entre 1500-4500€)');
    console.log('   • Fecha: 14/09/2016 ✓ (entre 15/03/2016-10/05/2017)');
    console.log('   • RESULTADO: Marque A en la columna 1');

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

addSegurosClasificacionQuestion();