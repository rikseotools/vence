import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function fixPorcentajeVehiculosSimple() {
  try {
    console.log('🔧 Simplificando datos de vehículos para cálculo mental...');
    
    // Buscar la pregunta actual
    const { data: question, error: fetchError } = await supabase
      .from('psychometric_questions')
      .select('content_data')
      .eq('id', '589b0883-dd0d-494b-8f33-00a9dad1feb9')
      .single();

    if (fetchError || !question) {
      console.error('❌ Error al buscar pregunta:', fetchError);
      return;
    }

    // Actualizar content_data con números más simples para cálculo mental
    const updatedContentData = {
      ...question.content_data,
      tables: [
        {
          title: 'Empresa "Rueda S" - Número de vehículos según el tipo de combustible utilizado - Garantía',
          headers: ['Marcas comerciales', 'Total de vehículos', 'Vehículos híbridos', 'Vehículos gasolina', 'Vehículos diésel', '1 año en vehículo', '3 años en piezas', 'Vehículos vendidos'],
          rows: [
            ['SEAT', '75', '5', '35', '35', 'SI', 'NO', '10'],
            ['VW', '60', '15', '40', '5', 'SI', 'SI', '20'],
            ['RENAULT', '95', '25', '10', '60', 'NO', 'NO', '50'],
            ['VOLVO', '15', '3', '10', '2', 'NO', 'SI', '10'],
            ['BMW', '25', '5', '12', '8', 'NO', 'SI', '10']
          ],
          highlighted_columns: [7], // Resaltar vehículos vendidos
          highlighted_rows: [2], // Resaltar RENAULT
          footer_note: 'Calcular: (Vehículos vendidos Renault / Total vehículos vendidos) × 100'
        }
      ],
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de análisis porcentual en datos comerciales. Evalúa la habilidad para calcular la participación de mercado de una marca específica sobre el total de ventas usando cálculo mental."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "🔍 PASO 1: Identificar datos de Renault\n• Vehículos vendidos Renault: 50\n• Buscar en la fila de RENAULT, columna 'Vehículos vendidos'\n\n📋 PASO 2: Calcular total de vehículos vendidos\n• SEAT: 10\n• VW: 20\n• RENAULT: 50\n• VOLVO: 10\n• BMW: 10\n• Total vendidos: 10 + 20 + 50 + 10 + 10 = 100\n\n🔢 PASO 3: Cálculo mental directo\n• Fórmula: (50 / 100) × 100\n• 50 ÷ 100 = 0,50\n• 0,50 × 100 = 50% ✅"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Cálculo mental inmediato\n• Renault: 50, Total: 100\n• 50/100 = 50% (cálculo mental directo)\n\n📊 Método 2: Verificación visual\n• Renault tiene 50 de 100 vehículos vendidos\n• Es exactamente la mitad = 50%\n\n💰 Método 3: Suma mental rápida\n• Otros: 10+20+10+10 = 50\n• Renault: 50\n• Renault = otros → 50% cada grupo"
        }
      ]
    };

    // Actualizar pregunta con nuevos datos y opciones
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        content_data: updatedContentData,
        option_a: '50 %',
        option_b: '40 %',
        option_c: '60 %',
        option_d: '55 %',
        correct_option: 0 // A - 50%
      })
      .eq('id', '589b0883-dd0d-494b-8f33-00a9dad1feb9')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al actualizar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta simplificada con números para cálculo mental');
    console.log('📝 ID:', data[0].id);
    console.log('🎯 Datos simplificados:');
    console.log('   • RENAULT: 50 vendidos');
    console.log('   • TOTAL vendidos: 100');
    console.log('   • Porcentaje: 50/100 = 50% (cálculo mental directo)');
    console.log('');
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a, '← CORRECTA');
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('');
    console.log('🔗 REVISAR PREGUNTA SIMPLIFICADA:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

fixPorcentajeVehiculosSimple();