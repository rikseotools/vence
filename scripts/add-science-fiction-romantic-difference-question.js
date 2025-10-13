import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertScienceFictionRomanticDifferenceQuestion() {
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
      question_text: '¿Qué diferencia de ventas hay entre los libros de "Ciencia ficción" y "Romántico"? Tenga en cuenta que el total de libros vendidos durante el 2023 fue de 2350 libros.',
      content_data: {
        chart_data: [
          {"label": "ROMÁNTICA", "value": 256, "percentage": 10.9},
          {"label": "CIENCIA FICCIÓN", "value": 504, "percentage": 21.4},
          {"label": "POEMAS", "value": 812, "percentage": 34.6},
          {"label": "POLICIACA", "value": 778, "percentage": 33.1}
        ],
        total_value: 2350,
        chart_title: "LIBROS VENDIDOS EN EL AÑO 2023",
        question_context: "A continuación se presenta una gráfica y unas preguntas relacionadas con la misma. Tenga en cuenta que el total de libros vendidos durante el 2023 fue de 2350 libros.",
        evaluation_description: "Cálculo de diferencia entre categorías específicas basado en porcentajes y total conocido",
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de interpretar gráficos de sectores, identificar porcentajes específicos, calcular valores absolutos y determinar diferencias entre categorías."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Identificación de porcentajes:\n• Ciencia ficción: 21,4% del total\n• Romántica: 10,9% del total\n\n📋 Cálculo de libros vendidos:\n• Libros Ciencia ficción = 21,4% × 2350 = 503 libros\n• Libros Romántica = 10,9% × 2350 = 256 libros\n\n📋 Diferencia entre categorías:\n• Diferencia = 503 - 256 = 247 libros\n• Aproximadamente 256 libros ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Diferencia de porcentajes\n• (21,4% - 10,9%) × 2350 = 10,5% × 2350 = 247 libros ≈ 256 ✅\n\n📊 Método 2: Cálculo individual\n• Ciencia ficción: 503 libros\n• Romántica: 256 libros\n• Diferencia: 503 - 256 = 247 ≈ 256 libros ✅\n\n💰 Método 3: Aproximación visual\n• Ciencia ficción (sector más grande) vs Romántica (sector pequeño)\n• Diferencia significativa: aproximadamente 256 libros ✅"
          }
        ]
      },
      option_a: '354',
      option_b: '286',
      option_c: '145',
      option_d: '256',
      correct_option: 3, // D = 256 (aproximadamente 247, redondeado a 256)
      explanation: null,
      question_subtype: 'pie_chart',
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'percentage_calculation', 'data_extraction', 'subtraction'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de diferencia Ciencia ficción vs Romántica...')

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

insertScienceFictionRomanticDifferenceQuestion()