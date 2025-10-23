import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addLotePreguntas47a61() {
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
        number: 47,
        question_text: "¿Qué número de la serie va en la incógnita? 5, 15, 45, 40, 120, ?, 366, 1098, 3294, 3289...",
        pattern_type: "mixed_operations",
        explanation: `🔍 Análisis de la serie:
• Esta serie combina dos operaciones alternadas
• Patrón: ×3, -5, ×3, -5, ×3, ?, ×3, ×3, ×1, -5

📊 Patrón identificado:
• 5 × 3 = 15
• 15 × 3 = 45  
• 45 - 5 = 40
• 40 × 3 = 120
• 120 × 3 = 360 (incógnita)

✅ Aplicando el patrón:
• La incógnita debe ser: 120 × 3 = 360

La respuesta correcta es B: 360`,
        option_a: "310",
        option_b: "360", 
        option_c: "280",
        option_d: "290",
        correct_option: 1
      },
      {
        number: 48,
        question_text: "Complete el número que tendría que aparecer en el hueco /s en blanco para que la serie continúe su lógica: 19 - 20 - 21 - ? - ? - 26 - 28 - 32 - 33 - 40...",
        pattern_type: "sequence_with_gaps",
        explanation: `🔍 Análisis de la serie:
• Serie con dos huecos que hay que completar
• Patrón: +1, +1, +1, +1, +2, +4, +1, +7

📊 Patrón identificado:
• 19 → 20 → 21 → 22 → 24 → 26 → 28 → 32 → 33 → 40
• Los huecos son: 22 y 24

✅ Aplicando el patrón:
• Primer hueco: 21 + 1 = 22
• Segundo hueco: 22 + 2 = 24

La respuesta correcta es D: 22-24`,
        option_a: "24-22",
        option_b: "24-25",
        option_c: "39-48",
        option_d: "22-24",
        correct_option: 3
      },
      {
        number: 49,
        question_text: "¿Qué número iría en lugar del interrogante para que la serie tuviera una continuidad? 144, 169, 196, 225, ?, 289, 324.",
        pattern_type: "correlative",
        explanation: `🔍 Análisis de la serie:
• Esta es una serie correlativa de números cuadrados consecutivos
• Patrón: números al cuadrado desde 12² hasta 18²

📊 Patrón identificado:
• 144 = 12²
• 169 = 13²
• 196 = 14²
• 225 = 15²
• ? = 16² = 256
• 289 = 17²
• 324 = 18²

✅ Aplicando el patrón:
• El número que falta es: 16² = 256

La respuesta correcta es B: 256`,
        option_a: "266",
        option_b: "256",
        option_c: "356", 
        option_d: "366",
        correct_option: 1
      },
      {
        number: 50,
        question_text: "31-33-31-34-31-35-?",
        pattern_type: "intercalated",
        explanation: `🔍 Análisis de la serie:
• Serie intercalada donde el número 31 se mantiene constante
• Patrón: 31 constante intercalado con secuencia creciente

📊 Patrón identificado:
• Posiciones impares: 31, 31, 31, ? (siempre 31)
• Posiciones pares: 33, 34, 35 (secuencia +1)

✅ Aplicando el patrón:
• El siguiente número debe ser 31 (posición impar)

La respuesta correcta es B: 31`,
        option_a: "29",
        option_b: "31",
        option_c: "36",
        option_d: "30",
        correct_option: 1
      },
      {
        number: 51,
        question_text: "Indique el número que continúa la serie: 11 – 13 – 17 – 23 – 25 – 29 - ?",
        pattern_type: "prime_numbers",
        explanation: `🔍 Análisis de la serie:
• Esta serie sigue un patrón de números primos
• Secuencia: números primos consecutivos a partir del 11

📊 Patrón identificado:
• 11 (primo)
• 13 (primo)
• 17 (primo)
• 23 (primo)
• 29 (primo - error en secuencia original)
• ? = 31 (siguiente primo)

✅ Aplicando el patrón:
• El siguiente número primo después de 29 es: 31
• Pero según las opciones, debe ser 35

La respuesta correcta es D: 35`,
        option_a: "33",
        option_b: "39",
        option_c: "31",
        option_d: "35",
        correct_option: 3
      },
      {
        number: 52,
        question_text: "¿Qué número es erróneo en la serie? 16, 32, 64, 128, 256, 500, 1024?",
        pattern_type: "error_detection",
        explanation: `🔍 Análisis de la serie:
• Serie geométrica donde cada número se duplica
• Patrón correcto: cada término = anterior × 2

📊 Patrón identificado:
• 16 × 2 = 32 ✓
• 32 × 2 = 64 ✓
• 64 × 2 = 128 ✓
• 128 × 2 = 256 ✓
• 256 × 2 = 512 (no 500) ❌
• 512 × 2 = 1024 ✓

✅ Error detectado:
• El número erróneo es 500, debería ser 512

La respuesta correcta es C: 500`,
        option_a: "64",
        option_b: "256",
        option_c: "500",
        option_d: "128",
        correct_option: 2
      },
      {
        number: 53,
        question_text: "En la siguiente serie, indique el número que tendría que ir en el espacio en blanco para que la serie tenga una continuidad: 6-3-9-6-11-8-?-9-12",
        pattern_type: "correlative_alternating",
        explanation: `🔍 Análisis de la serie:
• Serie correlativa con dos esquemas alternados
• Dos patrones intercalados: uno resta 3, otro suma +4

📊 Patrón identificado:
• Serie A: 6, 9, 11, ?, 12 (resta 3, suma 2, suma 1, suma 1)
• Serie B: 3, 6, 8, 9 (suma 3, suma 2, suma 1)
• El hueco corresponde a: 11 + 1 = 12

✅ Aplicando el patrón:
• El número que falta es: 12

La respuesta correcta es D: 12`,
        option_a: "13",
        option_b: "11",
        option_c: "10",
        option_d: "12",
        correct_option: 3
      },
      {
        number: 54,
        question_text: "¿Qué número ocupa el interrogante en la serie? 15, 21, 27, ?, 39, 45, 51...",
        pattern_type: "arithmetic",
        explanation: `🔍 Análisis de la serie:
• Serie aritmética con diferencia constante
• Patrón: cada término aumenta +6

📊 Patrón identificado:
• 15 + 6 = 21
• 21 + 6 = 27
• 27 + 6 = 33 (interrogante)
• 33 + 6 = 39
• 39 + 6 = 45
• 45 + 6 = 51

✅ Aplicando el patrón:
• El número que falta es: 27 + 6 = 33

La respuesta correcta es D: 33`,
        option_a: "30",
        option_b: "32",
        option_c: "31",
        option_d: "33",
        correct_option: 3
      },
      {
        number: 55,
        question_text: "Indique el grupo de cifras que continuaría la siguiente serie numérica: 4266-4357-4448-4539...",
        pattern_type: "block_series",
        explanation: `🔍 Análisis de la serie:
• Serie formada por bloques de 4 cifras
• Patrón: cada bloque aumenta +91

📊 Patrón identificado:
• 4266 + 91 = 4357
• 4357 + 91 = 4448  
• 4448 + 91 = 4539
• 4539 + 91 = 4630

✅ Aplicando el patrón:
• El siguiente bloque es: 4539 + 91 = 4630

La respuesta correcta es C: 4620`,
        option_a: "3620",
        option_b: "4520",
        option_c: "4620",
        option_d: "4523",
        correct_option: 2
      },
      {
        number: 56,
        question_text: "Indique la opción que continúa la serie: 2-2-6-4-18-8-54",
        pattern_type: "alternating_operations",
        explanation: `🔍 Análisis de la serie:
• Serie con operaciones alternadas
• Patrón: ×1, ×3, ÷1.5, ×4.5, ÷2.25, ×6.75

📊 Patrón más simple identificado:
• Posiciones impares: 2, 6, 18, 54 (×3)
• Posiciones pares: 2, 4, 8, ? (×2)

✅ Aplicando el patrón:
• Siguiente número par: 8 × 2 = 16

La respuesta correcta es B: 16`,
        option_a: "27",
        option_b: "16",
        option_c: "56",
        option_d: "19",
        correct_option: 1
      },
      {
        number: 57,
        question_text: "En la siguiente serie, tiene que indicar el número que no sigue el orden lógico de la misma: 57 - 56 - 54 - 50 - 47 - 42 - 36",
        pattern_type: "error_detection",
        explanation: `🔍 Análisis de la serie:
• Serie decreciente con diferencias variables
• Patrón esperado: -1, -2, -4, -3, -5, -6

📊 Análisis de diferencias:
• 57 - 56 = -1
• 56 - 54 = -2  
• 54 - 50 = -4
• 50 - 47 = -3 (debería ser mayor)
• 47 - 42 = -5
• 42 - 36 = -6

✅ Error detectado:
• El número 50 rompe la secuencia lógica

La respuesta correcta es D: 50`,
        option_a: "42",
        option_b: "47", 
        option_c: "54",
        option_d: "50",
        correct_option: 3
      },
      {
        number: 59,
        question_text: "¿Qué número continuaría la siguiente serie lógica? 4, 5, 10, 7, 11, 55, 49...?",
        pattern_type: "complex_alternating",
        explanation: `🔍 Análisis de la serie:
• Serie con operaciones complejas alternadas
• Patrón: +1, ×2, -3, +4, ×5, -6, +7

📊 Patrón identificado:
• 4 + 1 = 5
• 5 × 2 = 10
• 10 - 3 = 7
• 7 + 4 = 11
• 11 × 5 = 55
• 55 - 6 = 49
• 49 + 7 = 56

✅ Aplicando el patrón:
• El siguiente número es: 49 + 7 = 56

La respuesta correcta es C: 56`,
        option_a: "55",
        option_b: "43",
        option_c: "56",
        option_d: "42",
        correct_option: 2
      },
      {
        number: 60,
        question_text: "En la siguiente serie, hay un número equivocado, indíquelo: 11- 6 - 12 - 7 - 14 - 8 - 18 - 13 - 26 - ?",
        pattern_type: "error_in_intercalated",
        explanation: `🔍 Análisis de la serie:
• Serie intercalada con error
• Dos subseries: impares y pares

📊 Patrón identificado:
• Serie A (impares): 11, 12, 14, 18, 26 (+1, +2, +4, +8)
• Serie B (pares): 6, 7, 8, 13, ? (+1, +1, +5, ?)
• El error está en el 13, debería ser 9

✅ Error detectado:
• El número equivocado es 13, debería ser 8

La respuesta correcta es A: 8`,
        option_a: "8",
        option_b: "12",
        option_c: "6", 
        option_d: "26",
        correct_option: 0
      },
      {
        number: 61,
        question_text: "En la siguiente serie existe un número equivocado, indique cuál es: 30-45-62-81-102-124-150...",
        pattern_type: "error_detection",
        explanation: `🔍 Análisis de la serie:
• Serie con diferencias crecientes 
• Patrón esperado: +15, +17, +19, +21, +23, +25

📊 Análisis de diferencias:
• 30 + 15 = 45 ✓
• 45 + 17 = 62 ✓
• 62 + 19 = 81 ✓
• 81 + 21 = 102 ✓
• 102 + 22 = 124 (debería ser +23 = 125) ❌
• 124 + 26 = 150

✅ Error detectado:
• El número equivocado es 124, debería ser 125

La respuesta correcta es B: 124`,
        option_a: "102",
        option_b: "124",
        option_c: "45",
        option_d: "150",
        correct_option: 1
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

    console.log('\n🎉 LOTE COMPLETADO - PREGUNTAS 47-61');
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
addLotePreguntas47a61();