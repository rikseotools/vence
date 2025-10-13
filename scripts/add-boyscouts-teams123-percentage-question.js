import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertBoyscoutsTeams123PercentageQuestion() {
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
      question_text: 'A continuación se presenta un gráfico. Deberá contestar las preguntas que abarcan desde la 11 hasta la 16. Un grupo de Boyscouts se va a Navacerrada pasar el verano y deciden hacer equipos para resolver un problema. Tenga en cuenta que el total de puntos que se pueden conseguir es de 500. ¿Qué porcentaje de puntos han conseguido entre los equipos 1,2 y 3?',
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
        evaluation_description: "Suma de porcentajes de múltiples equipos en gráficos de sectores",
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de identificar múltiples sectores en gráficos de sectores, extraer sus porcentajes individuales y realizar sumas básicas para obtener porcentajes acumulados."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Extracción de porcentajes por equipo:\\n• Equipo 1: 21,8%\\n• Equipo 2: 32,7%\\n• Equipo 3: 10,9%\\n• Equipo 4: 34,5% (no incluir)\\n\\n📋 Suma de equipos 1, 2 y 3:\\n• Total = 21,8% + 32,7% + 10,9%\\n• Total = 65,4% ✅\\n\\n📋 Verificación:\\n• Equipos 1+2+3: 65,4%\\n• Equipo 4: 34,5%\\n• Total general: 65,4% + 34,5% = 99,9% ≈ 100% ✓"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma directa de porcentajes\\n• 21,8% + 32,7% + 10,9% = 65,4% ✅\\n\\n📊 Método 2: Agrupación mental\\n• (21,8 + 32,7) + 10,9 = 54,5 + 10,9 = 65,4% ✅\\n\\n💰 Método 3: Verificación por exclusión\\n• Total - Equipo 4 = 100% - 34,5% = 65,5%\\n• Muy cercano a 65,4% (diferencia por redondeo) ✅"
          }
        ]
      },
      option_a: 'El 64,5%',
      option_b: 'El 65,4%',
      option_c: 'El 54,6%',
      option_d: 'El 55,5%',
      correct_option: 1, // B = El 65,4% (21,8% + 32,7% + 10,9%)
      explanation: null, // Se maneja en el componente
      question_subtype: 'pie_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'easy',
      time_limit_seconds: 90,
      cognitive_skills: ['chart_reading', 'percentage_addition', 'data_extraction'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de porcentaje de equipos 1,2,3...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de porcentaje de equipos 1,2,3 añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: El 65,4% (21,8% + 32,7% + 10,9%)')
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

insertBoyscoutsTeams123PercentageQuestion()