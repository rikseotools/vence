import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertBoyscoutsDifferenceQuestion() {
  try {
    console.log('🔍 Buscando sección de gráficos en capacidad administrativa...')
    
    // Buscar la categoría de capacidad administrativa
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('*')
      .eq('category_key', 'capacidad-administrativa')
      .single()

    if (categoryError) {
      console.error('❌ Error buscando categoría:', categoryError)
      return
    }

    console.log('✅ Categoría encontrada:', category.display_name)

    // Buscar la sección de gráficos
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('*')
      .eq('category_id', category.id)
      .eq('section_key', 'graficos')
      .single()

    if (sectionError) {
      console.error('❌ Error buscando sección:', sectionError)
      return
    }

    console.log('✅ Sección encontrada:', section.display_name)

    // Datos de la pregunta
    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: '¿Cuál es la diferencia obtenida entre los puntos conseguidos por el equipo 1 y el equipo 3?',
      content_data: {
        chart_data: [
          {"label": "EQUIPO 1", "value": 109, "percentage": 21.8},
          {"label": "EQUIPO 2", "value": 163.5, "percentage": 32.7},
          {"label": "EQUIPO 3", "value": 54.5, "percentage": 10.9},
          {"label": "EQUIPO 4", "value": 172.5, "percentage": 34.5}
        ],
        total_value: 500,
        chart_title: "PUNTOS CONSEGUIDOS",
        question_context: "A continuación se presenta un gráfico. Deberá contestar las preguntas que abarcan desde la 11 hasta la 16. Un grupo de Boyscouts se va a Navacerrada pasar el verano y deciden hacer equipos para resolver un problema. Tenga en cuenta que el total de puntos que se pueden conseguir es de 500.",
        evaluation_description: "Cálculo de diferencias entre valores absolutos obtenidos a partir de porcentajes",
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de calcular valores absolutos a partir de porcentajes en gráficos de sectores y realizar operaciones básicas de resta para encontrar diferencias."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Datos del problema:\n• Total de puntos disponibles: 500 puntos\n• Equipo 1: 21,8% del total\n• Equipo 3: 10,9% del total\n• Pregunta: Diferencia entre equipo 1 y equipo 3\n\n📋 Cálculo de valores absolutos:\n• Equipo 1: (21,8 ÷ 100) × 500 = 0,218 × 500 = 109 puntos\n• Equipo 3: (10,9 ÷ 100) × 500 = 0,109 × 500 = 54,5 puntos\n\n📋 Cálculo de la diferencia:\n• Diferencia = 109 - 54,5 = 54,5 puntos ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo directo con porcentajes\n• 21,8% de 500 = 21,8 × 5 = 109 puntos\n• 10,9% de 500 = 10,9 × 5 = 54,5 puntos\n• Diferencia: 109 - 54,5 = 54,5\n\n📊 Método 2: Diferencia de porcentajes primero\n• Diferencia de %: 21,8% - 10,9% = 10,9%\n• 10,9% de 500 = 54,5 puntos\n\n💰 Método 3: Verificación visual\n• Equipo 1 tiene sector más grande que equipo 3\n• La diferencia debe ser positiva y significativa\n• 54,5 es lógico comparado con el tamaño visual"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Confundir el orden de la resta (54,5 - 109 = -54,5)\n• Usar directamente los porcentajes sin convertir a valores absolutos\n• Calcular mal los porcentajes (21,8% ≠ 21,8 puntos)\n• Sumar en lugar de restar (109 + 54,5 = 163,5)\n• No verificar que el resultado sea lógico vs. el gráfico visual"
          },
          {
            title: "💪 Consejo de oposición",
            content: "Para diferencias en gráficos de sectores: 1) Convierte cada porcentaje a valor absoluto, 2) Resta el menor del mayor, 3) Verifica visualmente que la diferencia sea proporcional al tamaño de los sectores en el gráfico."
          }
        ]
      },
      option_a: '57,5',
      option_b: '109',
      option_c: '56,5',
      option_d: '54,5',
      correct_option: 3, // D = 54,5 (109 - 54,5)
      explanation: null, // Se maneja en el componente
      question_subtype: 'pie_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'percentage_calculation', 'basic_math', 'subtraction'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de diferencia entre equipos...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de diferencia entre equipos añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 54,5 puntos (109 - 54,5)')
    console.log('♻️  Reutiliza el componente PieChartQuestion existente - no se necesitan cambios')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)
    console.log('')
    console.log('🔗 REVISAR DATOS JSON:')
    console.log(`   http://localhost:3000/api/debug/question/${data[0]?.id}`)

    return data[0]?.id

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

insertBoyscoutsDifferenceQuestion()