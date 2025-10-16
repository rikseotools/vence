import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function fixImportacionesSimple() {
  try {
    console.log('🔧 Simplificando pregunta de importaciones vs exportaciones...');
    
    const questionId = '2ba122f2-d9f4-4ed5-a7e7-f6ae0c49aa4b';
    
    // Content_data simplificado con pocas filas para cálculo mental
    const updatedContentData = {
      chart_type: 'data_tables',
      chart_title: 'TABLA DE COMERCIO EXTERIOR',
      question_context: 'Observa los datos de comercio exterior:',
      tables: [
        {
          title: 'Comercio Exterior por Sectores',
          headers: ['Bienes', 'Exportaciones', 'Importaciones', 'Millones obtenidos en €'],
          rows: [
            ['Productos agrícolas', '702,7', '6583,2', '1572,3'],
            ['Maquinaria', '1017,9', '17894,1', '17654,3'],
            ['Productos industriales', '9421', '18562,6', '28973,6'],
            ['Alimentos y bebidas', '13250,8', '12003,2', '57964,2']
          ],
          highlighted_rows: 'all', // Resaltar todas las filas para suma total
          highlighted_columns: [1, 2], // Resaltar columnas Exportaciones e Importaciones
          footer_note: 'Se realiza la suma de ambas columnas y se compara.'
        }
      ],
      operation_type: 'column_totals_comparison',
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de sumar valores en columnas y realizar comparaciones. Evalúa el cálculo mental con números manejables."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "🔍 PASO 1: Sumar exportaciones\n• 702,7 + 1017,9 + 9421 + 13250,8\n• ≈ 700 + 1000 + 9400 + 13250 = 24.350 (aprox)\n\n💡 PASO 2: Sumar importaciones\n• 6583,2 + 17894,1 + 18562,6 + 12003,2\n• ≈ 6600 + 17900 + 18600 + 12000 = 55.100 (aprox)\n\n🔢 PASO 3: Comparar\n• Importaciones (~55.100) > Exportaciones (~24.350)\n• Las importaciones son claramente mayores"
        },
        {
          title: "⚡ TÉCNICA DE CÁLCULO MENTAL:",
          content: "🔍 Estimación rápida:\n• Exportaciones: ~700 + ~1000 + ~9400 + ~13250 ≈ 24.000\n• Importaciones: ~6600 + ~17900 + ~18600 + ~12000 ≈ 55.000\n• Diferencia evidente: Importaciones > Exportaciones\n\n✅ Respuesta: B) Importaciones"
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

    console.log('✅ Pregunta simplificada exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('💡 Cambios realizados:');
    console.log('   • Eliminada repetición del título');
    console.log('   • Reducido a 4 filas (de 9 originales)');
    console.log('   • Números más manejables para cálculo mental');
    console.log('   • Explicación simplificada con estimaciones');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA SIMPLIFICADA:');
    console.log(`   http://localhost:3000/debug/question/${questionId}`);

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar la función
fixImportacionesSimple();