import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertTotalShirtsSoldQuestion() {
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
      question_text: '¿Cuántas camisetas se han vendido en total?',
      content_data: {
        chart_type: 'bar_chart',
        chart_title: 'CAMISETAS VENDIDAS',
        x_axis_label: 'Trimestres',
        y_axis_label: 'Número de camisetas vendidas',
        chart_data: {
          type: 'bar_chart',
          title: 'CAMISETAS VENDIDAS',
          quarters: [
            {
              name: '1º trimestre',
              blancas: 24,
              negras: 89
            },
            {
              name: '2º trimestre', 
              blancas: 36,
              negras: 24
            },
            {
              name: '3º trimestre',
              blancas: 12,
              negras: 37
            },
            {
              name: '4º trimestre',
              blancas: 38,
              negras: 63
            }
          ],
          legend: {
            blancas: 'Blancas',
            negras: 'Negras'
          }
        },
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de leer datos de gráficos de barras, sumar todas las categorías de todos los períodos para obtener el total absoluto de ventas."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Datos de camisetas blancas por trimestre:\\n• 1º trimestre: 24 camisetas\\n• 2º trimestre: 36 camisetas\\n• 3º trimestre: 12 camisetas\\n• 4º trimestre: 38 camisetas\\n• Total blancas = 24 + 36 + 12 + 38 = 110 camisetas\\n\\n📋 Datos de camisetas negras por trimestre:\\n• 1º trimestre: 89 camisetas\\n• 2º trimestre: 24 camisetas\\n• 3º trimestre: 37 camisetas\\n• 4º trimestre: 63 camisetas\\n• Total negras = 89 + 24 + 37 + 63 = 213 camisetas\\n\\n📋 Total general:\\n• Total camisetas = 110 + 213 = 323 camisetas ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma por categorías\\n• Blancas: 24+36+12+38 = 110\\n• Negras: 89+24+37+63 = 213\\n• Total: 110 + 213 = 323 ✅\\n\\n📊 Método 2: Suma por trimestres\\n• 1º: (24+89) = 113\\n• 2º: (36+24) = 60\\n• 3º: (12+37) = 49\\n• 4º: (38+63) = 101\\n• Total: 113+60+49+101 = 323 ✅\\n\\n💰 Método 3: Uso de la tabla de datos\\n• Lee directamente todos los valores de la tabla\\n• Suma todos: 24+89+36+24+12+37+38+63 = 323 ✅"
          }
        ]
      },
      option_a: '323',
      option_b: '232',
      option_c: '223',
      option_d: '222',
      correct_option: 0, // A = 323 (110 blancas + 213 negras)
      explanation: null, // Se maneja en el componente
      question_subtype: 'bar_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition', 'total_calculation'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de total de camisetas...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de total de camisetas añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 323 camisetas (110 blancas + 213 negras)')
    console.log('♻️  Reutiliza el componente BarChartQuestion existente - no se necesitan cambios')
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

insertTotalShirtsSoldQuestion()