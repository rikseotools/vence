import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addCCAAPoblacionQuestion() {
  const questionData = {
    category_id: '55fd4bd0-faf2-4737-8203-4c41e30be41a', // Categoría capacidad-administrativa
    section_id: '72730b63-b10e-4777-b4bd-8fe7b69871a1', // Sección 'tablas' de capacidad-administrativa
    question_text: '¿Quién posee más población: la CC.AA de Madrid o la suma de las CCAA de Castilla y León, Galicia y Castilla La Mancha?',
    content_data: {
      chart_type: 'data_tables',
      chart_title: 'DATOS DE POBLACIÓN EN MUNICIPIOS Y CCAA DE ESPAÑA',
      question_context: '¿Quién posee más población: la CC.AA de Madrid o la suma de las CCAA de Castilla y León, Galicia y Castilla La Mancha?',
      tables: [
        {
          title: 'Datos de población en municipios y CCAA de España',
          headers: ['Municipios', 'Nº hab. 2020', 'Nº hab. 2019', 'Diferen. (-)', 'CCAA pertenece', 'Población de la CCAA'],
          rows: [
            ['Medina del Campo', '20416', '20510', '94', 'Castilla y León', '2.383.702'],
            ['Coslada', '81391', '81661', '270', 'C. de Madrid', '6.917.111'],
            ['Muros', '8427', '8556', '129', 'Galicia', '2.699.938'],
            ['Montoro', '9293', '9364', '71', 'Andalucía', '8.600.224'],
            ['Membrilla', '5942', '6005', '63', 'Castilla La Mancha', '2.089.074']
          ]
        }
      ],
      explanation_sections: [
        {
          title: '💡 ¿Qué evalúa este ejercicio?',
          content: 'Capacidad para extraer información específica de una tabla y realizar comparaciones numéricas básicas. Esta habilidad es fundamental para análisis demográficos y comparativos entre regiones administrativas.'
        },
        {
          title: '📊 ANÁLISIS PASO A PASO:',
          content: '📋 Paso 1 - Identificar población de Madrid:\n✅ C. de Madrid: 6.917.111 habitantes\n\n📋 Paso 2 - Identificar poblaciones a sumar:\n✅ Castilla y León: 2.383.702 habitantes\n✅ Galicia: 2.699.938 habitantes  \n✅ Castilla La Mancha: 2.089.074 habitantes\n\n📋 Paso 3 - Calcular suma de las tres CCAA:\n✅ 2.383.702 + 2.699.938 + 2.089.074 = 7.172.714 habitantes\n\n📋 Paso 4 - Comparar:\n✅ Madrid: 6.917.111 habitantes\n✅ Suma tres CCAA: 7.172.714 habitantes\n✅ 7.172.714 > 6.917.111 → La suma de las tres CCAA tiene más población'
        },
        {
          title: '⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)',
          content: '🔍 Método 1: Localización directa\n• Buscar "C. de Madrid" en columna CCAA → 6.917.111\n• Buscar las otras tres CCAA en la tabla\n• Sumar las tres poblaciones\n\n📊 Método 2: Estimación rápida\n• Madrid: ~6,9 millones\n• Las otras tres: ~2,4 + 2,7 + 2,1 ≈ 7,2 millones\n• 7,2 > 6,9 → La suma es mayor\n\n💰 Método 3: Verificación mental\n• Solo Castilla y León + Galicia ya suman ~5,1 millones\n• Añadiendo Castilla La Mancha (~2,1) = ~7,2 millones\n• Claramente mayor que los 6,9 millones de Madrid'
        }
      ]
    },
    option_a: 'La suma de las tres CCAA',
    option_b: 'Comunidad de Madrid', 
    option_c: 'Tienen la misma población',
    option_d: 'No se puede calcular',
    correct_option: 0, // A = La suma de las tres CCAA (7.172.714 > 6.917.111)
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

    console.log('✅ Pregunta de CCAA Población añadida exitosamente');
    console.log('📝 ID:', data[0]?.id);
    console.log('✅ Respuesta correcta: A (La suma de las tres CCAA)');
    console.log('♻️  Reutiliza el componente DataTableQuestion existente');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    console.log('');
    console.log('📊 Comparación de poblaciones:');
    console.log('   • Madrid: 6.917.111 habitantes');
    console.log('   • Castilla y León: 2.383.702');
    console.log('   • Galicia: 2.699.938');
    console.log('   • Castilla La Mancha: 2.089.074');
    console.log('   • SUMA tres CCAA: 7.172.714 habitantes');
    console.log('   • 7.172.714 > 6.917.111 → La suma es mayor');

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

addCCAAPoblacionQuestion();