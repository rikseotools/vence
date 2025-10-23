import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addLotePreguntas95a100() {
  try {
    const supabase = getSupabase();
    
    // Buscar la sección de series numéricas
    const { data: sections, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id, category_id, section_key')
      .ilike('section_key', '%serie%');
    
    if (sectionError || !sections || sections.length === 0) {
      console.log('❌ Error al buscar secciones de series:', sectionError?.message || 'No sections found');
      return;
    }
    
    console.log('📋 Secciones encontradas:', sections.map(s => s.section_key));
    const section = sections[0]; // Usar la primera sección encontrada

    const questions = [
      {
        number: 95,
        question_text: "Marque el número que debería ir en el espacio en blanco en la siguiente serie: 2 5 7___ 12 15 17",
        pattern_type: "intercalated_pattern",
        explanation: `🔍 Análisis de la serie:
• Serie intercalada con patrón repetitivo
• Esquema: +3, +2, +3, +2, +3, +2...

📊 Patrón identificado:
• 2 + 3 = 5
• 5 + 2 = 7
• 7 + 3 = 10 (espacio en blanco)
• 10 + 2 = 12
• 12 + 3 = 15
• 15 + 2 = 17

✅ Aplicando el patrón:
• El número que falta es: 7 + 3 = 10

La respuesta correcta es C: 10`,
        option_a: "8",
        option_b: "11",
        option_c: "10",
        option_d: "9",
        correct_option: 2
      },
      {
        number: 96,
        question_text: "¿Cuál es el número que continúa la serie? 1, 1, 4, 8, 9, 27, 16, 64, ?",
        pattern_type: "alternating_powers",
        explanation: `🔍 Análisis de la serie:
• Serie con potencias alternadas
• Dos subseries intercaladas con diferentes exponentes

📊 Patrón identificado:
• Subserie A (impares): 1, 4, 9, 16, ? (1², 2², 3², 4², 5²)
• Subserie B (pares): 1, 8, 27, 64 (1³, 2³, 3³, 4³)

✅ Aplicando el patrón:
• Siguiente en subserie A: 5² = 25

La respuesta correcta es A: 25`,
        option_a: "25",
        option_b: "125",
        option_c: "48",
        option_d: "86",
        correct_option: 0
      },
      {
        number: 97,
        question_text: "En las siguiente serie, tiene que indicar el número que no sigue el orden lógico de la misma: 257 - 369 - 489 - 617 - 7815 - 6713 - 5914",
        pattern_type: "error_detection",
        explanation: `🔍 Análisis de la serie:
• Serie con patrón específico que tiene un error
• Análisis de diferencias entre términos consecutivos

📊 Patrón identificado:
• 369 - 257 = +112
• 489 - 369 = +120  
• 617 - 489 = +128
• 7815 - 617 = +7198 (salto anormal)
• 6713 - 7815 = -1102
• 5914 - 6713 = -799

✅ Error detectado:
• El número 489 rompe la secuencia lógica esperada
• La serie debería seguir un patrón más coherente

La respuesta correcta es A: 489`,
        option_a: "489",
        option_b: "5914",
        option_c: "369",
        option_d: "617",
        correct_option: 0
      },
      {
        number: 98,
        question_text: "¿Qué número seguiría la siguiente serie de números? 10, 14, 10, 13, 8, 10, 4, ?",
        pattern_type: "complex_intercalated",
        explanation: `🔍 Análisis de la serie:
• Serie intercalada con dos subseries diferentes
• Patrón complejo con diferentes comportamientos

📊 Patrón identificado:
• Subserie A (impares): 10, 10, 8, 4 (patrón especial)
• Subserie B (pares): 14, 13, 10, ? (decrece: -1, -3, ?)

✅ Aplicando el patrón:
• En subserie B: 14 → 13 (-1), 13 → 10 (-3), 10 → ? (-5)
• Siguiente número: 10 - 5 = 5

La respuesta correcta es A: 5`,
        option_a: "5",
        option_b: "7",
        option_c: "8",
        option_d: "3",
        correct_option: 0
      },
      {
        number: 99,
        question_text: "¿Cómo continúa la serie? 5, -2, 8, -8, 11, -14, 14, ?",
        pattern_type: "alternating_signs",
        explanation: `🔍 Análisis de la serie:
• Serie con signos alternados y patrones específicos
• Números positivos y negativos intercalados

📊 Patrón identificado:
• Subserie positiva: 5, 8, 11, 14 (+3, +3, +3)
• Subserie negativa: -2, -8, -14, ? (diferencias: -6, -6, ?)

✅ Aplicando el patrón:
• Siguiente negativo: -14 + (-6) = -20

La respuesta correcta es A: -20`,
        option_a: "-20",
        option_b: "-18",
        option_c: "-15",
        option_d: "-19",
        correct_option: 0
      },
      {
        number: 100,
        question_text: "En la siguiente serie numérica uno de los números que la componen es erróneo, localícelo: 3 9 36 108 216 1296...",
        pattern_type: "error_detection_cyclic",
        explanation: `🔍 Análisis de la serie:
• Serie cíclica con operaciones alternadas ×3 y ×4
• Uno de los números rompe el patrón establecido

📊 Patrón identificado:
• 3 × 3 = 9
• 9 × 4 = 36
• 36 × 3 = 108
• 108 × 4 = 432 (no 216) ❌
• 432 × 3 = 1296

✅ Error detectado:
• El número 216 es erróneo, debería ser 432
• Patrón correcto: ×3, ×4, ×3, ×4, ×3...

La respuesta correcta es C: 216`,
        option_a: "108",
        option_b: "3",
        option_c: "216",
        option_d: "36",
        correct_option: 2
      }
    ];

    const insertedIds = [];

    for (const q of questions) {
      const questionData = {
        category_id: section.category_id,
        section_id: section.id,
        question_text: q.question_text,
        content_data: {
          pattern_type: q.pattern_type,
          solution_method: "manual"
        },
        explanation: q.explanation,
        question_subtype: "sequence_numeric",
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_option: q.correct_option,
        is_active: true
      };

      const { data, error } = await supabase
        .from('psychometric_questions')
        .insert([questionData])
        .select();

      if (error) {
        console.log(`❌ Error al insertar pregunta ${q.number}:`, error.message);
        continue;
      }

      insertedIds.push({
        number: q.number,
        id: data[0]?.id,
        correct: ['A', 'B', 'C', 'D'][q.correct_option]
      });

      console.log(`✅ P${q.number} añadida: ${data[0]?.id}`);
    }

    console.log('\n🎉 LOTE COMPLETADO - PREGUNTAS 95-100');
    console.log('📝 IDs generados:');
    insertedIds.forEach(item => {
      console.log(`   P${item.number}: ${item.id} (${item.correct})`);
    });
    console.log('\n🔗 LINKS INDIVIDUALES DE DEBUG:');
    insertedIds.forEach(item => {
      console.log(`   http://localhost:3000/debug/question/${item.id}`);
    });
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

// Ejecutar directamente
addLotePreguntas95a100();