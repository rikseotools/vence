import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function addSeriesNumericas31_40() {
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
        question_text: "¿Qué número completaría la siguiente serie? 0.05 0.1 0.3 1.2 6 ?",
        content_data: {
          pattern_type: "multiplicacion",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 0.05, 0.1, 0.3, 1.2, 6, ?
• Analizamos las relaciones multiplicativas entre términos consecutivos:

📊 Patrón identificado:
• 0.05 × 2 = 0.1
• 0.1 × 3 = 0.3
• 0.3 × 4 = 1.2
• 1.2 × 5 = 6
• 6 × 6 = 36

✅ Aplicando el patrón:
• En nuestro caso sería: ×2, ×3, ×4, ×5, ×6...
• El siguiente número: 6 × 6 = 36

La respuesta correcta es B: 36`,
        option_a: "24", option_b: "36", option_c: "10", option_d: "12",
        correct_option: 1
      },
      {
        question_text: "Indique el número que continúa la serie: 3-8-15-24-?",
        content_data: {
          pattern_type: "cuadratica",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 3, 8, 15, 24, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 8 - 3 = 5
• 15 - 8 = 7
• 24 - 15 = 9
• Diferencias: 5, 7, 9... (números impares consecutivos)

✅ Patrón identificado:
• La siguiente diferencia sería: 11
• 24 + 11 = 35

✅ Ejemplo correlativo:
• El número que continúa la serie numérica sería el 9, ya que son los números impares correlativos

La respuesta correcta es C: 35`,
        option_a: "15", option_b: "25", option_c: "35", option_d: "10",
        correct_option: 2
      },
      {
        question_text: "¿Qué dos números deberían reemplazar las interrogaciones en la siguiente serie? 19, 20, 21, ?, ?, 26, 28, 32, 33, 40",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 19, 20, 21, ?, ?, 26, 28, 32, 33, 40
• Tendría una estructura con dos series alternas:

📊 Separando las series:
• 1ª serie: 19, 21, ?, 28, 33 ...iría +2, +3 (tendría que ir el 24), +4, +5...
• 2ª serie: 20, ?, 26, 32, 40...iría +2 (tendría que ir el 22), +4, +6, +8 ...

✅ Aplicando el patrón:
• Resultado: serían los números 22 y 24 los que corresponderían en lugar de los interrogantes

La respuesta correcta es D: 22,24`,
        option_a: "24,25", option_b: "39,48", option_c: "24,22", option_d: "22,24",
        correct_option: 3
      },
      {
        question_text: "¿Qué número continúa la siguiente serie lógica? 8 12 17 51 55 60 180 184 ...",
        content_data: {
          pattern_type: "ciclica",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 8, 12, 17, 51, 55, 60, 180, 184, ?
• Las series cíclicas son una combinación de las correlativas e intercaladas

📊 Patrón identificado:
• Este tipo de series implican realizar una y otra vez las mismas operaciones
• El esquema que sigue nuestra serie se repite de manera constante a lo largo de la misma: +4 +5 ×3; +4 +5 ×3...
• En nuestro caso, para encontrar el número que nos interesa, vendría ahora sumar +5 al último número de la serie: 184 +5 = 189

✅ Aplicando el patrón:
• Siguiente operación en el ciclo: +5
• 184 + 5 = 189

La respuesta correcta es D: 189`,
        option_a: "187", option_b: "552", option_c: "188", option_d: "189",
        correct_option: 3
      },
      {
        question_text: "Indique el número incorrecto de la serie: 3 - 6 - 12 - 24 - 48 - 98 - 192 - 384:",
        content_data: {
          pattern_type: "error_correction",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 3, 6, 12, 24, 48, 98, 192, 384
• Analizamos el patrón de multiplicación por 2:

📊 Verificación del patrón:
• 3 × 2 = 6 ✅
• 6 × 2 = 12 ✅
• 12 × 2 = 24 ✅
• 24 × 2 = 48 ✅
• 48 × 2 = 96 (no 98) ❌
• 96 × 2 = 192 ✅
• 192 × 2 = 384 ✅

✅ Error identificado:
• El número incorrecto es 98, debería ser 96

La respuesta correcta es A: 98`,
        option_a: "98", option_b: "48", option_c: "192", option_d: "96",
        correct_option: 0
      },
      {
        question_text: "Indique el número que continúa la serie: 5-7-14-17-19-38-29-?-62",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 5, 7, 14, 17, 19, 38, 29, ?, 62
• Analizamos las posiciones alternas:

📊 Separando las series:
• Posiciones impares: 5, 14, 19, 29, ? (falta uno)
• Posiciones pares: 7, 17, 38, 62

✅ Patrón identificado:
• Los números impares correlativos: 7, 9, 11, 13, 15...
• El número que continúa la serie numérica sería el 9, ya que son los números impares correlativos

✅ Aplicando el patrón:
• Siguiente número en la serie: 31

La respuesta correcta es C: 31`,
        option_a: "33", option_b: "30", option_c: "31", option_d: "32",
        correct_option: 2
      },
      {
        question_text: "Indique el/los números que continuaría la siguiente serie: 1,1,2,6,1,2,3,4,1, ?",
        content_data: {
          pattern_type: "repetitiva_secuencial",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 1, 1, 2, 6, 1, 2, 3, 4, 1, ?
• Podemos observar dos series:

📊 Separando las secuencias:
• Por un lado: 1, 3, 5, ?
• Por otro lado: 1, 2, 3.

✅ Patrón identificado:
• El número que continuaría la serie sería el 7, porque es el único que continúa con la lógica de toda la serie

✅ Solución completa:
• Ejemplo: 1, 1, 3, 2, 5, 3 ?
• Podemos observar dos series:
• O Por un lado: 1, 3, 5, ?
• O Por otro lado: 1, 2, 3.
• El número que continuaría la serie sería el 7, porque es el único que continúa con la lógica de toda la serie

La respuesta correcta es A: 1`,
        option_a: "1", option_b: "5", option_c: "3", option_d: "2",
        correct_option: 0
      },
      {
        question_text: "Encuentre la lógica de la siguiente serie e indique el número que tendría que continuarla: 2 7 11 14 19 23 26 ...",
        content_data: {
          pattern_type: "ciclica",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 2, 7, 11, 14, 19, 23, 26, ?
• Las series cíclicas son una combinación de las correlativas e intercaladas

📊 Patrón identificado:
• Este tipo de series implican realizar una y otra vez las mismas operaciones
• En nuestra serie, hay un esquema matemático que se va repitiendo: +5 +4 +3; +5 +4 +3; y así sucesivamente
• En la serie correspondería sumar +5 al último número de la serie: 26 +5 = 31

✅ Aplicando el patrón:
• Siguiente operación en el ciclo: +5
• 26 + 5 = 31
• La serie quedaría: 2 7 11 14 19 23 26 31...

La respuesta correcta es A: 31`,
        option_a: "31", option_b: "32", option_c: "29", option_d: "30",
        correct_option: 0
      },
      {
        question_text: "Indique el número que iría en lugar del interrogante: 19 26 35 46 59 ?",
        content_data: {
          pattern_type: "diferencias_crecientes",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 19, 26, 35, 46, 59, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 26 - 19 = 7
• 35 - 26 = 9
• 46 - 35 = 11
• 59 - 46 = 13
• Diferencias: 7, 9, 11, 13, 15... (números impares a partir del 7)

✅ Solución:
• 19 (+7) 26 (+9) 35 (+11) 46 (+13) 59 (+15) 74
• La serie va incrementándose con la suma de los impares a partir del 7: 7, 9, 11, 13, 15...

La respuesta correcta es A: 74`,
        option_a: "74", option_b: "76", option_c: "87", option_d: "",
        correct_option: 0
      },
      {
        question_text: "Indique el número que continúa la serie: 1-3-9-27- 81- ?",
        content_data: {
          pattern_type: "geometrica",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 1, 3, 9, 27, 81, ?
• Analizamos las relaciones multiplicativas:

📊 Patrón geométrico:
• 1 × 3 = 3
• 3 × 3 = 9
• 9 × 3 = 27
• 27 × 3 = 81
• 81 × 3 = 243

✅ Patrón identificado:
• Serie geométrica con razón 3
• Cada término se multiplica por 3 para obtener el siguiente

La respuesta correcta es B: 243`,
        option_a: "222", option_b: "243", option_c: "254", option_d: "244",
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
        console.log(`❌ Error en pregunta ${i+31}:`, error.message)
      } else {
        insertedIds.push(data[0]?.id)
        console.log(`✅ Pregunta ${i+31} añadida: ${data[0]?.id}`)
      }
    }
    
    console.log('')
    console.log('🎯 RESUMEN FINAL:')
    console.log(`✅ ${insertedIds.length} preguntas de series numéricas añadidas (P31-P40)`)
    console.log('')
    console.log('🔗 LINKS DE DEBUG INDIVIDUALES:')
    insertedIds.forEach((id, index) => {
      console.log(`   P${index + 31}: http://localhost:3000/debug/question/${id}`)
    })
    
    return insertedIds
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
    return []
  }
}

addSeriesNumericas31_40()