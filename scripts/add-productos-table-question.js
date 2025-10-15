import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addProductosQuestion() {
  const questionData = {
    category_id: '55fd4bd0-faf2-4737-8203-4c41e30be41a', // Categoría capacidad-administrativa
    section_id: '72730b63-b10e-4777-b4bd-8fe7b69871a1', // Sección 'tablas' de capacidad-administrativa
    question_text: 'Si el precio del Producto A es de 10 euros por unidad, ¿cuánto se recaudó en Mayo?',
    content_data: {
      chart_type: 'data_tables',
      chart_title: 'TABLA VENTAS POR PRODUCTOS',
      question_context: 'Si el precio del Producto A es de 10 euros por unidad, ¿cuánto se recaudó en Mayo?',
      tables: [
        {
          title: 'Tabla de Ventas por Productos',
          headers: ['MES', 'Producto A (unidades)', 'Producto B (unidades)', 'Producto C (unidades)', 'Total Ventas (euros)'],
          rows: [
            ['Enero', '150', '80', '120', '4.200'],
            ['Febrero', '180', '95', '110', '4.750'],
            ['Marzo', '210', '100', '130', '5.500'],
            ['Abril', '160', '85', '140', '4.600'],
            ['Mayo', '200', '110', '150', '6.000']
          ]
        }
      ],
      explanation_sections: [
        {
          title: '💡 ¿Qué evalúa este ejercicio?',
          content: 'Capacidad para extraer datos específicos de una tabla y realizar cálculos básicos de multiplicación. Esta habilidad es fundamental en tareas comerciales y financieras donde se debe calcular ingresos por productos.'
        },
        {
          title: '📊 ANÁLISIS PASO A PASO:',
          content: '📋 Paso 1 - Localizar datos de Mayo:\n✅ Fila "Mayo" en la tabla\n✅ Producto A en Mayo: 200 unidades\n\n📋 Paso 2 - Aplicar precio por unidad:\n✅ Precio del Producto A: 10 euros/unidad\n✅ Unidades vendidas en Mayo: 200 unidades\n\n📋 Paso 3 - Calcular recaudación:\n✅ Recaudación = 200 unidades × 10 euros/unidad\n✅ Recaudación = 2.000 euros'
        },
        {
          title: '⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)',
          content: '🔍 Método 1: Localización directa\n• Buscar fila "Mayo" en primera columna\n• Leer valor en columna "Producto A"\n• Multiplicar por 10 euros (precio dado)\n\n📊 Método 2: Cálculo mental rápido\n• 200 unidades × 10 euros = 2.000 euros\n• Verificar que esta cantidad aparezca en las opciones\n\n💰 Método 3: Verificación con total\n• Total ventas en Mayo: 6.000 euros\n• Producto A: 2.000 euros (33% aprox del total)\n• Esta proporción parece razonable'
        }
      ]
    },
    option_a: '526',
    option_b: '3500', 
    option_c: '2000',
    option_d: '590',
    correct_option: 2, // C = 2000 (200 unidades × 10 euros)
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

    console.log('✅ Pregunta de Tabla Productos añadida exitosamente');
    console.log('📝 ID:', data[0]?.id);
    console.log('✅ Respuesta correcta: C (2000 euros)');
    console.log('♻️  Reutiliza el componente DataTableQuestion existente');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    console.log('');
    console.log('📊 Cálculo de la respuesta:');
    console.log('   • Producto A en Mayo: 200 unidades');
    console.log('   • Precio por unidad: 10 euros');
    console.log('   • Recaudación: 200 × 10 = 2.000 euros');

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

addProductosQuestion();