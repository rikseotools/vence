import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addLotePreguntas62a76() {
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
        number: 62,
        question_text: "¿Qué número continúa la serie? 3, 9, 5, 15, 7, 21, 9, ?",
        pattern_type: "alternating_pattern",
        explanation: `🔍 Análisis de la serie:
• Serie alternada con dos patrones intercalados
• Patrón A: 3, 5, 7, 9 (números impares consecutivos)
• Patrón B: 9, 15, 21, ? (múltiplos de 3 crecientes)

📊 Patrón identificado:
• Posiciones impares: 3, 5, 7, 9 (+2)
• Posiciones pares: 9, 15, 21, ? 
• 9 = 3×3, 15 = 5×3, 21 = 7×3, ? = 9×3

✅ Aplicando el patrón:
• El siguiente número es: 9 × 3 = 27

La respuesta correcta es C: 27`,
        option_a: "24",
        option_b: "30",
        option_c: "27",
        option_d: "33",
        correct_option: 2
      },
      {
        number: 63,
        question_text: "¿Cuál de estos términos es verdadero al vacío?",
        pattern_type: "logical_concepts",
        explanation: `🔍 Análisis lógico:
• Un término es "verdadero al vacío" cuando su condición es imposible
• En lógica, una implicación con antecedente falso es siempre verdadera

📊 Evaluación de opciones:
• A) "Si llueve, entonces hace sol" - Contradictorio pero no vacío
• B) "Todos los unicornios son blancos" - Verdadero al vacío (no existen unicornios)
• C) "Algunos números son letras" - Falso, no vacío
• D) "Si es lunes, es martes" - Contradictorio pero no vacío

✅ Aplicando el concepto:
• La afirmación sobre unicornios es verdadera al vacío porque el conjunto de unicornios está vacío

La respuesta correcta es B: Todos los unicornios son blancos`,
        option_a: "Si llueve, entonces hace sol",
        option_b: "Todos los unicornios son blancos",
        option_c: "Algunos números son letras",
        option_d: "Si es lunes, es martes",
        correct_option: 1
      },
      {
        number: 64,
        question_text: "¿Qué número falta en la serie? 2, 6, 18, 54, ?",
        pattern_type: "geometric",
        explanation: `🔍 Análisis de la serie:
• Serie geométrica donde cada término se multiplica por 3
• Patrón: cada número × 3 = siguiente número

📊 Patrón identificado:
• 2 × 3 = 6
• 6 × 3 = 18
• 18 × 3 = 54
• 54 × 3 = ?

✅ Aplicando el patrón:
• El siguiente número es: 54 × 3 = 162

La respuesta correcta es A: 162`,
        option_a: "162",
        option_b: "160",
        option_c: "108",
        option_d: "156",
        correct_option: 0
      },
      {
        number: 65,
        question_text: "¿Qué número continúa la serie? 1, 1, 2, 3, 5, 8, 13, ?",
        pattern_type: "fibonacci",
        explanation: `🔍 Análisis de la serie:
• Esta es la famosa serie de Fibonacci
• Patrón: cada número es la suma de los dos anteriores

📊 Patrón identificado:
• 1 + 1 = 2
• 1 + 2 = 3
• 2 + 3 = 5
• 3 + 5 = 8
• 5 + 8 = 13
• 8 + 13 = ?

✅ Aplicando el patrón:
• El siguiente número es: 8 + 13 = 21

La respuesta correcta es D: 21`,
        option_a: "18",
        option_b: "20",
        option_c: "19",
        option_d: "21",
        correct_option: 3
      },
      {
        number: 66,
        question_text: "¿Qué número sigue en la serie? 4, 12, 36, 108, ?",
        pattern_type: "geometric",
        explanation: `🔍 Análisis de la serie:
• Serie geométrica donde cada término se multiplica por 3
• Patrón: cada número × 3 = siguiente número

📊 Patrón identificado:
• 4 × 3 = 12
• 12 × 3 = 36
• 36 × 3 = 108
• 108 × 3 = ?

✅ Aplicando el patrón:
• El siguiente número es: 108 × 3 = 324

La respuesta correcta es B: 324`,
        option_a: "320",
        option_b: "324",
        option_c: "216",
        option_d: "432",
        correct_option: 1
      },
      {
        number: 67,
        question_text: "¿Qué número falta? 7, 14, 28, 56, ?",
        pattern_type: "geometric",
        explanation: `🔍 Análisis de la serie:
• Serie geométrica donde cada término se duplica
• Patrón: cada número × 2 = siguiente número

📊 Patrón identificado:
• 7 × 2 = 14
• 14 × 2 = 28
• 28 × 2 = 56
• 56 × 2 = ?

✅ Aplicando el patrón:
• El siguiente número es: 56 × 2 = 112

La respuesta correcta es C: 112`,
        option_a: "84",
        option_b: "108",
        option_c: "112",
        option_d: "120",
        correct_option: 2
      },
      {
        number: 68,
        question_text: "¿Qué número continúa? 81, 27, 9, 3, ?",
        pattern_type: "geometric_decreasing",
        explanation: `🔍 Análisis de la serie:
• Serie geométrica decreciente donde cada término se divide por 3
• Patrón: cada número ÷ 3 = siguiente número

📊 Patrón identificado:
• 81 ÷ 3 = 27
• 27 ÷ 3 = 9
• 9 ÷ 3 = 3
• 3 ÷ 3 = ?

✅ Aplicando el patrón:
• El siguiente número es: 3 ÷ 3 = 1

La respuesta correcta es A: 1`,
        option_a: "1",
        option_b: "0",
        option_c: "6",
        option_d: "9",
        correct_option: 0
      },
      {
        number: 69,
        question_text: "¿Qué número sigue? 5, 10, 20, 40, ?",
        pattern_type: "geometric",
        explanation: `🔍 Análisis de la serie:
• Serie geométrica donde cada término se duplica
• Patrón: cada número × 2 = siguiente número

📊 Patrón identificado:
• 5 × 2 = 10
• 10 × 2 = 20
• 20 × 2 = 40
• 40 × 2 = ?

✅ Aplicando el patrón:
• El siguiente número es: 40 × 2 = 80

La respuesta correcta es D: 80`,
        option_a: "60",
        option_b: "50",
        option_c: "70",
        option_d: "80",
        correct_option: 3
      },
      {
        number: 70,
        question_text: "Complete la serie: 6, 12, 24, 48, ?",
        pattern_type: "geometric",
        explanation: `🔍 Análisis de la serie:
• Serie geométrica donde cada término se duplica
• Patrón: cada número × 2 = siguiente número

📊 Patrón identificado:
• 6 × 2 = 12
• 12 × 2 = 24
• 24 × 2 = 48
• 48 × 2 = ?

✅ Aplicando el patrón:
• El siguiente número es: 48 × 2 = 96

La respuesta correcta es A: 96`,
        option_a: "96",
        option_b: "72",
        option_c: "84",
        option_d: "60",
        correct_option: 0
      },
      {
        number: 71,
        question_text: "¿Qué número falta en la secuencia? 100, 50, 25, 12.5, ?",
        pattern_type: "geometric_decimal",
        explanation: `🔍 Análisis de la serie:
• Serie geométrica decreciente con decimales
• Patrón: cada número ÷ 2 = siguiente número

📊 Patrón identificado:
• 100 ÷ 2 = 50
• 50 ÷ 2 = 25
• 25 ÷ 2 = 12.5
• 12.5 ÷ 2 = ?

✅ Aplicando el patrón:
• El siguiente número es: 12.5 ÷ 2 = 6.25

La respuesta correcta es C: 6.25`,
        option_a: "6",
        option_b: "6.5",
        option_c: "6.25",
        option_d: "5",
        correct_option: 2
      },
      {
        number: 72,
        question_text: "¿Qué número continúa la serie? 2, 4, 8, 16, 32, ?",
        pattern_type: "geometric_powers",
        explanation: `🔍 Análisis de la serie:
• Serie geométrica de potencias de 2
• Patrón: cada número × 2 = siguiente número

📊 Patrón identificado:
• 2¹ = 2
• 2² = 4
• 2³ = 8
• 2⁴ = 16
• 2⁵ = 32
• 2⁶ = ?

✅ Aplicando el patrón:
• El siguiente número es: 32 × 2 = 64

La respuesta correcta es B: 64`,
        option_a: "48",
        option_b: "64",
        option_c: "56",
        option_d: "72",
        correct_option: 1
      },
      {
        number: 73,
        question_text: "¿Qué número sigue? 3, 6, 12, 24, ?",
        pattern_type: "geometric",
        explanation: `🔍 Análisis de la serie:
• Serie geométrica donde cada término se duplica
• Patrón: cada número × 2 = siguiente número

📊 Patrón identificado:
• 3 × 2 = 6
• 6 × 2 = 12
• 12 × 2 = 24
• 24 × 2 = ?

✅ Aplicando el patrón:
• El siguiente número es: 24 × 2 = 48

La respuesta correcta es D: 48`,
        option_a: "36",
        option_b: "30",
        option_c: "42",
        option_d: "48",
        correct_option: 3
      },
      {
        number: 74,
        question_text: "Complete: 1, 4, 9, 16, 25, ?",
        pattern_type: "perfect_squares",
        explanation: `🔍 Análisis de la serie:
• Serie de números cuadrados perfectos consecutivos
• Patrón: n² donde n = 1, 2, 3, 4, 5, 6...

📊 Patrón identificado:
• 1² = 1
• 2² = 4
• 3² = 9
• 4² = 16
• 5² = 25
• 6² = ?

✅ Aplicando el patrón:
• El siguiente número es: 6² = 36

La respuesta correcta es A: 36`,
        option_a: "36",
        option_b: "30",
        option_c: "35",
        option_d: "49",
        correct_option: 0
      },
      {
        number: 75,
        question_text: "¿Qué número falta? 1, 8, 27, 64, ?",
        pattern_type: "perfect_cubes",
        explanation: `🔍 Análisis de la serie:
• Serie de números cúbicos perfectos consecutivos
• Patrón: n³ donde n = 1, 2, 3, 4, 5...

📊 Patrón identificado:
• 1³ = 1
• 2³ = 8
• 3³ = 27
• 4³ = 64
• 5³ = ?

✅ Aplicando el patrón:
• El siguiente número es: 5³ = 125

La respuesta correcta es C: 125`,
        option_a: "100",
        option_b: "81",
        option_c: "125",
        option_d: "216",
        correct_option: 2
      },
      {
        number: 76,
        question_text: "¿Qué número continúa? 10, 20, 40, 80, ?",
        pattern_type: "geometric",
        explanation: `🔍 Análisis de la serie:
• Serie geométrica donde cada término se duplica
• Patrón: cada número × 2 = siguiente número

📊 Patrón identificado:
• 10 × 2 = 20
• 20 × 2 = 40
• 40 × 2 = 80
• 80 × 2 = ?

✅ Aplicando el patrón:
• El siguiente número es: 80 × 2 = 160

La respuesta correcta es B: 160`,
        option_a: "120",
        option_b: "160",
        option_c: "100",
        option_d: "140",
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

    console.log('\n🎉 LOTE COMPLETADO - PREGUNTAS 62-76');
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
addLotePreguntas62a76();