import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function addSeriesNumericasLote() {
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
        question_text: "Indique el número de la siguiente serie que la continuaría: 8 7 5 8 12 7 1 8 ...",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Analizamos el patrón matemático que se establece: -, -, +, y repite utilizando la numeración natural comenzando en el 1
• Así quedaría el esquema: -1, -2, +3, +4, -5, -6, +7, +8
• Para ver el número que sigue tocaría sumar +8 al último número de la serie dada: 8 +8 = 16

La respuesta correcta es C: 16`,
        option_a: "2", option_b: "15", option_c: "16", option_d: "0",
        correct_option: 2
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie? 20, 5, 25, 5, 30, 5, ?",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Analizamos las dos series intercaladas:
• Serie A (posiciones 1,3,5,7): 20, 25, 30, ?
• Serie B (posiciones 2,4,6,8): 5, 5, 5, 5

📊 Patrón identificado:
• Serie A: Suma 5 cada vez (20+5=25, 25+5=30, 30+5=35)
• Serie B: Constante, siempre 5

✅ Aplicando el patrón:
• Siguiente término en Serie A: 30 + 5 = 35

La respuesta correcta es B: 35`,
        option_a: "45", option_b: "35", option_c: "5", option_d: "40",
        correct_option: 1
      },
      {
        question_text: "Continúe la serie que se la presenta a continuación: 75 77 92 94 109 111...",
        content_data: {
          pattern_type: "intercaladas",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Analizamos las dos series intercaladas:
• Serie A (posiciones 1,3,5,7): 75, 92, 109, ?
• Serie B (posiciones 2,4,6,8): 77, 94, 111, ?

📊 Patrón identificado:
• Van alternando +2 +15 y este es el esquema que se va repitiendo
• Si seguimos la serie correspondería ahora un +15, sumado al último número que forma la serie saldría 126

✅ Aplicando el patrón:
• 111 + 15 = 126

La respuesta correcta es D: 126`,
        option_a: "116", option_b: "113", option_c: "127", option_d: "126",
        correct_option: 3
      },
      {
        question_text: "Indique la opción que continúa la serie: 11-25-76-255-76-25-?",
        content_data: {
          pattern_type: "repetitiva",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• La serie avanza: 11-25-76-255 y luego retrocede repitiendo los mismo dígitos
• En este caso vemos como la serie avanza: 11-25-76-255 y luego retrocede repitiendo los mismos dígitos

📊 Patrón identificado:
• Se cumple una característica matemática de repetición invertida

✅ Aplicando el patrón:
• Después de 25 viene 11

La respuesta correcta es D: 11`,
        option_a: "410", option_b: "510", option_c: "76", option_d: "11",
        correct_option: 3
      },
      {
        question_text: "Indique el número que continuaría la siguiente serie lógica: 25 28 33 40 49 60 73 ?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• El número que continúa la serie numérica sería el 9, ya que son los números impares correlativos
• Esta serie sigue un posible planteamiento de serie correlativa, es decir, todos los números que componen la serie estarían relacionados: -3 +5 -3 +5 -3 +5 -3

📊 Patrón identificado:
• Aunque también se podría interpretar como una serie intercalada: una serie sería: 7 9 11 13... la serie iría +2 +2 ... y la otra serie sería: 4 6 8 10 la serie igual que la anterior iría +2 +2 +2 ...

✅ Aplicando el patrón:
• Siguiente número: 73 + 15 = 88

La respuesta correcta es D: 88`,
        option_a: "86", option_b: "90", option_c: "78", option_d: "88",
        correct_option: 3
      },
      {
        question_text: "¿Qué número continuaría la siguiente serie? 7 4 9 6 11 8 13 ?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Analizamos las dos series intercaladas:
• Serie A (posiciones 1,3,5,7): 7, 9, 11, 13, ?
• Serie B (posiciones 2,4,6,8): 4, 6, 8, ?

📊 Patrón identificado:
• Esta serie sigue un posible planteamiento de serie correlativa, es decir, todos los números que componen la serie estarían relacionados: -3 +5 -3 +5 -3 +5 -3

✅ Aplicando el patrón:
• Siguiente término en Serie B: 8 + 2 = 10

La respuesta correcta es A: 10`,
        option_a: "10", option_b: "24", option_c: "12", option_d: "15",
        correct_option: 0
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie? 64, 67, 70, 73, 76, 79, ?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• Esta serie avanza sumando 3 correlativos

📊 Patrón identificado:
• Cada número suma 3 al anterior constantemente
• 64+3=67, 67+3=70, 70+3=73, 73+3=76, 76+3=79

✅ Aplicando el patrón:
• 79 + 3 = 82

La respuesta correcta es B: 82`,
        option_a: "81", option_b: "82", option_c: "80", option_d: "84",
        correct_option: 1
      },
      {
        question_text: "¿Qué número seguiría en la siguiente serie? 77, 77, 74, 74, 69, 69, ?",
        content_data: {
          pattern_type: "correlativa",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• En esta pregunta la lógica que sigue; Resta 3, resta 5, ahora tocaría restar 7 puesto que resta los impares correlativos

📊 Patrón identificado:
• Los números se repiten de dos en dos
• El patrón de diferencias: -0, -3, -0, -5, -0, ?
• Siguiendo la secuencia de impares: 3, 5, 7

✅ Aplicando el patrón:
• 69 - 7 = 62

La respuesta correcta es A: 62`,
        option_a: "62", option_b: "41", option_c: "40", option_d: "39",
        correct_option: 0
      },
      {
        question_text: "¿Qué número tendría que ir en el lugar de la interrogante para seguir la estructura lógica de la serie?",
        content_data: {
          pattern_type: "visual_circular",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• La serie va por oposición calculando los dobles: 5 x 2 = 10; 7 x 2 = 14; 9 x 2 = 18

📊 Patrón identificado:
• Cada número se multiplica por 2 para obtener su opuesto
• 5 → 10, 7 → 14, 9 → 18

✅ Aplicando el patrón:
• 9 x 2 = 18

La respuesta correcta es C: 18`,
        option_a: "20", option_b: "22", option_c: "18", option_d: "16",
        correct_option: 2
      },
      {
        question_text: "En la siguiente serie hay un número que es incorrecto. Indique el número que lo sustituiría para que la serie tuviera lógica: 18 - 16 - 13 - 11 - 8 - 5 - 3 - 1",
        content_data: {
          pattern_type: "error_correction",
          solution_method: "manual"
        },
        explanation: `🔍 Análisis de la serie:
• La serie sería: 18 16 13 11 8 5 3 1
• Las diferencias: -2 -3 -2 -3 -2 -3 -2
• Si nos fijamos el equivocado sería el 5, habría que poner un 6 para que la serie tuviera sentido (8 (-2) 6 (-3) 3 (-2) 1....)

📊 Patrón identificado:
• Patrón alternante: -2, -3, -2, -3, -2, -3, -2
• El número 5 rompe este patrón

✅ Aplicando el patrón:
• 8 - 2 = 6 (no 5)

La respuesta correcta es D: 6`,
        option_a: "5", option_b: "8", option_c: "7", option_d: "6",
        correct_option: 3
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
        console.log(`❌ Error en pregunta ${i+1}:`, error.message)
      } else {
        insertedIds.push(data[0]?.id)
        console.log(`✅ Pregunta ${i+1} añadida: ${data[0]?.id}`)
      }
    }
    
    console.log('')
    console.log('🎯 RESUMEN FINAL:')
    console.log(`✅ ${insertedIds.length} preguntas de series numéricas añadidas`)
    console.log('')
    console.log('🔗 LINKS DE DEBUG INDIVIDUALES:')
    insertedIds.forEach((id, index) => {
      console.log(`   P${index + 21}: http://localhost:3000/debug/question/${id}`)
    })
    
    console.log('')
    console.log('🔗 PÁGINA DE NAVEGACIÓN POR LOTES:')
    console.log('   http://localhost:3000/debug/batch')
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
  }
}

addSeriesNumericasLote()