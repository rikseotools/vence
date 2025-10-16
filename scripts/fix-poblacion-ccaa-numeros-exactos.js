import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function fixPoblacionCCAAnumerosExactos() {
  try {
    console.log('🔧 Actualizando tabla con números exactos para cálculo mental...');
    
    // Buscar la pregunta actual
    const { data: question, error: fetchError } = await supabase
      .from('psychometric_questions')
      .select('content_data')
      .eq('id', '6db5f3d6-a965-4bcf-9ac7-1d03fc28c709')
      .single();

    if (fetchError || !question) {
      console.error('❌ Error al buscar pregunta:', fetchError);
      return;
    }

    // Actualizar content_data con números más simples
    const updatedContentData = {
      ...question.content_data,
      tables: [
        {
          title: 'Datos de población en municipios y CCAA de España',
          headers: ['Municipios', 'Nº hab. 2020', 'Nº hab. 2019', 'Diferencia ±', 'CCAA pertenece', 'Población de la CCAA'],
          rows: [
            ['Medina del Campo', '20416', '20510', '94', 'Castilla y León', '2.500.000'],
            ['Coslada', '81391', '81661', '270', 'C. de Madrid', '6.917.111'],
            ['Muros', '8427', '8506', '129', 'Galicia', '2.699.938'],
            ['Montoro', '9283', '9364', '71', 'Andalucía', '8.600.224'],
            ['Membrilla', '5942', '6005', '63', 'Castilla La Mancha', '2.200.000']
          ],
          highlighted_columns: [4, 5],
          highlighted_rows: [0, 4],
          footer_note: 'Fuente parcial: INE'
        }
      ],
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de organización y manejo de datos tabulares simples. Evalúa la habilidad para localizar información específica de CCAA en diferentes filas y realizar operaciones matemáticas de sustracción mental."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "🔍 PASO 1: Identificar las CCAA objetivo\n• Buscar 'Castilla y León' en la columna CCAA\n• Buscar 'Castilla La Mancha' en la columna CCAA\n• Localizar sus poblaciones respectivas\n\n📋 PASO 2: Extraer las poblaciones\n• Castilla y León: 2.500.000 habitantes\n• Castilla La Mancha: 2.200.000 habitantes\n• Verificar que son las CCAA correctas\n\n🔢 PASO 3: Calcular la diferencia (cálculo mental)\n• Mayor - Menor: 2.500.000 - 2.200.000\n• Diferencia: 300.000 habitantes ✅\n• Castilla y León tiene más población"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Cálculo mental directo\n• 2.500.000 - 2.200.000 = 300.000\n• Números redondos = cálculo inmediato\n\n📊 Método 2: Verificación rápida\n• 25 - 22 = 3 (en centenas de miles)\n• 3 × 100.000 = 300.000\n\n💰 Método 3: Identificación visual\n• Localizar rápidamente las dos CCAA\n• Restar números redondos mentalmente\n• Verificar que la diferencia esté en las opciones"
        }
      ]
    };

    // Actualizar pregunta con nuevos datos y opciones
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        content_data: updatedContentData,
        option_a: '200.000 habitantes',
        option_b: '250.000 habitantes',
        option_c: '300.000 habitantes',
        option_d: '350.000 habitantes',
        correct_option: 2 // C - 300.000
      })
      .eq('id', '6db5f3d6-a965-4bcf-9ac7-1d03fc28c709')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al actualizar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta actualizada con números exactos');
    console.log('📝 ID:', data[0].id);
    console.log('🎯 Datos actualizados:');
    console.log('   • Castilla y León: 2.500.000 habitantes');
    console.log('   • Castilla La Mancha: 2.200.000 habitantes');
    console.log('   • Diferencia: 300.000 habitantes (cálculo mental exacto)');
    console.log('');
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('');
    console.log('🔗 REVISAR PREGUNTA ACTUALIZADA:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

fixPoblacionCCAAnumerosExactos();