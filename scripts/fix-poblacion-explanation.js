import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function fixPoblacionExplanation() {
  try {
    console.log('🔧 Corrigiendo explicación de pregunta de población...');
    
    const questionId = 'da8f029e-4fb9-47da-95d4-fc6fcac78eb1';
    
    // Content_data con la explicación corregida (sin métodos ridículos)
    const updatedContentData = {
      chart_type: 'data_tables',
      chart_title: 'DATOS DE POBLACIÓN EN MUNICIPIOS Y CCAA DE ESPAÑA',
      question_context: '¿Qué población tendremos si sumamos el número de habitantes del 2019 de los municipios de Montoro y Coslada?',
      tables: [
        {
          title: 'Datos de población en municipios y CCAA de España',
          headers: ['Municipios', 'Nº hab. 2020', 'Nº hab. 2019', 'Diferen. (-)', 'CCAA pertenece', 'Población de la CCAA'],
          rows: [
            ['Medina del Campo', '20416', '20510', '94', 'Castilla y León', '2.383.702'],
            ['Coslada', '81391', '81661', '270', 'C. de Madrid', '6.917.111'],
            ['Muros', '8427', '8556', '129', 'Galicia', '2.699.938'],
            ['Montoro', '9293', '9364', '71', 'Andalucía', '8.600.224'],
            ['Membrilla', '5942', '6005', '63', 'Castilla La Mancha', '2.069.074']
          ],
          highlighted_rows: [1, 3], // Resaltar filas de Coslada y Montoro (índices 1, 3)
          highlighted_columns: [0, 2], // Resaltar columnas Municipios y Nº hab. 2019
          source: 'Fuente parcial: INE'
        }
      ],
      operation_type: 'simple_addition',
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de localización de datos específicos en tabla y realización de operaciones aritméticas básicas. Evalúa la precisión en la identificación de filas y columnas correctas."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "🔍 PASO 1: Identificar municipios objetivo\n• Localizar fila de 'Montoro'\n• Localizar fila de 'Coslada'\n\n📋 PASO 2: Seleccionar columna correcta\n• La pregunta pide datos del año 2019\n• Usar columna 'Nº hab. 2019' (no 2020)\n\n💡 PASO 3: Extraer valores exactos\n• Montoro 2019: 9.364 habitantes\n• Coslada 2019: 81.661 habitantes\n\n🔢 PASO 4: Realizar suma\n• 9.364 + 81.661 = 91.025 habitantes"
        },
        {
          title: "⚡ TÉCNICA DE RESOLUCIÓN:",
          content: "🔍 Localización directa:\n• Buscar 'Montoro' en primera columna → columna '2019' → 9.364\n• Buscar 'Coslada' en primera columna → columna '2019' → 81.661\n• Suma exacta: 9.364 + 81.661 = 91.025\n\n✅ Respuesta: A) 91025"
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

    console.log('✅ Explicación corregida - eliminados métodos innecesarios');
    console.log('📝 ID:', data[0].id);
    console.log('💡 Ahora solo muestra la técnica directa (sin aproximaciones)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA CORREGIDA:');
    console.log(`   http://localhost:3000/debug/question/${questionId}`);

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar la función
fixPoblacionExplanation();