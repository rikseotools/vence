import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addSegurosClasificacion3Question() {
  const questionData = {
    category_id: '55fd4bd0-faf2-4737-8203-4c41e30be41a', // Categoría capacidad-administrativa
    section_id: '72730b63-b10e-4777-b4bd-8fe7b69871a1', // Sección 'tablas' de capacidad-administrativa
    question_text: 'Se trata de un seguro de accidentes de 3000 euros y contratado el 12/10/2016. Según las clasificaciones dadas, ¿cómo debería marcarse?',
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
            ['Importe', '3000 euros'],
            ['Fecha contrato', '12/10/2016']
          ]
        }
      ],
      explanation_sections: [
        {
          title: '💡 ¿Qué evalúa este ejercicio?',
          content: 'Capacidad para aplicar criterios de clasificación verificando que se cumplan TODOS los requisitos de al menos uno de los criterios. En este caso se debe identificar correctamente cuál es el primer criterio que se cumple completamente.'
        },
        {
          title: '📊 ANÁLISIS PASO A PASO:',
          content: '📋 Datos del seguro:\n✅ Tipo: Accidentes\n✅ Importe: 3000 euros\n✅ Fecha: 12/10/2016\n\n📋 Verificación criterio A:\n✅ ¿Incendios o accidentes? → Accidentes ✓\n✅ ¿Entre 1500-4500 euros? → 3000 está en rango ✓\n✅ ¿Entre 15/03/2016 y 10/05/2017? → 12/10/2016 está en rango ✓\n✅ CUMPLE TODOS los requisitos del criterio A\n\n📋 Verificación criterio B (opcional, ya cumple A):\n✅ ¿Vida o accidentes? → Accidentes ✓\n✅ ¿Hasta 3000 euros inclusive? → 3000 exacto ✓\n❌ ¿Entre 15/10/2016 y 20/08/2017? → 12/10/2016 es antes del 15/10/2016\n❌ NO cumple criterio B por fecha\n\n✅ RESULTADO: Cumple criterio A → Marque A'
        },
        {
          title: '⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)',
          content: '🔍 Método 1: Verificación secuencial\n• Empezar por criterio A y verificar todos sus requisitos\n• Si A se cumple completamente, esa es la respuesta\n• No necesitas verificar B, C si A ya cumple\n\n📊 Método 2: Descarte por rangos\n• Fecha 12/10/2016 (octubre 2016)\n• Criterio A: desde 15/03/2016 → SÍ (marzo < octubre)\n• Criterio B: desde 15/10/2016 → NO (12 < 15 octubre)\n• Por fecha, solo A es posible\n\n💰 Método 3: Verificación de tipo\n• Tipo \"accidentes\" encaja en criterios A y B\n• Criterio C pide \"incendios o vida\" → descartado\n• Entre A y B, verificar cuál cumple fecha e importe\n• A cumple ambos, B falla en fecha'
        }
      ]
    },
    option_a: 'C',
    option_b: 'D', 
    option_c: 'B',
    option_d: 'A',
    correct_option: 3, // D = A (cumple criterio A perfectamente)
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

    console.log('✅ Pregunta de Clasificación de Seguros 3 añadida exitosamente');
    console.log('📝 ID:', data[0]?.id);
    console.log('✅ Respuesta correcta: D (A)');
    console.log('♻️  Reutiliza el componente DataTableQuestion existente');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    console.log('');
    console.log('📊 Verificación del criterio A:');
    console.log('   • Tipo: Accidentes ✓ (incendios o accidentes)');
    console.log('   • Importe: 3000€ ✓ (entre 1500-4500€)');
    console.log('   • Fecha: 12/10/2016 ✓ (entre 15/03/2016-10/05/2017)');
    console.log('   • RESULTADO: Cumple criterio A → Marque A');

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

addSegurosClasificacion3Question();