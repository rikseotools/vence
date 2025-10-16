import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function fixImportacionesSuperSimple() {
  try {
    console.log('🔧 Haciendo pregunta super simple sin decimales...');
    
    const questionId = '2ba122f2-d9f4-4ed5-a7e7-f6ae0c49aa4b';
    
    // Content_data super simplificado - números enteros fáciles
    const updatedContentData = {
      chart_type: 'data_tables',
      chart_title: 'COMERCIO EXTERIOR',
      question_context: 'Observa los datos de comercio exterior:',
      tables: [
        {
          title: 'Comercio Exterior por Sectores',
          headers: ['Bienes', 'Exportaciones', 'Importaciones'],
          rows: [
            ['Productos agrícolas', '20', '45'],
            ['Maquinaria', '30', '60'],
            ['Productos industriales', '25', '40']
          ],
          highlighted_rows: 'all', // Resaltar todas las filas para suma total
          highlighted_columns: [1, 2], // Resaltar columnas Exportaciones e Importaciones
          footer_note: 'Se suman ambas columnas y se compara el total.'
        }
      ],
      operation_type: 'simple_column_comparison',
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de sumar números sencillos y realizar comparaciones básicas. Evalúa la aritmética mental elemental."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "🔍 PASO 1: Sumar exportaciones\n• 20 + 30 + 25 = 75\n\n💡 PASO 2: Sumar importaciones\n• 45 + 60 + 40 = 145\n\n🔢 PASO 3: Comparar\n• Importaciones (145) > Exportaciones (75)\n• Las importaciones son mayores"
        },
        {
          title: "⚡ CÁLCULO MENTAL DIRECTO:",
          content: "🔍 Suma sencilla:\n• Exportaciones: 20 + 30 + 25 = 75\n• Importaciones: 45 + 60 + 40 = 145\n• 145 > 75\n\n✅ Respuesta: B) Importaciones"
        }
      ]
    };

    // Actualizar la pregunta
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({ content_data: updatedContentData })
      .eq('id', questionId)
      .select('id, question_text');

    if (error) {
      console.error('❌ Error al actualizar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta super simplificada exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('💡 Cambios realizados:');
    console.log('   • Solo 3 filas');
    console.log('   • Números enteros sencillos (20, 30, 25, 45, 60, 40)');
    console.log('   • Sin decimales');
    console.log('   • Eliminada columna "Millones obtenidos"');
    console.log('   • Cálculo mental: 75 vs 145');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA SUPER SIMPLE:');
    console.log(`   http://localhost:3000/debug/question/${questionId}`);

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar la función
fixImportacionesSuperSimple();