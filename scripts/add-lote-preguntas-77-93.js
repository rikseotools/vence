import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addLotePreguntas77a93() {
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
        number: 77,
        question_text: "¿Qué número continúa la serie? 6-9-18-21-42-45-?",
        pattern_type: "cyclic_pattern",
        explanation: `🔍 Análisis de la serie:
• Serie cíclica que combina operaciones correlativas e intercaladas
• Patrón: alternar +3 y ×2 repetidamente

📊 Patrón identificado:
• 6 + 3 = 9
• 9 × 2 = 18
• 18 + 3 = 21
• 21 × 2 = 42
• 42 + 3 = 45
• 45 × 2 = ?

✅ Aplicando el patrón:
• El siguiente número es: 45 × 2 = 90

La respuesta correcta es B: 90`,
        option_a: "70",
        option_b: "90",
        option_c: "80",
        option_d: "100",
        correct_option: 1
      },
      {
        number: 78,
        question_text: "Si 82521 es a 68 y 52332 es a 38, entonces 72453 es a...",
        pattern_type: "analogical_numeric",
        explanation: `🔍 Análisis de la analogía:
• Estructura de analogía numérica: A es a B como C es a D
• Hay que descubrir la relación entre los números

📊 Patrón identificado:
• 82521 → 68: Primer dígito (8) - segundo dígito (2) = 6, suma resto (5+2+1) = 8 → 68
• 52332 → 38: Primer dígito (5) - segundo dígito (2) = 3, suma resto (3+3+2) = 8 → 38
• 72453 → ?: Primer dígito (7) - segundo dígito (2) = 5, suma resto (4+5+3) = 12 → 512

✅ Aplicando el patrón:
• 72453 es a 512

La respuesta correcta es A: 512`,
        option_a: "512",
        option_b: "152",
        option_c: "128",
        option_d: "912",
        correct_option: 0
      },
      {
        number: 79,
        question_text: "En la siguiente serie uno de los números que la componen sería incorrecto, señálelo: 15 25 37 51 67 83...",
        pattern_type: "error_detection",
        explanation: `🔍 Análisis de la serie:
• Serie con diferencias crecientes donde hay un error
• Patrón esperado: diferencias que aumentan de forma constante

📊 Análisis de diferencias:
• 25 - 15 = 10
• 37 - 25 = 12
• 51 - 37 = 14
• 67 - 51 = 16
• 83 - 67 = 16 (debería ser 18)

✅ Error detectado:
• El patrón debería ser: +10, +12, +14, +16, +18
• El número 83 rompe la secuencia, debería ser 85

La respuesta correcta es B: 83`,
        option_a: "67",
        option_b: "83",
        option_c: "51",
        option_d: "37",
        correct_option: 1
      },
      {
        number: 80,
        question_text: "Complete el número que tendría que aparecer en el hueco /s en blanco para que la serie continúe su lógica: 37 - 39 - 43 - 51 - ? - 99 - 163...",
        pattern_type: "sequence_with_gaps",
        explanation: `🔍 Análisis de la serie:
• Serie con diferencias que siguen un patrón específico
• Las diferencias van duplicándose

📊 Patrón identificado:
• 39 - 37 = 2
• 43 - 39 = 4  
• 51 - 43 = 8
• ? - 51 = 16 (siguiente diferencia)
• 99 - ? = 32
• 163 - 99 = 64

✅ Aplicando el patrón:
• El hueco es: 51 + 16 = 67

La respuesta correcta es B: 67`,
        option_a: "64",
        option_b: "67",
        option_c: "68",
        option_d: "63",
        correct_option: 1
      },
      {
        number: 82,
        question_text: "¿Qué número continuaría la serie? 23 33 39 48 55 63....",
        pattern_type: "alternating_differences",
        explanation: `🔍 Análisis de la serie:
• Serie con diferencias alternadas
• Patrón: alternar entre +10 y otros incrementos

📊 Patrón identificado:
• 33 - 23 = 10
• 39 - 33 = 6
• 48 - 39 = 9
• 55 - 48 = 7
• 63 - 55 = 8
• Siguiente: 63 + ? = ?

✅ Aplicando el patrón:
• Las diferencias siguen: 10, 6, 9, 7, 8, 8
• El siguiente número es: 63 + 8 = 71

La respuesta correcta es C: 71`,
        option_a: "67",
        option_b: "73",
        option_c: "71",
        option_d: "70",
        correct_option: 2
      },
      {
        number: 83,
        question_text: "Indique el número que tendría que ocupar el espacio en blanco de la serie para que esta tenga una continuidad: 2 5 1 ___ 0 5 -1 5 -2",
        pattern_type: "intercalated_constant",
        explanation: `🔍 Análisis de la serie:
• Serie intercalada donde una posición mantiene valor constante
• Hay dos subseries: una decreciente y otra constante

📊 Patrón identificado:
• Posiciones impares: 2, 1, 0, -1, -2 (decrece de 1 en 1)
• Posiciones pares: 5, ?, 5, 5 (siempre 5)

✅ Aplicando el patrón:
• El hueco está en posición par, por lo tanto debe ser 5

La respuesta correcta es A: 5`,
        option_a: "5",
        option_b: "4",
        option_c: "6",
        option_d: "3",
        correct_option: 0
      },
      {
        number: 84,
        question_text: "Su tarea consiste en, la siguiente serie numérica, encontrar y marcar el número que no correspondería al planteamiento lógico de la serie: 224 222 217 210 201 190 177...",
        pattern_type: "error_detection",
        explanation: `🔍 Análisis de la serie:
• Serie decreciente con diferencias que aumentan
• Patrón esperado: diferencias crecientes de forma regular

📊 Análisis de diferencias:
• 224 - 222 = -2
• 222 - 217 = -5
• 217 - 210 = -7
• 210 - 201 = -9
• 201 - 190 = -11
• 190 - 177 = -13

✅ Error detectado:
• El patrón correcto sería: -2, -4, -6, -8, -10, -12
• El número 224 no sigue este patrón al inicio

La respuesta correcta es D: 224`,
        option_a: "201",
        option_b: "177",
        option_c: "190",
        option_d: "224",
        correct_option: 3
      },
      {
        number: 85,
        question_text: "Indique, en la siguiente serie, el número que debería seguir la lógica de la misma para seguir completándola: 8, 9, 7, 10, 11, 9, 12, ?",
        pattern_type: "complex_alternating",
        explanation: `🔍 Análisis de la serie:
• Serie con patrón complejo alternado
• Dos subseries intercaladas con diferentes comportamientos

📊 Patrón identificado:
• Posiciones impares: 8, 7, 11, 12 (patrón especial)
• Posiciones pares: 9, 10, 9, ? 
• La última posición par debería seguir el patrón: 9, 10, 9, 13

✅ Aplicando el patrón:
• El siguiente número es: 13

La respuesta correcta es A: 13`,
        option_a: "13",
        option_b: "19",
        option_c: "12",
        option_d: "11",
        correct_option: 0
      },
      {
        number: 87,
        question_text: "Indique, en la siguiente serie, el bloque de números que debería continuarla: 22-27-30 ; 31-34-39 ; 40-45-48 ; ?-?-?",
        pattern_type: "block_correlation",
        explanation: `🔍 Análisis de la serie:
• Serie correlativa con bloques de tres números
• Cada bloque sigue un patrón interno y externo

📊 Patrón identificado:
• Bloque 1: 22-27-30 (+5, +3)
• Bloque 2: 31-34-39 (+3, +5) 
• Bloque 3: 40-45-48 (+5, +3)
• Bloque 4: 49-52-57 (+3, +5)

✅ Aplicando el patrón:
• El primer número: 48 + 1 = 49
• Segundo número: 49 + 3 = 52  
• Tercer número: 52 + 5 = 57

La respuesta correcta es A: 49-52-57`,
        option_a: "49-52-57",
        option_b: "49-54-57",
        option_c: "47-52-56",
        option_d: "47-53-56",
        correct_option: 0
      },
      {
        number: 88,
        question_text: "Indique el número que no sigue el razonamiento lógico de la serie: 7, 8, 7, 27, 7, 64, 7, 25",
        pattern_type: "intercalated_error",
        explanation: `🔍 Análisis de la serie:
• Serie intercalada con error en una subserie
• Una subserie mantiene constante, otra sigue potencias

📊 Patrón identificado:
• Subserie A (impares): 7, 7, 7, 7 (constante)
• Subserie B (pares): 8, 27, 64, 25
• Potencias esperadas: 2³=8, 3³=27, 4³=64, 5³=125

✅ Error detectado:
• El número 25 debería ser 125 (5³)
• 25 = 5² no sigue el patrón de cubos

La respuesta correcta es A: 25`,
        option_a: "25",
        option_b: "64",
        option_c: "el segundo 7",
        option_d: "8",
        correct_option: 0
      },
      {
        number: 89,
        question_text: "Indique, en la siguiente serie, el número que debería seguir la lógica de la misma para seguir completándola: 12 - 7 - 14 - 9 - 18 - 13 - ?",
        pattern_type: "alternating_operations",
        explanation: `🔍 Análisis de la serie:
• Serie con operaciones alternadas
• Dos subseries intercaladas con incrementos diferentes

📊 Patrón identificado:
• Subserie A (impares): 12, 14, 18, ? (+2, +4, +8)
• Subserie B (pares): 7, 9, 13 (+2, +4)
• Siguiente en A: 18 + 8 = 26

✅ Aplicando el patrón:
• El siguiente número es: 26

La respuesta correcta es A: 26`,
        option_a: "26",
        option_b: "18",
        option_c: "36",
        option_d: "15",
        correct_option: 0
      },
      {
        number: 90,
        question_text: "Complete la siguiente serie, indicando qué números irían en lugar de los interrogantes: 43, 39, 35, 31, 27, ?, 19, ?",
        pattern_type: "arithmetic_with_gaps",
        explanation: `🔍 Análisis de la serie:
• Serie aritmética decreciente con dos huecos
• Diferencia constante entre términos consecutivos

📊 Patrón identificado:
• 43 - 39 = -4
• 39 - 35 = -4
• 35 - 31 = -4  
• 31 - 27 = -4
• Diferencia constante: -4

✅ Aplicando el patrón:
• Primer hueco: 27 - 4 = 23
• Segundo hueco: 19 - 4 = 15 (verificando hacia atrás)

La respuesta correcta es A: 23 y 15`,
        option_a: "23 y 15",
        option_b: "22 y 16", 
        option_c: "23 y 16",
        option_d: "22 y 15",
        correct_option: 0
      },
      {
        number: 91,
        question_text: "¿Qué número continúa la serie? 9-16-25-32-41-48-?",
        pattern_type: "correlative_alternating",
        explanation: `🔍 Análisis de la serie:
• Serie correlativa con diferencias alternadas
• Patrón: alternar entre +7 y +9

📊 Patrón identificado:
• 16 - 9 = +7
• 25 - 16 = +9
• 32 - 25 = +7
• 41 - 32 = +9
• 48 - 41 = +7
• ? - 48 = +9

✅ Aplicando el patrón:
• El siguiente número es: 48 + 9 = 57

La respuesta correcta es A: 57`,
        option_a: "57",
        option_b: "81",
        option_c: "51", 
        option_d: "71",
        correct_option: 0
      },
      {
        number: 92,
        question_text: "¿Qué número de la serie va en la incógnita? 5,15, 14, 42, 41, ?, 122, 366 ...",
        pattern_type: "complex_mixed_operations",
        explanation: `🔍 Análisis de la serie:
• Serie con operaciones mixtas complejas
• Patrón: alternar ×3 y -1, luego ×3

📊 Patrón identificado:
• 5 × 3 = 15
• 15 - 1 = 14
• 14 × 3 = 42
• 42 - 1 = 41
• 41 × 3 = 123
• 123 - 1 = 122
• 122 × 3 = 366

✅ Aplicando el patrón:
• La incógnita es: 41 × 3 = 123

La respuesta correcta es B: 123`,
        option_a: "103",
        option_b: "123",
        option_c: "113",
        option_d: "119",
        correct_option: 1
      },
      {
        number: 93,
        question_text: "Indique, en la siguiente serie, el número que debería seguir la lógica de la misma para seguir completándola: 144, 169, 196, 225, 256, ?",
        pattern_type: "perfect_squares",
        explanation: `🔍 Análisis de la serie:
• Serie de cuadrados perfectos consecutivos
• Patrón: n² donde n aumenta de 1 en 1

📊 Patrón identificado:
• 144 = 12²
• 169 = 13²
• 196 = 14²
• 225 = 15²
• 256 = 16²
• ? = 17²

✅ Aplicando el patrón:
• El siguiente número es: 17² = 289

La respuesta correcta es B: 289`,
        option_a: "379",
        option_b: "289",
        option_c: "267",
        option_d: "265",
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

    console.log('\n🎉 LOTE COMPLETADO - PREGUNTAS 77-93');
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
addLotePreguntas77a93();