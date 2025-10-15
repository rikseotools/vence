import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addPorcentajePoblacionQuestion() {
  const questionData = {
    category_id: '55fd4bd0-faf2-4737-8203-4c41e30be41a', // Categoría capacidad-administrativa
    section_id: '72730b63-b10e-4777-b4bd-8fe7b69871a1', // Sección 'tablas' de capacidad-administrativa
    question_text: 'Calcule el porcentaje que representa el valor de la diferencia (-) de Coslada respecto a la población de este municipio en el año 2020:',
    content_data: {
      chart_type: 'data_tables',
      chart_title: 'DATOS DE POBLACIÓN EN MUNICIPIOS Y CCAA DE ESPAÑA',
      tables: [
        {
          title: 'Datos de población en municipios y CCAA de España',
          headers: ['Municipios', 'Nº hab. 2020', 'Nº hab. 2019', 'Diferen. (-)', 'CCAA pertenece', 'Población de la CCAA'],
          rows: [
            ['Medina del Campo', '2000', '2050', '50', 'Castilla y León', '2.383.702'],
            ['Coslada', '8000', '8200', '200', 'C. de Madrid', '6.917.111'],
            ['Muros', '1500', '1600', '100', 'Galicia', '2.699.938'],
            ['Montoro', '3000', '3050', '50', 'Andalucía', '8.600.224'],
            ['Membrilla', '1200', '1250', '50', 'Castilla La Mancha', '2.089.074']
          ]
        }
      ],
      explanation_sections: [
        {
          title: '💡 ¿Qué evalúa este ejercicio?',
          content: 'Capacidad para extraer datos específicos de una tabla y realizar cálculos de porcentaje usando la fórmula básica: (parte × 100) ÷ total. Esta habilidad es fundamental en análisis estadísticos y demográficos.'
        },
        {
          title: '📊 ANÁLISIS PASO A PASO:',
          content: '📋 Paso 1 - Identificar datos de Coslada:\n✅ Población 2020: 8000 habitantes\n✅ Diferencia (-): 200 habitantes\n\n📋 Paso 2 - Aplicar fórmula de porcentaje:\n✅ Porcentaje = (diferencia × 100) ÷ población total\n✅ Porcentaje = (200 × 100) ÷ 8000\n✅ Porcentaje = 20000 ÷ 8000\n\n📋 Paso 3 - Realizar cálculo mental:\n✅ 20000 ÷ 8000 = 2,5\n✅ Resultado: 2,5%'
        },
        {
          title: '⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)',
          content: '🔍 Método 1: Simplificación de fracciones\n• 200/8000 = 2/80 = 1/40\n• 1/40 = 0,025 = 2,5%\n\n📊 Método 2: Cálculo directo\n• 200 × 100 = 20000\n• 20000 ÷ 8000 = 2,5\n• Resultado: 2,5%\n\n💰 Método 3: Regla de tres mental\n• Si 8000 habitantes = 100%\n• Entonces 200 habitantes = X%\n• X = (200 × 100) ÷ 8000 = 2,5%\n\n🎯 Método 4: Verificación rápida\n• 2,5% de 8000 = 2,5 × 80 = 200 ✓'
        }
      ]
    },
    option_a: '1,5%',
    option_b: '3,0%', 
    option_c: '2,5%',
    option_d: '2,0%',
    correct_option: 2, // C = 2,5% (200 × 100 ÷ 8000 = 2,5%)
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

    console.log('✅ Pregunta de Porcentaje Población añadida exitosamente');
    console.log('📝 ID:', data[0]?.id);
    console.log('✅ Respuesta correcta: C (2,5%)');
    console.log('♻️  Reutiliza el componente DataTableQuestion existente');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    console.log('');
    console.log('📊 Cálculo del porcentaje:');
    console.log('   • Población Coslada 2020: 8000 habitantes');
    console.log('   • Diferencia (-): 200 habitantes');
    console.log('   • Porcentaje: (200 × 100) ÷ 8000 = 2,5%');
    console.log('   • Verificación: 2,5% de 8000 = 200 ✓');

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

addPorcentajePoblacionQuestion();