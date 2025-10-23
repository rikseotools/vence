import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function addSeriesNumericas41_50() {
  try {
    const supabase = getSupabase()

    console.log('🔍 Buscando categoría y sección...')
    
    // Buscar categoría Series Numéricas
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'series-numericas')
      .single()
    
    if (categoryError || !category) {
      console.log('❌ Error al encontrar categoría:', categoryError?.message)
      return
    }
    
    console.log('✅ Categoría encontrada:', category.display_name)
    
    // Buscar sección
    const { data: sections, error: sectionsError } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .eq('category_id', category.id)
    
    if (sectionsError || !sections?.length) {
      console.log('❌ Error al encontrar secciones:', sectionsError?.message)
      return
    }
    
    const section = sections[0]
    console.log('✅ Sección encontrada:', section.display_name)

    const preguntas = [
      {
        question_text: "En la siguiente serie, ¿Qué número la continuaría?: 45 43 42 39 37 33 30 25...",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 45, 43, 42, 39, 37, 33, 30, 25, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 45 - 43 = -2
• 43 - 42 = -1  
• 42 - 39 = -3
• 39 - 37 = -2
• 37 - 33 = -4
• 33 - 30 = -3
• 30 - 25 = -5

✅ Patrón identificado:
• El planteamiento numérico sería: -2 -1 -3 -2 -4 -3 -5
• Si nos fijamos habría dos patrones: uno iría alterno -2, -3, -4... y el otro comenzaría por -1, -2, -3...
• En la serie siguiente este patrón tocaría el -4 que es el que interesa para sacar el número que nos piden
• Así, 25 - 4 = 21

La respuesta correcta es D: 21`,
        option_a: "22", option_b: "23", option_c: "20", option_d: "21",
        correct_option: 3
      },
      {
        question_text: "Indique el número que continúa la siguiente serie lógica: 4, 7, 14, 25, 40, 59,...",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 4, 7, 14, 25, 40, 59, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 7 - 4 = 3
• 14 - 7 = 7  
• 25 - 14 = 11
• 40 - 25 = 15
• 59 - 40 = 19
• Diferencias: 3, 7, 11, 15, 19...

✅ Patrón identificado:
• La serie que nos preguntan sigue un patrón fijo: +3 +7 +11 +15 +19... y si nos fijamos, estas cantidades se van incrementándose siguiendo este criterio: +4 +4 +4...
• En nuestro caso sería: +19 (+4) +23 y este valor es el que tendremos que sumar al último número de la serie para localizar el que nos piden: 59 +23 = 82

La respuesta correcta es A: 82`,
        option_a: "82", option_b: "81", option_c: "72", option_d: "80",
        correct_option: 0
      },
      {
        question_text: "Indique la opción que continúa la serie: 1-5-10-16-23-31-?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 1, 5, 10, 16, 23, 31, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 5 - 1 = 4
• 10 - 5 = 5  
• 16 - 10 = 6
• 23 - 16 = 7
• 31 - 23 = 8
• Diferencias: 4, 5, 6, 7, 8...

✅ Patrón identificado:
• Nuestra serie avanza siguiendo el patrón: +4+5+6+7+8+9
• En nuestro caso correspondería +9 al último número de la serie: 31 + 9 = 40

La respuesta correcta es B: 40`,
        option_a: "39", option_b: "40", option_c: "38", option_d: "42",
        correct_option: 1
      },
      {
        question_text: "Indique el número que tendría que continuar la siguiente serie: 14 56 224 896 3584 ...",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 14, 56, 224, 896, 3584, ?
• Analizamos las relaciones multiplicativas:

📊 Patrón geométrico:
• 14 × 4 = 56
• 56 × 4 = 224
• 224 × 4 = 896
• 896 × 4 = 3584
• 3584 × 4 = 14336

✅ Patrón identificado:
• La serie que nos preguntan sigue un patrón fijo: ×4, a partir del último número de la serie 3584 ×4 = 14336. Este es el número buscado
• Nota: habitualmente cuando en una serie numérica existe un incremento o descenso de valores muy alto, lo habitual es que estén utilizando el producto (o división), incluso a veces la potencia, en su planteamiento

La respuesta correcta es B: 14336`,
        option_a: "15336", option_b: "14336", option_c: "14436", option_d: "14236",
        correct_option: 1
      },
      {
        question_text: "Indique la opción que continúa la serie: 1-2-3-1-2-3-?",
        content_data: {
          pattern_type: "repetitiva",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 1, 2, 3, 1, 2, 3, ?
• Analizamos el patrón de repetición:

📊 Patrón identificado:
• Puede darse el hecho de que se nos presenten series en las que no realicemos operaciones entre las cifras que aparezcan, sino que se cumpla una característica matemática
• Nuestra serie sigue un patrón 1-2-3

✅ Aplicando el patrón:
• El ciclo se repite cada 3 números: 1, 2, 3
• Después de 1-2-3-1-2-3, continúa con 1

La respuesta correcta es D: 1`,
        option_a: "2", option_b: "4", option_c: "0", option_d: "1",
        correct_option: 3
      },
      {
        question_text: "¿Qué número seguiría la siguiente serie lógica?: 4 12 11 21 18 30 25...",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 4, 12, 11, 21, 18, 30, 25, ?
• Analizamos las dos series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7): 4, 11, 18, 25, ?
• Serie B (posiciones 2,4,6,8): 12, 21, 30, ?

✅ Patrón identificado:
• En la serie planteada tenemos dos posibles lógicas para explicar que nos llevarían al mismo número:
• 1) un patrón podría ser: +8 -1 +10 -3 +12 -5 +14... alternando, sumamos números pares desde el 8 y el otro sería restando números impares desde el 1. Correspondería sumar +14 al último número de la serie: 25 +14 = 39
• 2) hacer una serie alterna, dos subseries:
• 1) 4 11 18 25...iría sumando +7
• 2) 12 21 30... iría sumando +9. Para resolver el ejercicio por ese alterne tocaría sumar +9 al 30, resultado = 39

La respuesta correcta es D: 39`,
        option_a: "40", option_b: "38", option_c: "37", option_d: "39",
        correct_option: 3
      },
      {
        question_text: "Indique el número que continuaría la siguiente serie: 12 15 16 20 22 27 30 ...",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 12, 15, 16, 20, 22, 27, 30, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 15 - 12 = 3
• 16 - 15 = 1  
• 20 - 16 = 4
• 22 - 20 = 2
• 27 - 22 = 5
• 30 - 27 = 3
• Diferencias: 3, 1, 4, 2, 5, 3...

✅ Patrón identificado:
• En este caso, la serie lleva dos planteamientos matemáticos alternos:
• 1) +3, +4, +5, ...incrementándose
• 2) +1, +2, +3, ...también incrementándose
• En la serie según va alternando, le correspondería sumar +6 al último número de la serie: 30 + 6 = 36

La respuesta correcta es D: 36`,
        option_a: "35", option_b: "33", option_c: "34", option_d: "36",
        correct_option: 3
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 11, 10, 8, 7, 5, 4, ?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 11, 10, 8, 7, 5, 4, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 11 - 10 = -1
• 10 - 8 = -2  
• 8 - 7 = -1
• 7 - 5 = -2
• 5 - 4 = -1
• Diferencias: -1, -2, -1, -2, -1...

✅ Patrón identificado:
• En la serie que se presenta la serie avanza restando 1, restando 2, restando 1, restando 2. Sigue el patrón (-2,-1)
• En nuestro caso correspondería -2 al último número de la serie: 4 - 2 = 2

La respuesta correcta es C: 2`,
        option_a: "4", option_b: "1", option_c: "2", option_d: "0",
        correct_option: 2
      },
      {
        question_text: "En la siguiente serie numérica, ¿Qué número la continuaría? 257 261 266 270 275 279 ¿?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 257, 261, 266, 270, 275, 279, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 261 - 257 = 4
• 266 - 261 = 5  
• 270 - 266 = 4
• 275 - 270 = 5
• 279 - 275 = 4
• Diferencias: 4, 5, 4, 5, 4...

✅ Patrón identificado:
• El patrón alterna entre +4 y +5
• Después de +4, le corresponde +5
• 279 + 5 = 284

La respuesta correcta es B: 284`,
        option_a: "288", option_b: "284", option_c: "283", option_d: "274",
        correct_option: 1
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 2, 7, 12, 17, 22, 27, ?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 2, 7, 12, 17, 22, 27, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 7 - 2 = 5
• 12 - 7 = 5  
• 17 - 12 = 5
• 22 - 17 = 5
• 27 - 22 = 5
• Diferencias: 5, 5, 5, 5, 5...

✅ Patrón identificado:
• En este caso, la serie avanza sumando 5
• 27 + 5 = 32

La respuesta correcta es B: 32`,
        option_a: "33", option_b: "32", option_c: "35", option_d: "37",
        correct_option: 1
      }
    ]

    const insertedIds = []
    
    for (let i = 0; i < preguntas.length; i++) {
      const pregunta = preguntas[i]
      const questionData = {
        category_id: category.id,
        section_id: section.id,
        ...pregunta,
        difficulty: 'medium',
        time_limit_seconds: 120,
        question_subtype: 'sequence_numeric',
        is_active: true,
        is_verified: true
      }

      const { data, error } = await supabase
        .from('psychometric_questions')
        .insert([questionData])
        .select()
      
      if (error) {
        console.log(`❌ Error en pregunta ${i+41}:`, error.message)
      } else {
        insertedIds.push(data[0]?.id)
        console.log(`✅ Pregunta ${i+41} añadida: ${data[0]?.id}`)
      }
    }
    
    console.log('')
    console.log('🎯 RESUMEN FINAL:')
    console.log(`✅ ${insertedIds.length} preguntas de series numéricas añadidas (P41-P50)`)
    console.log('')
    console.log('🔗 LINKS DE DEBUG INDIVIDUALES:')
    insertedIds.forEach((id, index) => {
      console.log(`   P${index + 41}: http://localhost:3000/debug/question/${id}`)
    })
    
    return insertedIds
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
    return []
  }
}

addSeriesNumericas41_50()