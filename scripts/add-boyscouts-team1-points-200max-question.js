import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertBoyscoutsTeam1Points200MaxQuestion() {
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
      question_text: 'A continuación se presenta un gráfico. Un grupo de Boyscouts se va a Navacerrada pasar el verano y deciden hacer equipos para resolver un problema. Si la puntuación máxima obtenida por los cuatro equipos hubiese sido de 200, ¿cuántos puntos hubiese conseguido el equipo 1?',
      content_data: {
        chart_data: [
          {"label": "EQUIPO 1", "value": 43.6, "percentage": 21.8},
          {"label": "EQUIPO 2", "value": 65.4, "percentage": 32.7},
          {"label": "EQUIPO 3", "value": 21.8, "percentage": 10.9},
          {"label": "EQUIPO 4", "value": 69.2, "percentage": 34.6}
        ],
        total_value: 200,
        chart_title: "PUNTOS CONSEGUIDOS",
        question_context: "Un grupo de Boyscouts se va a Navacerrada pasar el verano y deciden hacer equipos para resolver un problema.",
        evaluation_description: "Cálculo de puntos de un equipo específico basado en porcentaje y puntuación máxima total",
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de interpretar gráficos de sectores, identificar porcentajes específicos y aplicar cálculos de porcentajes sobre totales modificados."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Identificación del porcentaje del Equipo 1:\\\\n• Equipo 1: 21,8% del total\\\\n\\\\n📋 Cálculo con puntuación máxima de 200:\\\\n• Puntos Equipo 1 = 21,8% × 200\\\\n• Puntos Equipo 1 = 0,218 × 200\\\\n• Puntos Equipo 1 = 43,6 puntos ✅\\\\n\\\\n📋 Verificación:\\\\n• 43,6 puntos representan el 21,8% de 200 puntos\\\\n• 43,6 ÷ 200 = 0,218 = 21,8% ✓"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo directo del porcentaje\\\\n• 21,8% × 200 = 43,6 puntos ✅\\\\n\\\\n📊 Método 2: Regla de tres\\\\n• Si 100% = 200 puntos\\\\n• Entonces 21,8% = (21,8 × 200) ÷ 100 = 43,6 puntos ✅\\\\n\\\\n💰 Método 3: Cálculo fraccionario\\\\n• 21,8% = 218/1000\\\\n• (218 × 200) ÷ 1000 = 43.600 ÷ 1000 = 43,6 puntos ✅"
          }
        ]
      },
      option_a: '53,6',
      option_b: '63,4',
      option_c: '47,3',
      option_d: '43,6',
      correct_option: 3, // D = 43,6 (21,8% × 200)
      explanation: null, // Se maneja en el componente
      question_subtype: 'pie_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'percentage_calculation', 'data_extraction', 'basic_multiplication'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de puntos Equipo 1 con máximo 200...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de puntos Equipo 1 con máximo 200 añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 43,6 puntos (21,8% × 200)')
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

insertBoyscoutsTeam1Points200MaxQuestion()