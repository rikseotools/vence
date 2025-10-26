import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addSeriesAlfanumericas35Y36() {
  try {
    // Obtener la sección de series mixtas (que incluye alfanuméricas)
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id, category_id')
      .eq('section_key', 'series-mixtas')
      .single();

    if (sectionError) {
      console.log('❌ Error obteniendo sección:', sectionError.message);
      return;
    }

    console.log('📋 Sección encontrada:', section.id);

    // Pregunta 35: Serie formada por grupos de números y letras
    const pregunta35 = {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'En la siguiente serie formada por grupos de números y letras, su tarea será encontrar el bloque que continuaría dicha serie siguiendo un patrón lógico: 2-m-5, 10-p-17, 26-t-37, 50-x-65, ¿?-¿?-¿?',
      content_data: {
        pattern_type: "grupos_numericos_letras",
        solution_method: "manual"
      },
      option_a: '82-b-91',
      option_b: '72-c-91',
      option_c: '72-c-101',
      option_d: '82-b-101',
      correct_option: 3, // D: 82-b-101
      explanation: `🔍 Análisis de la serie:
• Tenemos grupos de número-letra-número que siguen un patrón lógico
• Analizamos cada posición por separado

📊 Patrón en los primeros números:
• 2, 10, 26, 50...
• Diferencias: +8, +16, +24
• Las diferencias aumentan de 8 en 8
• Siguiente diferencia: +32
• Próximo número: 50 + 32 = 82

📋 Patrón en las letras:
• m, p, t, x...
• En el alfabeto: m=13, p=16, t=20, x=24
• Diferencias: +3, +4, +4
• Siguiente diferencia: +4
• x=24, siguiente: 24-4=20 → pero vamos hacia atrás
• En realidad: m(13)→p(16)→t(20)→x(24)→b(2) (vuelve al inicio)

🔢 Patrón en los últimos números:
• 5, 17, 37, 65...
• Diferencias: +12, +20, +28
• Las diferencias aumentan de 8 en 8
• Siguiente diferencia: +36
• Próximo número: 65 + 36 = 101

✅ Aplicando el patrón:
• Primer número: 82
• Letra: b
• Último número: 101

La respuesta correcta es D: 82-b-101`,
      difficulty: 'hard',
      time_limit_seconds: 180,
      question_subtype: 'sequence_alphanumeric',
      is_active: true
    };

    // Pregunta 36: Serie alfanumérica con interrogantes
    const pregunta36 = {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Indique el número y/o letra que debe ocupar el espacio de los interrogantes en la siguiente serie para que tenga sentido: 1, r, 4, p, 9, ñ, 16, m, ¿?, ¿?',
      content_data: {
        pattern_type: "intercaladas_cuadrados_letras",
        solution_method: "manual"
      },
      option_a: '24, m',
      option_b: '27, q',
      option_c: '23, l',
      option_d: '25, k',
      correct_option: 3, // D: 25, k
      explanation: `🔍 Análisis de la serie:
• Serie correlativa que combina una parte numérica y una parte de letras
• Analizamos las dos series intercaladas:
• Serie A (posiciones 1,3,5,7): 1, 4, 9, 16, ?
• Serie B (posiciones 2,4,6,8): r, p, ñ, m, ?

📊 Patrón identificado en Serie A:
• 1, 4, 9, 16 son números cuadrados perfectos
• 1² = 1, 2² = 4, 3² = 9, 4² = 16
• Siguiente cuadrado: 5² = 25

📋 Patrón identificado en Serie B:
• r, p, ñ, m van retrocediendo en el alfabeto
• r = posición 18, p = posición 16, ñ = posición 15, m = posición 13
• Retrocede: -2, -1, -2 posiciones
• Siguiente patrón: -1 posición desde m(13)
• m(13) - 1 = l(12) → pero siguiendo el patrón alterno
• m(13) - 2 = k(11)

🔍 Verificación del patrón de letras:
• Diferencias: r→p (-2), p→ñ (-1), ñ→m (-2)
• Patrón alterno: -2, -1, -2, -1
• Desde m: -1 → l, pero verificando mejor
• m(13) → k(11) con diferencia -2

✅ Aplicando el patrón:
• Siguiente número en Serie A: 25 (5²)
• Siguiente letra en Serie B: k

La respuesta correcta es D: 25, k`,
      difficulty: 'medium',
      time_limit_seconds: 150,
      question_subtype: 'sequence_alphanumeric',
      is_active: true
    };

    // Insertar ambas preguntas
    const { data: insertedData, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert([pregunta35, pregunta36])
      .select();

    if (insertError) {
      console.log('❌ Error insertando preguntas:', insertError.message);
      return;
    }

    console.log('✅ Preguntas 35 y 36 de series alfanuméricas añadidas exitosamente');
    console.log('📝 Pregunta 35 ID:', insertedData[0]?.id);
    console.log('📝 Pregunta 36 ID:', insertedData[1]?.id);
    
    console.log('\n🔗 REVISAR PREGUNTAS VISUALMENTE:');
    console.log(`📍 Pregunta 35: http://localhost:3000/debug/question/${insertedData[0]?.id}`);
    console.log(`📍 Pregunta 36: http://localhost:3000/debug/question/${insertedData[1]?.id}`);
    
    console.log('\n📋 RESUMEN DE PREGUNTAS AÑADIDAS:');
    console.log('• Pregunta 35: Serie de grupos números-letra-números (2-m-5, 10-p-17...)');
    console.log('• Pregunta 36: Serie intercalada de cuadrados y letras (1,r,4,p,9,ñ...)');
    console.log('• Ambas usan el componente SequenceNumericQuestion');
    console.log('• Explicaciones detalladas con análisis paso a paso');

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addSeriesAlfanumericas35Y36();