import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addSegurosClasificacion2Question() {
  const questionData = {
    category_id: '55fd4bd0-faf2-4737-8203-4c41e30be41a', // Categoría capacidad-administrativa
    section_id: '72730b63-b10e-4777-b4bd-8fe7b69871a1', // Sección 'tablas' de capacidad-administrativa
    question_text: 'Se trata de un seguro de incendios de 4000 euros y contratado el 11/08/2017. Según las clasificaciones dadas, ¿cómo debería marcarse?',
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
            ['Tipo', 'Seguro de incendios'],
            ['Importe', '4000 euros'],
            ['Fecha contrato', '11/08/2017']
          ]
        }
      ],
      explanation_sections: [
        {
          title: '💡 ¿Qué evalúa este ejercicio?',
          content: 'Capacidad para aplicar criterios de clasificación múltiples verificando que TODOS los requisitos se cumplan simultáneamente. Esta habilidad es crítica en tareas administrativas donde un solo criterio incumplido invalida toda la clasificación.'
        },
        {
          title: '📊 ANÁLISIS PASO A PASO:',
          content: '📋 Datos del seguro:\n✅ Tipo: Incendios\n✅ Importe: 4000 euros\n✅ Fecha: 11/08/2017\n\n📋 Verificación criterio A:\n✅ ¿Incendios o accidentes? → Incendios ✓\n✅ ¿Entre 1500-4500 euros? → 4000 está en rango ✓\n❌ ¿Entre 15/03/2016 y 10/05/2017? → 11/08/2017 está FUERA (después de 10/05/2017)\n❌ NO CUMPLE criterio A\n\n📋 Verificación criterio B:\n❌ ¿Vida o accidentes? → Es incendios (no cumple)\n❌ NO CUMPLE criterio B\n\n📋 Verificación criterio C:\n✅ ¿Incendios o vida? → Incendios ✓\n✅ ¿Entre 2000-5000 euros? → 4000 está en rango ✓\n❌ ¿Entre 10/02/2016 y 15/06/2017? → 11/08/2017 está FUERA (después de 15/06/2017)\n❌ NO CUMPLE criterio C\n\n✅ RESULTADO: Como no cumple A, B, ni C → Marque D'
        },
        {
          title: '⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)',
          content: '🔍 Método 1: Descarte por fecha\n• La fecha es 11/08/2017 (agosto 2017)\n• Criterio A: hasta 10/05/2017 (mayo) → FUERA\n• Criterio B: hasta 20/08/2017 (agosto) → DENTRO\n• Criterio C: hasta 15/06/2017 (junio) → FUERA\n• Solo B podría cumplir por fecha\n\n📊 Método 2: Verificación del criterio B\n• B requiere \"vida o accidentes\" pero tenemos \"incendios\"\n• Por tipo de seguro, B queda descartado\n• Como A y C también fallan por fecha → D\n\n💰 Método 3: Lógica de exclusión\n• Si ningún criterio A, B, C se cumple completamente\n• Automáticamente la respuesta es D\n• No necesitas verificar todos los detalles si ya sabes que uno falla'
        }
      ]
    },
    option_a: 'B',
    option_b: 'C', 
    option_c: 'A',
    option_d: 'D',
    correct_option: 3, // D = D (no cumple ninguno de los criterios A, B, C)
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

    console.log('✅ Pregunta de Clasificación de Seguros 2 añadida exitosamente');
    console.log('📝 ID:', data[0]?.id);
    console.log('✅ Respuesta correcta: D (D)');
    console.log('♻️  Reutiliza el componente DataTableQuestion existente');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    console.log('');
    console.log('📊 Verificación de criterios:');
    console.log('   • Criterio A: Incendios ✓, 4000€ ✓, pero fecha 11/08/2017 > 10/05/2017 ❌');
    console.log('   • Criterio B: Tipo incendios ≠ vida/accidentes ❌');
    console.log('   • Criterio C: Incendios ✓, 4000€ ✓, pero fecha 11/08/2017 > 15/06/2017 ❌');
    console.log('   • RESULTADO: Ninguno cumple → Marque D');

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

addSegurosClasificacion2Question();