import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addVehiculosHibridosQuestion() {
  const questionData = {
    category_id: '55fd4bd0-faf2-4737-8203-4c41e30be41a', // Categoría capacidad-administrativa
    section_id: '72730b63-b10e-4777-b4bd-8fe7b69871a1', // Sección 'tablas' de capacidad-administrativa
    question_text: '¿Cuál de las cinco marcas comerciales tiene la mayor cantidad de vehículos híbridos y gasolina juntos? (Se exceptúan los vehículos vendidos).',
    content_data: {
      chart_type: 'data_tables',
      chart_title: 'EMPRESA "Ruedas" - VEHÍCULOS POR MARCA',
      tables: [
        {
          title: 'Número de vehículos según el tipo de combustible utilizado y Garantía',
          headers: ['Marcas comerciales', 'Total de vehículos', 'Vehículos híbridos', 'Vehículos gasolina', 'Vehículos diésel', '1 año en vehículo', '3 años en piezas', 'Vehículos vendidos'],
          rows: [
            ['SEAT', '75', '5', '35', '35', 'SI', 'NO', '30'],
            ['VW', '60', '15', '40', '5', 'SI', 'SI', '15'],
            ['RENAULT', '95', '25', '10', '60', 'NO', 'NO', '65'],
            ['VOLVO', '15', '3', '10', '2', 'NO', 'SI', '7'],
            ['BMW', '25', '5', '12', '8', 'NO', 'SI', '10']
          ]
        }
      ],
      explanation_sections: [
        {
          title: '💡 ¿Qué evalúa este ejercicio?',
          content: 'Capacidad para extraer datos específicos de una tabla, realizar sumas básicas y aplicar restricciones (excluir VW de las opciones disponibles). Esta habilidad combina lectura de datos tabulares con análisis de opciones múltiples.'
        },
        {
          title: '📊 ANÁLISIS PASO A PASO:',
          content: '📋 Paso 1 - Calcular híbridos + gasolina por marca:\n✅ SEAT: 5 + 35 = 40 vehículos\n✅ VW: 15 + 40 = 55 vehículos\n✅ RENAULT: 25 + 10 = 35 vehículos\n✅ VOLVO: 3 + 10 = 13 vehículos\n✅ BMW: 5 + 12 = 17 vehículos\n\n📋 Paso 2 - Identificar el mayor:\n✅ VW tiene más (55 vehículos)\n\n📋 Paso 3 - Revisar opciones disponibles:\n❌ VW no aparece en las opciones A, B, C, D\n✅ De las opciones disponibles, SEAT tiene más (40 vehículos)\n✅ Por tanto, la respuesta es A (Seat)'
        },
        {
          title: '⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)',
          content: '🔍 Método 1: Cálculo sistemático\n• Sumar columna híbridos + columna gasolina para cada marca\n• Identificar el valor máximo\n• Verificar si esa marca está en las opciones\n\n📊 Método 2: Descarte por opciones\n• Calcular solo las marcas que aparecen en opciones (A,B,C,D)\n• SEAT: 5+35=40, BMW: 5+12=17, Renault: 25+10=35, Volvo: 3+10=13\n• La mayor de estas es SEAT con 40\n\n💰 Método 3: Verificación rápida\n• VW claramente tiene más (15+40=55) que cualquier otra\n• Pero como no está en opciones, la pregunta busca el mayor disponible\n• SEAT (40) > Renault (35) > BMW (17) > Volvo (13)'
        }
      ]
    },
    option_a: 'Seat',
    option_b: 'BMW', 
    option_c: 'Renault',
    option_d: 'Volvo',
    correct_option: 0, // A = Seat (40 vehículos híbridos+gasolina, mayor de las opciones disponibles)
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

    console.log('✅ Pregunta de Vehículos Híbridos añadida exitosamente');
    console.log('📝 ID:', data[0]?.id);
    console.log('✅ Respuesta correcta: A (Seat)');
    console.log('♻️  Reutiliza el componente DataTableQuestion existente');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`);
    console.log('');
    console.log('📊 Cálculo híbridos + gasolina:');
    console.log('   • SEAT: 5 + 35 = 40 vehículos');
    console.log('   • VW: 15 + 40 = 55 vehículos (no en opciones)');
    console.log('   • RENAULT: 25 + 10 = 35 vehículos');
    console.log('   • VOLVO: 3 + 10 = 13 vehículos');
    console.log('   • BMW: 5 + 12 = 17 vehículos');
    console.log('   • RESULTADO: Seat tiene más de las opciones disponibles');

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

addVehiculosHibridosQuestion();