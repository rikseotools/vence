import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertBoyscoutsTeam4Question() {
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
      question_text: 'Si el total de puntos conseguidos por todos los equipos es de 500, ¿cuántos puntos ha conseguido el equipo 4?',
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
        evaluation_description: "Cálculo de valores absolutos a partir de porcentajes en gráficos de sectores",
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de calcular valores absolutos a partir de porcentajes mostrados en gráficos de sectores, aplicando reglas de tres y operaciones de porcentajes."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Datos del problema:\n• Total de puntos disponibles: 500 puntos\n• Equipo 4: 34,5% del total\n• Pregunta: ¿Cuántos puntos obtuvo el equipo 4?\n\n📋 Cálculo directo:\n• Fórmula: (Porcentaje ÷ 100) × Total\n• (34,5 ÷ 100) × 500 = 0,345 × 500 = 172,5 puntos ✅\n\n📋 Verificación:\n• 172,5 ÷ 500 = 0,345 = 34,5% ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo mental directo\n• 34,5% de 500 = 34,5 × 5 = 172,5\n• Truco: Para calcular % de 500, multiplica el % por 5\n• Ejemplo: 20% de 500 = 20 × 5 = 100\n\n📊 Método 2: Regla de tres simple\n• Si 100% = 500 puntos\n• Entonces 34,5% = X puntos\n• X = (34,5 × 500) ÷ 100 = 172,5\n\n💰 Método 3: Descarte por aproximación\n• 34,5% ≈ 1/3 de 500 ≈ 166-167 puntos\n• Opción más cercana: 172,5 ✅\n• 123,5 y 143,5 son muy bajos ❌\n• 153,5 también es bajo ❌"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Confundir el porcentaje con el valor absoluto\n• Aplicar mal la regla de tres (invertir numerador/denominador)\n• Calcular 34,5% como 34,5 puntos directamente\n• No verificar que el resultado sea lógico comparado visualmente con el gráfico\n• Redondear incorrectamente (172,5 no es 172 ni 173)"
          },
          {
            title: "💪 Consejo de oposición",
            content: "Para cálculos de porcentajes con totales redondos como 500: multiplica el porcentaje por 5 para obtener el resultado directo. Siempre verifica visualmente que el sector del gráfico corresponda proporcionalmente al resultado calculado."
          }
        ]
      },
      option_a: '123,5',
      option_b: '143,5',
      option_c: '153,5',
      option_d: '172,5',
      correct_option: 3, // D = 172,5 (34,5% de 500)
      explanation: null, // Se maneja en el componente
      question_subtype: 'pie_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'percentage_calculation', 'basic_math'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta del equipo 4 de Boyscouts...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta del equipo 4 de Boyscouts añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 172,5 puntos (34,5% de 500)')
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

insertBoyscoutsTeam4Question()