import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addImportacionesTotalQuestion() {
  const questionData = {
    category_id: '55fd4bd0-faf2-4737-8203-4c41e30be41a', // Categoría capacidad-administrativa
    section_id: '72730b63-b10e-4777-b4bd-8fe7b69871a1', // Sección 'tablas' de capacidad-administrativa
    question_text: '¿Cuántas importaciones hay en total?',
    content_data: {
      chart_type: 'data_tables',
      chart_title: 'TABLA DE COMERCIO EXTERIOR',
      tables: [
        {
          title: 'Comercio Exterior por Sectores',
          headers: ['Bienes', 'Exportaciones', 'Importaciones', 'Millones obtenidos en €'],
          rows: [
            ['Productos agrícolas', '702,7', '6583,2', '1572,3'],
            ['Elementos de transporte', '8502,5', '8472,6', '21384,6'],
            ['Maquinaria', '1017,9', '17894,1', '17654,3'],
            ['Productos industriales', '9421', '18562,6', '28973,6'],
            ['Alimentos y bebidas', '13250,8', '12003,2', '57964,2'],
            ['Productos energéticos', '57369,2', '26039,2', '43847,1'],
            ['Automóviles', '18597,6', '18123,8', '39876,8'],
            ['Bienes de consumo', '23010,7', '38562,7', '8972,1'],
            ['Otros bienes', '1627,2', '3321,3', '5684,3']
          ]
        }
      ],
      explanation_sections: [
        {
          title: '💡 ¿Qué evalúa este ejercicio?',
          content: 'Capacidad para identificar la columna correcta en una tabla y realizar suma de múltiples valores decimales con precisión. Esta habilidad es fundamental en análisis de datos comerciales y estadísticos.'
        },
        {
          title: '📊 ANÁLISIS PASO A PASO:',
          content: '📋 Paso 1 - Identificar la columna correcta:\n✅ La pregunta pide "importaciones"\n✅ Localizar columna "Importaciones" (tercera columna)\n\n📋 Paso 2 - Extraer todos los valores:\n✅ Productos agrícolas: 6.583,2\n✅ Elementos de transporte: 8.472,6\n✅ Maquinaria: 17.894,1\n✅ Productos industriales: 18.562,6\n✅ Alimentos y bebidas: 12.003,2\n✅ Productos energéticos: 26.039,2\n✅ Automóviles: 18.123,8\n✅ Bienes de consumo: 38.562,7\n✅ Otros bienes: 3.321,3\n\n📋 Paso 3 - Realizar la suma:\n✅ 6583,2 + 8472,6 + 17894,1 + 18562,6 + 12003,2 + 26039,2 + 18123,8 + 38562,7 + 3321,3 = 149.562,7'
        },
        {
          title: '⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)',
          content: '🔍 Método 1: Suma sistemática\n• Escribir todos los valores en una lista\n• Sumar de arriba hacia abajo, llevando decimales\n• Verificar que el resultado esté en las opciones\n\n📊 Método 2: Agrupación por órdenes de magnitud\n• Valores grandes: 38562,7 + 26039,2 + 18562,6 + 18123,8 + 17894,1 ≈ 119.000\n• Valores medianos: 12003,2 + 8472,6 + 6583,2 ≈ 27.000\n• Valores pequeños: 3321,3 ≈ 3.000\n• Total aproximado: 119+27+3 = 149.000 (cerca de 149.562,7)\n\n💰 Método 3: Verificación por descarte\n• 149.562,7 es el único valor que supera 149.000\n• Los demás valores (139k, 142k, 153k) no coinciden con la estimación\n• La diferencia entre opciones es significativa, permite estimación'
        }
      ]
    },
    option_a: '153.263,6',
    option_b: '149.562,7', 
    option_c: '139.528,7',
    option_d: '142.672,5',
    correct_option: 1, // B = 149.562,7 (suma de todas las importaciones)
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

    console.log('✅ Pregunta de Total Importaciones añadida exitosamente');
    console.log('📝 ID:', data[0]?.id);
    console.log('✅ Respuesta correcta: B (149.562,7)');
    console.log('♻️  Reutiliza el componente DataTableQuestion existente');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    console.log('');
    console.log('📊 Suma de importaciones:');
    console.log('   6583,2 + 8472,6 + 17894,1 + 18562,6 + 12003,2');
    console.log('   + 26039,2 + 18123,8 + 38562,7 + 3321,3');
    console.log('   = 149.562,7 millones de euros');

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

addImportacionesTotalQuestion();