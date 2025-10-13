import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertWhiteShirtsTotalQuestion() {
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
      question_text: '¿Cuál es el total de camisetas blancas vendidas?',
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
            content: "Capacidad de leer datos de gráficos de barras, identificar una serie específica de datos (camisetas blancas) y realizar sumas básicas para obtener totales por categorías."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Datos de camisetas blancas por trimestre:\n• 1º trimestre: 24 camisetas\n• 2º trimestre: 36 camisetas\n• 3º trimestre: 12 camisetas\n• 4º trimestre: 38 camisetas\n\n📋 Cálculo del total:\n• Total camisetas blancas = 24 + 36 + 12 + 38\n• Suma paso a paso: 24 + 36 = 60, 60 + 12 = 72, 72 + 38 = 110\n• Total = 110 camisetas ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma mental agrupada\n• Agrupa números fáciles: (24 + 36) + (12 + 38)\n• Primera suma: 60, Segunda suma: 50\n• Total: 60 + 50 = 110\n\n📊 Método 2: Identificación visual y tabla\n• Observa las barras claras (blancas) en cada trimestre\n• Lee directamente los valores de la tabla inferior\n• Suma: 24 + 36 + 12 + 38 = 110\n\n💰 Método 3: Descarte de opciones\n• Opción A: 100 - Muy cercana, verificar cálculo ❌\n• Opción B: 110 - Resultado del cálculo correcto ✅\n• Opción C: 101 - Suma incorrecta ❌\n• Opción D: 102 - Suma incorrecta ❌"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Confundir las series (sumar camisetas negras en lugar de blancas)\n• Leer mal la leyenda o colores del gráfico\n• Errores de suma mental (especialmente con números de dos cifras)\n• Incluir datos de ambos tipos por error\n• No verificar el resultado con una suma alternativa\n• Leer mal los valores en la tabla de datos"
          },
          {
            title: "💪 Consejo de oposición",
            content: "En gráficos de barras con múltiples series, identifica primero qué color/patrón corresponde a cada categoría usando la leyenda. Usa la tabla de datos cuando esté disponible para verificar tu lectura visual del gráfico. Siempre verifica tu suma mental."
          }
        ]
      },
      option_a: '100',
      option_b: '110',
      option_c: '101',
      option_d: '102',
      correct_option: 1, // B = 110 (24+36+12+38)
      explanation: null, // Se maneja en el componente
      question_subtype: 'bar_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'easy',
      time_limit_seconds: 90,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de total de camisetas blancas...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de total de camisetas blancas añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 110 camisetas (24+36+12+38)')
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

insertWhiteShirtsTotalQuestion()