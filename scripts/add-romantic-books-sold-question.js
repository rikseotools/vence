import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertRomanticBooksSoldQuestion() {
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
      question_text: '¿Cuántos libros de temática "romántica" se vendieron? Tenga en cuenta que el total de libros vendidos durante el 2023 fue de 2350 libros.',
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
        evaluation_description: "Cálculo de cantidad específica basada en porcentaje y total conocido",
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de interpretar gráficos de sectores, identificar porcentajes específicos y aplicar cálculos de porcentajes sobre totales conocidos."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Identificación del porcentaje de libros románticos:\n• Romántica: 10,9% del total\n\n📋 Cálculo con total de 2350 libros:\n• Libros románticos = 10,9% × 2350\n• Libros románticos = 0,109 × 2350\n• Libros románticos = 256,15 ≈ 256 libros ✅\n\n📋 Verificación:\n• 256 libros representan el 10,9% de 2350 libros\n• 256 ÷ 2350 = 0,109 = 10,9% ✓"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo directo del porcentaje\n• 10,9% × 2350 = 256,15 ≈ 256 libros ✅\n\n📊 Método 2: Regla de tres\n• Si 100% = 2350 libros\n• Entonces 10,9% = (10,9 × 2350) ÷ 100 = 256 libros ✅\n\n💰 Método 3: Aproximación mental\n• 10% de 2350 = 235 libros\n• 10,9% será ligeramente más que 235\n• Aproximadamente 256 libros ✅"
          }
        ]
      },
      option_a: '256',
      option_b: '147',
      option_c: '125',
      option_d: '425',
      correct_option: 0, // A = 256 (10,9% × 2350)
      explanation: null, // Se maneja en el componente
      question_subtype: 'pie_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'percentage_calculation', 'data_extraction', 'basic_multiplication'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de libros románticos vendidos...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de libros románticos vendidos añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 256 libros (10,9% × 2350)')
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

insertRomanticBooksSoldQuestion()