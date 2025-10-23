import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function fixSeriesQuestionsFormat() {
  try {
    const supabase = getSupabase();
    
    // Pregunta 84 - Series decimales
    const question84Update = {
      question_subtype: 'sequence_numeric',
      explanation: null, // Limpiar explanation
      content_data: {
        chart_type: 'sequence_numeric',
        sequence: ['22', '11', '5,5', '2,75', '?'],
        pattern_type: 'division',
        pattern_description: 'Cada número se divide por 2',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de reconocer patrones aritméticos en secuencias numéricas con números decimales y operaciones de división."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Secuencia: 22 → 11 → 5,5 → 2,75 → ?\n\n✅ Observación del patrón:\n• 22 ÷ 2 = 11\n• 11 ÷ 2 = 5,5\n• 5,5 ÷ 2 = 2,75\n• 2,75 ÷ 2 = 1,375\n\n📋 Patrón identificado: División consecutiva por 2"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Observación de la relación entre números consecutivos\n• Calcular 22 ÷ 11 = 2\n• Verificar: 11 ÷ 5,5 = 2\n• Confirmar: 5,5 ÷ 2,75 = 2\n• Aplicar: 2,75 ÷ 2 = 1,375\n\n📊 Método 2: Patrón de división constante\n• Reconocer que cada término es la mitad del anterior\n• Aplicar la regla directamente al último término conocido\n• 2,75 ÷ 2 = 1,375\n\n💰 Método 3: Descarte de opciones\n• Opción A: 1,375 ✅ (Resultado correcto de 2,75 ÷ 2)\n• Opción B: 2,6 ❌ (No sigue el patrón de división por 2)\n• Opción C: 1,47 ❌ (No es resultado de 2,75 ÷ 2)\n• Opción D: 2,70 ❌ (No sigue la progresión de división)"
          }
        ]
      }
    };

    // Pregunta 85 - Series lógicas alternantes
    const question85Update = {
      question_subtype: 'sequence_numeric',
      explanation: null, // Limpiar explanation
      content_data: {
        chart_type: 'sequence_numeric',
        sequence: ['132', '127', '134', '125', '136', '123', '138', '?'],
        pattern_type: 'alternating',
        pattern_description: 'Serie alternante: +2/-5 en posiciones alternas',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de reconocer patrones alternantes complejos en secuencias numéricas, donde existen dos operaciones diferentes aplicadas en posiciones alternas."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Secuencia: 132 → 127 → 134 → 125 → 136 → 123 → 138 → ?\n\n✅ Análisis de posiciones pares e impares:\n\n📋 Posiciones impares (1ª, 3ª, 5ª, 7ª): 132, 134, 136, 138\n• 132 + 2 = 134\n• 134 + 2 = 136\n• 136 + 2 = 138\n• Patrón: +2 constante\n\n📋 Posiciones pares (2ª, 4ª, 6ª, 8ª): 127, 125, 123, ?\n• 127 - 2 = 125\n• 125 - 2 = 123\n• 123 - 2 = 121\n• Patrón: -2 constante"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Separar posiciones pares e impares\n• Escribir solo posiciones impares: 132, 134, 136, 138 (+2)\n• Escribir solo posiciones pares: 127, 125, 123, ? (-2)\n• La 8ª posición (par): 123 - 2 = 121\n\n📊 Método 2: Observar diferencias consecutivas\n• 132 → 127: -5\n• 127 → 134: +7\n• 134 → 125: -9\n• 125 → 136: +11\n• 136 → 123: -13\n• 123 → 138: +15\n• 138 → ?: -17 (138 - 17 = 121)\n\n💰 Método 3: Descarte de opciones\n• Opción A: 125 ❌ (Ya aparece en posición 4)\n• Opción B: 145 ❌ (Demasiado alto para el patrón)\n• Opción C: 121 ✅ (Resultado correcto de 123 - 2)\n• Opción D: 101 ❌ (Demasiado bajo para el patrón)"
          }
        ]
      }
    };

    // Actualizar pregunta 84
    const { error: error84 } = await supabase
      .from('psychometric_questions')
      .update(question84Update)
      .eq('id', '215ce411-6f64-4195-986a-d1e4806551cb');

    if (error84) {
      console.log('❌ Error al actualizar pregunta 84:', error84.message);
    } else {
      console.log('✅ Pregunta 84 actualizada a sequence_numeric con explanation_sections');
    }

    // Actualizar pregunta 85
    const { error: error85 } = await supabase
      .from('psychometric_questions')
      .update(question85Update)
      .eq('id', '57bf9f54-6d43-4b98-9966-ac4befa493d2');

    if (error85) {
      console.log('❌ Error al actualizar pregunta 85:', error85.message);
    } else {
      console.log('✅ Pregunta 85 actualizada a sequence_numeric con explanation_sections');
    }

    console.log('');
    console.log('🔗 REVISAR PREGUNTAS:');
    console.log('   Pregunta 84: http://localhost:3000/debug/question/215ce411-6f64-4195-986a-d1e4806551cb');
    console.log('   Pregunta 85: http://localhost:3000/debug/question/57bf9f54-6d43-4b98-9966-ac4befa493d2');
    console.log('   Debug Batch: http://localhost:3000/debug/batch');

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

fixSeriesQuestionsFormat();