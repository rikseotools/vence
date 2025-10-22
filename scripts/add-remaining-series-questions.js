import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const questionsData = [
  {
    number: "07",
    question_text: "Continúe la siguiente serie numérica: 1, 2, 1, 3, 1, 4, ?",
    option_a: "5",
    option_b: "2", 
    option_c: "3",
    option_d: "1",
    correct_option: 3, // D: 1
    explanation: `🔍 Análisis de la serie:
• Esta es una serie intercalada con dos subseries:
• Subserie 1: 1, 1, 1, ? (posiciones 1, 3, 5, 7)
• Subserie 2: 2, 3, 4 (posiciones 2, 4, 6)

📊 Patrón identificado:
• Subserie 1: Siempre 1
• Subserie 2: Números consecutivos crecientes (2, 3, 4...)

✅ Aplicando el patrón:
• La siguiente posición (7) corresponde a la subserie 1
• Por tanto, la respuesta es 1

La respuesta correcta es D: 1`,
    pattern_type: "intercalated_constant"
  },
  {
    number: "08",
    question_text: "Continúe la siguiente serie numérica: 12/6, 12/4, 12/3, 5, 12/2, 7, ?",
    option_a: "12",
    option_b: "9", 
    option_c: "8",
    option_d: "10",
    correct_option: 2, // C: 8
    explanation: `🔍 Análisis de la serie:
• Esta es una serie con dos subseries intercaladas:
• Subserie 1: 12/6, 12/4, 12/3, 12/2, ? → 2, 3, 4, 6, ?
• Subserie 2: 5, 7 (números enteros)

📊 Patrón identificado:
• Subserie 1: 12 dividido por denominadores decrecientes (6,4,3,2...)
• El próximo denominador sería 1.5, pero como son enteros: 12/1.5 = 8
• Subserie 2: Números impares crecientes

✅ Aplicando el patrón:
• 12/1.5 = 8

La respuesta correcta es C: 8`,
    pattern_type: "mixed_fractions"
  },
  {
    number: "09",
    question_text: "Continúe la siguiente serie numérica: 6, 26, 44, 60, 74, 86, ?",
    option_a: "96",
    option_b: "98", 
    option_c: "100",
    option_d: "94",
    correct_option: 0, // A: 96
    explanation: `🔍 Análisis de la serie:
• Calculamos las diferencias entre términos consecutivos:
• 26 - 6 = 20
• 44 - 26 = 18
• 60 - 44 = 16
• 74 - 60 = 14
• 86 - 74 = 12

📊 Patrón identificado:
• Las diferencias van disminuyendo de 2 en 2: 20, 18, 16, 14, 12, ?
• La siguiente diferencia sería: 12 - 2 = 10

✅ Aplicando el patrón:
• 86 + 10 = 96

La respuesta correcta es A: 96`,
    pattern_type: "decreasing_differences"
  },
  {
    number: "10",
    question_text: "Continúe la siguiente serie numérica: 4, 11, 32, 95, ?",
    option_a: "282",
    option_b: "284", 
    option_c: "286",
    option_d: "288",
    correct_option: 1, // B: 284
    explanation: `🔍 Análisis de la serie:
• Analizamos las relaciones entre términos:
• 4 × 3 - 1 = 11
• 11 × 3 - 1 = 32
• 32 × 3 - 1 = 95

📊 Patrón identificado:
• Cada término se multiplica por 3 y se resta 1
• Fórmula: siguiente = (actual × 3) - 1

✅ Aplicando el patrón:
• 95 × 3 - 1 = 285 - 1 = 284

La respuesta correcta es B: 284`,
    pattern_type: "multiplicative_recursive"
  },
  {
    number: "11",
    question_text: "Continúe la siguiente serie: H, H, I, J, H, K, L, M, H, N, Ñ, O, ?",
    option_a: "H",
    option_b: "P", 
    option_c: "Q",
    option_d: "R",
    correct_option: 1, // B: P
    explanation: `🔍 Análisis de la serie:
• Esta es una serie de letras con un patrón intercalado:
• La letra H aparece cada 4 posiciones: posiciones 1, 5, 9...
• Entre las H, hay grupos de 3 letras consecutivas del alfabeto:
• Grupo 1: H, I, J
• Grupo 2: H, K, L, M  
• Grupo 3: H, N, Ñ, O

📊 Patrón identificado:
• H aparece sistemáticamente cada 4 posiciones
• Las otras letras van en orden alfabético

✅ Aplicando el patrón:
• Después de O viene P

La respuesta correcta es B: P`,
    pattern_type: "letter_sequence"
  },
  {
    number: "12",
    question_text: "Continúe la siguiente serie numérica: 83, 84, 86, 89, 93, 98, ?",
    option_a: "102",
    option_b: "103", 
    option_c: "104",
    option_d: "105",
    correct_option: 2, // C: 104
    explanation: `🔍 Análisis de la serie:
• Calculamos las diferencias entre términos consecutivos:
• 84 - 83 = 1
• 86 - 84 = 2
• 89 - 86 = 3
• 93 - 89 = 4
• 98 - 93 = 5

📊 Patrón identificado:
• Las diferencias son números consecutivos: 1, 2, 3, 4, 5, ?
• La siguiente diferencia sería: 6

✅ Aplicando el patrón:
• 98 + 6 = 104

La respuesta correcta es C: 104`,
    pattern_type: "consecutive_differences"
  },
  {
    number: "13",
    question_text: "Continúe la siguiente serie numérica: 28, 27, 25, 22, 18, 13, ?",
    option_a: "8",
    option_b: "6", 
    option_c: "9",
    option_d: "7",
    correct_option: 3, // D: 7
    explanation: `🔍 Análisis de la serie:
• Calculamos las diferencias entre términos consecutivos:
• 27 - 28 = -1
• 25 - 27 = -2
• 22 - 25 = -3
• 18 - 22 = -4
• 13 - 18 = -5

📊 Patrón identificado:
• Las diferencias son números consecutivos negativos: -1, -2, -3, -4, -5, ?
• La siguiente diferencia sería: -6

✅ Aplicando el patrón:
• 13 - 6 = 7

La respuesta correcta es D: 7`,
    pattern_type: "consecutive_negative_differences"
  },
  {
    number: "14",
    question_text: "Continúe la siguiente serie numérica: 3, 2, 4, 2, 5, 2, ?",
    option_a: "7",
    option_b: "2", 
    option_c: "5",
    option_d: "6",
    correct_option: 3, // D: 6
    explanation: `🔍 Análisis de la serie:
• Esta es una serie intercalada con dos subseries:
• Subserie 1: 3, 4, 5, ? (posiciones 1, 3, 5, 7)
• Subserie 2: 2, 2, 2 (posiciones 2, 4, 6)

📊 Patrón identificado:
• Subserie 1: Números consecutivos crecientes (3, 4, 5, 6...)
• Subserie 2: Siempre 2

✅ Aplicando el patrón:
• La siguiente posición (7) corresponde a la subserie 1
• Después de 5 viene 6

La respuesta correcta es D: 6`,
    pattern_type: "intercalated_progressive"
  },
  {
    number: "15",
    question_text: "Continúe la siguiente serie numérica: 8, 10, 13, 17, 19, 22, 26, ?",
    option_a: "28",
    option_b: "30", 
    option_c: "29",
    option_d: "31",
    correct_option: 0, // A: 28
    explanation: `🔍 Análisis de la serie:
• Calculamos las diferencias entre términos consecutivos:
• 10 - 8 = 2
• 13 - 10 = 3
• 17 - 13 = 4
• 19 - 17 = 2
• 22 - 19 = 3
• 26 - 22 = 4

📊 Patrón identificado:
• Las diferencias siguen un ciclo: 2, 3, 4, 2, 3, 4, ?
• La siguiente diferencia sería: 2

✅ Aplicando el patrón:
• 26 + 2 = 28

La respuesta correcta es A: 28`,
    pattern_type: "cyclic_differences"
  },
  {
    number: "16",
    question_text: "Continúe la siguiente serie numérica: 9, 5, 7, 4, 5, 3, 3, 2, ?",
    option_a: "1",
    option_b: "4", 
    option_c: "2",
    option_d: "3",
    correct_option: 0, // A: 1
    explanation: `🔍 Análisis de la serie:
• Esta es una serie intercalada con dos subseries:
• Subserie 1: 9, 7, 5, 3, ? (posiciones 1, 3, 5, 7, 9)
• Subserie 2: 5, 4, 3, 2 (posiciones 2, 4, 6, 8)

📊 Patrón identificado:
• Subserie 1: Disminuye de 2 en 2 (9, 7, 5, 3, 1)
• Subserie 2: Disminuye de 1 en 1 (5, 4, 3, 2)

✅ Aplicando el patrón:
• La siguiente posición (9) corresponde a la subserie 1
• Después de 3 viene 1

La respuesta correcta es A: 1`,
    pattern_type: "intercalated_decreasing"
  },
  {
    number: "17",
    question_text: "Continúe la siguiente serie numérica: 2, 5, 10, 13, 26, 29, ?",
    option_a: "58",
    option_b: "32", 
    option_c: "60",
    option_d: "56",
    correct_option: 0, // A: 58
    explanation: `🔍 Análisis de la serie:
• Analizamos las operaciones entre términos:
• 2 + 3 = 5
• 5 × 2 = 10
• 10 + 3 = 13
• 13 × 2 = 26
• 26 + 3 = 29

📊 Patrón identificado:
• Alternancia entre: +3 y ×2
• Secuencia: +3, ×2, +3, ×2, +3, ?
• La siguiente operación sería: ×2

✅ Aplicando el patrón:
• 29 × 2 = 58

La respuesta correcta es A: 58`,
    pattern_type: "alternating_operations"
  },
  {
    number: "18",
    question_text: "Continúe la siguiente serie numérica: 22, 44, 88, 176, 352, 704, ?",
    option_a: "1406",
    option_b: "1408", 
    option_c: "1408",
    option_d: "1410",
    correct_option: 2, // C: 1408
    explanation: `🔍 Análisis de la serie:
• Analizamos las relaciones entre términos:
• 22 × 2 = 44
• 44 × 2 = 88
• 88 × 2 = 176
• 176 × 2 = 352
• 352 × 2 = 704

📊 Patrón identificado:
• Cada término se multiplica por 2 para obtener el siguiente
• Progresión geométrica con razón 2

✅ Aplicando el patrón:
• 704 × 2 = 1408

La respuesta correcta es C: 1408`,
    pattern_type: "geometric_progression"
  },
  {
    number: "19",
    question_text: "Continúe la siguiente serie numérica: 5, 18, 33, 50, 69, 90, ?",
    option_a: "111",
    option_b: "112", 
    option_c: "114",
    option_d: "113",
    correct_option: 3, // D: 113
    explanation: `🔍 Análisis de la serie:
• Analizamos las diferencias entre términos:
• 18 - 5 = 13
• 33 - 18 = 15
• 50 - 33 = 17
• 69 - 50 = 19
• 90 - 69 = 21

📊 Patrón identificado:
• Las diferencias son números impares consecutivos: 13, 15, 17, 19, 21, ?
• La siguiente diferencia sería: 23

✅ Aplicando el patrón:
• 90 + 23 = 113

La respuesta correcta es D: 113`,
    pattern_type: "odd_differences"
  }
]

