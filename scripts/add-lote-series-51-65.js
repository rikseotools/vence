import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function addSeriesNumericas51_65() {
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
        question_text: "En la siguiente serie de números, uno de ellos es incorrecto, ¿cuál debería ir en su lugar?: 40-80-160-320-740-1.280",
        content_data: {
          pattern_type: "error_correction",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 40, 80, 160, 320, 740, 1.280
• Verificamos el patrón de multiplicación por 2:

📊 Verificación del patrón:
• 40 × 2 = 80 ✅
• 80 × 2 = 160 ✅
• 160 × 2 = 320 ✅
• 320 × 2 = 640 (no 740) ❌
• 640 × 2 = 1.280 ✅

✅ Error identificado:
• El número incorrecto es 740, debería ser 640
• La serie correcta sería: 40-80-160-320-640-1.280

La respuesta correcta es D: 640`,
        option_a: "320", option_b: "160", option_c: "1280", option_d: "640",
        correct_option: 3
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 3, 4, 6, 7, 9, 10, ?",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 3, 4, 6, 7, 9, 10, ?
• Analizamos las dos series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7): 3, 6, 9, ?
• Serie B (posiciones 2,4,6,8): 4, 7, 10, ?

✅ Patrón identificado:
• El concepto de intercalado hace referencia al hecho de que la relación de los dígitos de la serie no es de uno en uno, sino que vamos saltando cifras
• En este caso: Series alternas 3,6, 9, 12- avanza sumando 3
• También se puede tomar como una serie única que sería: +1, +2, +1, +2 ...

La respuesta correcta es D: 12`,
        option_a: "13", option_b: "19", option_c: "11", option_d: "12",
        correct_option: 3
      },
      {
        question_text: "¿Qué número completaría la siguiente serie lógica? 0,05 - 0,1 - 0,3 - 1,2 - 6, ¿?",
        content_data: {
          pattern_type: "multiplicacion",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 0,05, 0,1, 0,3, 1,2, 6, ?
• Analizamos las relaciones multiplicativas:

📊 Patrón identificado:
• Tenemos que señalar la cifra que corresponde en el lugar del interrogante; al ser correlativa deberemos observar toda la secuencia numérica de la serie para ver la premisa que sigue; todos los números de la serie están relacionados
• El tipo de operaciones que se pueden realizar son sumas, restas, multiplicaciones o incluso divisiones, siendo estas últimas menos probables. También pueden aparecer criterios basados en potencias (números elevados al cuadrado, al cubo...)
• En nuestro caso la estructura sería: ×2 ×3 ×4 ×5 ×6...

✅ Aplicando el patrón:
• 6 × 6 = 36

La respuesta correcta es B: 36`,
        option_a: "24", option_b: "36", option_c: "10", option_d: "12",
        correct_option: 1
      },
      {
        question_text: "Indique el número que sustituiría el valor del interrogante en la siguiente serie lógica: 1 4 6 9 11 14 ¿?",
        content_data: {
          pattern_type: "ciclica",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 1, 4, 6, 9, 11, 14, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 4 - 1 = 3
• 6 - 4 = 2
• 9 - 6 = 3
• 11 - 9 = 2
• 14 - 11 = 3
• Diferencias: 3, 2, 3, 2, 3...

✅ Patrón identificado:
• Las series cíclicas son una combinación de las correlativas e intercaladas
• Este tipo de series implican realizar una y otra vez las mismas operaciones
• La serie planteada va siguiendo el esquema que se repite de +3 +2; +3 +2;...Si vemos la serie en cuestión ahora tendría que ir un +2, entonces al último número 14 le sumamos el +2, resultado 16

La respuesta correcta es B: 16`,
        option_a: "18", option_b: "16", option_c: "17", option_d: "15",
        correct_option: 1
      },
      {
        question_text: "¿Qué número continúa la secuencia 189, 63, 21, _?",
        content_data: {
          pattern_type: "division",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 189, 63, 21, ?
• Analizamos las relaciones divisorias:

📊 Patrón identificado:
• Si observamos la secuencia 189, 63, 21, _? podemos observar que la secuencia se divide entre 3 cada vez por lo que para llegar a nuestro resultado dividimos 21:3=7

✅ Aplicando el patrón:
• 189 ÷ 3 = 63
• 63 ÷ 3 = 21
• 21 ÷ 3 = 7

La respuesta correcta es B: 7`,
        option_a: "3", option_b: "7", option_c: "12", option_d: "9",
        correct_option: 1
      },
      {
        question_text: "Indique el número que continúa la serie: 213 - 435 - 657- ¿?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 213, 435, 657, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 435 - 213 = 222
• 657 - 435 = 222
• Diferencia constante: 222

✅ Patrón identificado:
• La serie avanza sumando 222 constantemente
• 657 + 222 = 879

La respuesta correcta es A: 879`,
        option_a: "879", option_b: "279", option_c: "1879", option_d: "79",
        correct_option: 0
      },
      {
        question_text: "Continúe la siguiente serie: 10, 20, 22, 66, 69, 276, ¿?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 10, 20, 22, 66, 69, 276, ?
• Analizamos las operaciones entre términos:

📊 Patrón identificado:
• Su tarea es señalar la cifra que corresponde en el lugar de la interrogación, por lo que debemos observar toda la secuencia numérica para ver qué premisa sigue
• El tipo de operaciones que se pueden realizar son sumas, restas, multiplicaciones o incluso divisiones, siendo estas últimas menos probables. También pueden aparecer criterios basados en potencias (números elevados al cuadrado, al cubo...)
• La estructura de la serie sería: ×2 +2 ×3 +3 ×4 +4 ... Todos los números se relacionan entre sí

✅ Aplicando el patrón:
• 276 + 4 = 280

La respuesta correcta es B: 280`,
        option_a: "281", option_b: "280", option_c: "1104", option_d: "279",
        correct_option: 1
      },
      {
        question_text: "Indique el número que continúa la serie: 60,13,52,8,44,3,¿?",
        content_data: {
          pattern_type: "ciclica",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 60, 13, 52, 8, 44, 3, ?
• Analizamos el patrón de operaciones:

📊 Patrón identificado:
• En este caso nos encontramos con una serie cíclica donde la serie va restando 8 por lo que, 44-8=36

✅ Aplicando el patrón:
• El patrón parece ser: -8 en ciertos pasos
• 44 - 8 = 36

La respuesta correcta es A: 36`,
        option_a: "36", option_b: "38", option_c: "1", option_d: "34",
        correct_option: 0
      },
      {
        question_text: "Continúe la serie: 4, 7, 10, 13, 16, 12, 8, 4, 9, 14, ¿?",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 4, 7, 10, 13, 16, 12, 8, 4, 9, 14, ?
• Esta es una serie compleja con múltiples patrones intercalados

📊 Patrón identificado:
• Observamos una serie con múltiples subseries intercaladas
• Analizando las posiciones y patrones de crecimiento/decrecimiento
• Se requiere identificar la subserie correspondiente a la posición 11

✅ Aplicando el patrón:
• Siguiendo el análisis de las subseries intercaladas
• El número que continúa sería: 8

La respuesta correcta es D: 8`,
        option_a: "9", option_b: "10", option_c: "12", option_d: "8",
        correct_option: 3
      },
      {
        question_text: "Indique qué número iría en lugar del interrogante: 43 39 35 31 27 ? 19 ?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 43, 39, 35, 31, 27, ?, 19, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 43 - 39 = -4
• 39 - 35 = -4
• 35 - 31 = -4
• 31 - 27 = -4
• Diferencia constante: -4

✅ Patrón identificado:
• Solución: 43 39 35 31 27 23 19 15, la serie se mueve con una constante de (-4)

La respuesta correcta es A: 23, 15`,
        option_a: "23, 15", option_b: "23, 16", option_c: "22, 15", option_d: "",
        correct_option: 0
      },
      {
        question_text: "Indique la opción que continúa la serie: 5-6-4-7-3-8-?",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 5, 6, 4, 7, 3, 8, ?
• Analizamos las dos series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7): 5, 4, 3, ?
• Serie B (posiciones 2,4,6,8): 6, 7, 8, ?

✅ Patrón identificado:
• El concepto de intercalado hace referencia al hecho de que la relación de los dígitos de la serie no es de uno en uno, sino que vamos saltando cifras
• En esta modalidad, para las explicaciones, cobra importancia la posición que ocupan las cifras en la secuencia:
• Hay dígitos que ocupan posiciones impares, es decir, la primera, tercera, quinta, séptima...
• y otros que ocupan las posiciones pares, o sea, segundo, cuarto, sexto, octavo...
• En este ejercicio observamos dos series alternas donde la primera resta 1 y la segunda suma 1

La respuesta correcta es A: 2`,
        option_a: "2", option_b: "1", option_c: "0", option_d: "3",
        correct_option: 0
      },
      {
        question_text: "Indique la opción que continúa la serie: 7-14-7-21-7-28-?",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 7, 14, 7, 21, 7, 28, ?
• Analizamos las dos series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7): 7, 7, 7, ?
• Serie B (posiciones 2,4,6,8): 14, 21, 28, ?

✅ Patrón identificado:
• Tenemos dos series donde el 7 se mantiene constante y la otra serie avanza sumando 7
• La serie B: 14, 21, 28... (múltiplos de 7: 14=7×2, 21=7×3, 28=7×4)
• Siguiendo el patrón, el siguiente sería 7×5 = 35

✅ Pero analizando la posición:
• La posición 7 corresponde a la serie A (constante), por lo que sería 7

La respuesta correcta es B: 7`,
        option_a: "8", option_b: "7", option_c: "6", option_d: "5",
        correct_option: 1
      },
      {
        question_text: "Indique cuál de los siguientes números continúa la secuencia: 48, 2, 24, 2, 12, 2, _",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 48, 2, 24, 2, 12, 2, _
• Analizamos las dos series intercaladas:

📊 Separando las series:
• Serie A (posiciones 1,3,5,7): 48, 24, 12, ?
• Serie B (posiciones 2,4,6,8): 2, 2, 2, ?

📊 Patrón identificado:
• SOLUCIÓN:
• 48, 2, 24, 2, 12, 2, _
• 48 : 2, 24 : 2, 12 : 2, 6
• El primer número se divide entre el segundo, el resultado es el tercero que se divide entre el cuarto y así sucesivamente
• Los números impares son divididos por el par. Por tanto, el primer impar que es 48 se divide entre el primer par que es 2. Obtenemos de resultado el segundo impar que es 24, ese 24 es dividido entre el segundo par que es 2, obtenemos en el tercer impar el resultado que es 12...

✅ Aplicando el patrón:
• 12 ÷ 2 = 6

La respuesta correcta es C: 6`,
        option_a: "5", option_b: "11", option_c: "6", option_d: "15",
        correct_option: 2
      },
      {
        question_text: "Indique la opción que continúa la serie: 1-2-4-7-11-16-?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 1, 2, 4, 7, 11, 16, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 2 - 1 = 1
• 4 - 2 = 2
• 7 - 4 = 3
• 11 - 7 = 4
• 16 - 11 = 5
• Diferencias: 1, 2, 3, 4, 5...

✅ Patrón identificado:
• Nuestra serie: 1-2-4-7-11-16-? avanza +1+2+3+4+5+6

La respuesta correcta es D: 22`,
        option_a: "20", option_b: "23", option_c: "21", option_d: "22",
        correct_option: 3
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie?: 19, 20, 22, 25, 29, 34, ?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Serie: 19, 20, 22, 25, 29, 34, ?
• Analizamos las diferencias entre términos consecutivos:

📊 Análisis de diferencias:
• 20 - 19 = 1
• 22 - 20 = 2
• 25 - 22 = 3
• 29 - 25 = 4
• 34 - 29 = 5
• Diferencias: 1, 2, 3, 4, 5...

✅ Patrón identificado:
• En este caso la serie avanza: Suma 1, suma 2, suma 3, suma 4, suma 5, ahora tocaría sumar 6

✅ Aplicando el patrón:
• 34 + 6 = 40

La respuesta correcta es B: 40`,
        option_a: "42", option_b: "40", option_c: "41", option_d: "39",
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
        console.log(`❌ Error en pregunta ${i+51}:`, error.message)
      } else {
        insertedIds.push(data[0]?.id)
        console.log(`✅ Pregunta ${i+51} añadida: ${data[0]?.id}`)
      }
    }
    
    console.log('')
    console.log('🎯 RESUMEN FINAL:')
    console.log(`✅ ${insertedIds.length} preguntas de series numéricas añadidas (P51-P65)`)
    console.log('')
    console.log('🔗 LINKS DE DEBUG INDIVIDUALES:')
    insertedIds.forEach((id, index) => {
      console.log(`   P${index + 51}: http://localhost:3000/debug/question/${id}`)
    })
    
    return insertedIds
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
    return []
  }
}

addSeriesNumericas51_65()