import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function fixSeriesQuestions() {
  try {
    const supabase = getSupabase();
    
    // Pregunta 84 - Series decimales
    const question84Update = {
      question_subtype: 'text_question',
      explanation: `💡 ¿Qué evalúa este ejercicio?
Capacidad de reconocer patrones aritméticos en secuencias numéricas con números decimales y operaciones de división.

📊 ANÁLISIS PASO A PASO:
Secuencia: 22 → 11 → 5,5 → 2,75 → ?

✅ Observación del patrón:
• 22 ÷ 2 = 11
• 11 ÷ 2 = 5,5  
• 5,5 ÷ 2 = 2,75
• 2,75 ÷ 2 = 1,375

📋 Patrón identificado: División consecutiva por 2

⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)

🔍 Método 1: Observación de la relación entre números consecutivos
• Calcular 22 ÷ 11 = 2
• Verificar: 11 ÷ 5,5 = 2
• Confirmar: 5,5 ÷ 2,75 = 2
• Aplicar: 2,75 ÷ 2 = 1,375

📊 Método 2: Patrón de división constante
• Reconocer que cada término es la mitad del anterior
• Aplicar la regla directamente al último término conocido
• 2,75 ÷ 2 = 1,375

💰 Método 3: Descarte de opciones
• Opción A: 1,375 ✅ (Resultado correcto de 2,75 ÷ 2)
• Opción B: 2,6 ❌ (No sigue el patrón de división por 2)
• Opción C: 1,47 ❌ (No es resultado de 2,75 ÷ 2)
• Opción D: 2,70 ❌ (No sigue la progresión de división)`,
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'numeric_sequence',
        evaluation_description: 'Capacidad de reconocer patrones aritméticos en secuencias numéricas'
      }
    };

    // Pregunta 85 - Series lógicas alternantes
    const question85Update = {
      question_subtype: 'text_question',
      explanation: `💡 ¿Qué evalúa este ejercicio?
Capacidad de reconocer patrones alternantes complejos en secuencias numéricas, donde existen dos operaciones diferentes aplicadas en posiciones alternas.

📊 ANÁLISIS PASO A PASO:
Secuencia: 132 → 127 → 134 → 125 → 136 → 123 → 138 → ?

✅ Análisis de posiciones pares e impares:

📋 Posiciones impares (1ª, 3ª, 5ª, 7ª): 132, 134, 136, 138
• 132 + 2 = 134
• 134 + 2 = 136
• 136 + 2 = 138
• Patrón: +2 constante

📋 Posiciones pares (2ª, 4ª, 6ª, 8ª): 127, 125, 123, ?
• 127 - 2 = 125
• 125 - 2 = 123
• 123 - 2 = 121
• Patrón: -2 constante

⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)

🔍 Método 1: Separar posiciones pares e impares
• Escribir solo posiciones impares: 132, 134, 136, 138 (+2)
• Escribir solo posiciones pares: 127, 125, 123, ? (-2)
• La 8ª posición (par): 123 - 2 = 121

📊 Método 2: Observar diferencias consecutivas
• 132 → 127: -5
• 127 → 134: +7
• 134 → 125: -9
• 125 → 136: +11
• 136 → 123: -13
• 123 → 138: +15
• 138 → ?: -17 (138 - 17 = 121)

💰 Método 3: Descarte de opciones
• Opción A: 125 ❌ (Ya aparece en posición 4)
• Opción B: 145 ❌ (Demasiado alto para el patrón)
• Opción C: 121 ✅ (Resultado correcto de 123 - 2)
• Opción D: 101 ❌ (Demasiado bajo para el patrón)`,
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'alternating_sequence',
        evaluation_description: 'Capacidad de reconocer patrones alternantes en secuencias numéricas'
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
      console.log('✅ Pregunta 84 actualizada a text_question');
    }

    // Actualizar pregunta 85
    const { error: error85 } = await supabase
      .from('psychometric_questions')
      .update(question85Update)
      .eq('id', '57bf9f54-6d43-4b98-9966-ac4befa493d2');

    if (error85) {
      console.log('❌ Error al actualizar pregunta 85:', error85.message);
    } else {
      console.log('✅ Pregunta 85 actualizada a text_question');
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

fixSeriesQuestions();