async function addAllRemainingQuestions() {
  try {
    const supabase = getSupabase()
    
    console.log('🔍 Obteniendo información de categoría y sección...')
    
    // Obtener la categoría y sección
    const { data: category } = await supabase
      .from('psychometric_categories')
      .select('id')
      .eq('category_key', 'series-numericas')
      .single()
    
    const { data: section } = await supabase
      .from('psychometric_sections')
      .select('id')
      .eq('section_key', 'series-numericas')
      .single()
    
    if (!category || !section) {
      console.error('❌ No se encontró la categoría o sección series-numericas')
      return
    }
    
    console.log('✅ Categoría y sección encontradas')
    console.log(`📝 Insertando ${questionsData.length} preguntas...`)
    
    for (const questionInfo of questionsData) {
      console.log(`\n🔄 Procesando pregunta ${questionInfo.number}...`)
      
      const questionData = {
        question_text: questionInfo.question_text,
        question_subtype: "sequence_numeric",
        category_id: category.id,
        section_id: section.id,
        option_a: questionInfo.option_a,
        option_b: questionInfo.option_b,
        option_c: questionInfo.option_c,
        option_d: questionInfo.option_d,
        correct_option: questionInfo.correct_option,
        explanation: questionInfo.explanation,
        content_data: {
          pattern_type: questionInfo.pattern_type,
          solution_method: "manual"
        },
        difficulty: "medium",
        time_limit_seconds: 120,
        cognitive_skills: ["pattern_recognition", "sequence_analysis", "arithmetic"],
        is_active: true,
        is_verified: true
      }
      
      const { data: insertedQuestion, error: insertError } = await supabase
        .from('psychometric_questions')
        .insert(questionData)
        .select()
        .single()
      
      if (insertError) {
        console.error(`❌ Error insertando pregunta ${questionInfo.number}:`, insertError)
        continue
      }
      
      console.log(`✅ Pregunta ${questionInfo.number} insertada exitosamente`)
      console.log(`📊 ID: ${insertedQuestion.id}`)
      console.log(`🔗 URL: http://localhost:3000/debug/question/${insertedQuestion.id}`)
    }
    
    console.log('\n🎉 ¡Todas las preguntas han sido procesadas!')
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

addAllRemainingQuestions()