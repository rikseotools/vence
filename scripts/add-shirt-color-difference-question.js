import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertShirtColorDifferenceQuestion() {
  try {
    console.log('🔍 Buscando sección de gráficos en capacidad administrativa...')
    
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('*')
      .eq('category_key', 'capacidad-administrativa')
      .single()

    if (categoryError) {
      console.error('❌ Error buscando categoría:', categoryError)
      return
    }

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

    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: '¿Cuál es la diferencia entre las camisetas vendidas blancas y negras?',
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
            content: "Capacidad de leer gráficos de barras, sumar todas las categorías por tipo y calcular diferencias entre totales."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Total de camisetas blancas por trimestre:\n• 1º trimestre: 24 camisetas\n• 2º trimestre: 36 camisetas\n• 3º trimestre: 12 camisetas\n• 4º trimestre: 38 camisetas\n• Total blancas = 24 + 36 + 12 + 38 = 110 camisetas\n\n📋 Total de camisetas negras por trimestre:\n• 1º trimestre: 89 camisetas\n• 2º trimestre: 24 camisetas\n• 3º trimestre: 37 camisetas\n• 4º trimestre: 63 camisetas\n• Total negras = 89 + 24 + 37 + 63 = 213 camisetas\n\n📋 Diferencia:\n• Diferencia = 213 - 110 = 103 camisetas ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma por categorías\n• Blancas: 24+36+12+38 = 110\n• Negras: 89+24+37+63 = 213\n• Diferencia: 213-110 = 103 ✅\n\n📊 Método 2: Comparación visual\n• Las barras negras son generalmente más altas\n• Mayor diferencia en 1º y 4º trimestre\n• Diferencia total: 103 camisetas ✅\n\n💰 Método 3: Suma directa de diferencias\n• 1º: 89-24 = 65\n• 2º: 24-36 = -12\n• 3º: 37-12 = 25\n• 4º: 63-38 = 25\n• Total: 65+(-12)+25+25 = 103 ✅"
          }
        ]
      },
      option_a: '101',
      option_b: '100',
      option_c: '102',
      option_d: '103',
      correct_option: 3, // D = 103
      explanation: null,
      question_subtype: 'bar_chart',
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition', 'subtraction'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de diferencia de camisetas...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

    return data[0]?.id

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

insertShirtColorDifferenceQuestion()