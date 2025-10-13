import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertFrozenFishConsumptionQuestion() {
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
      question_text: 'Si las frutas frescas se incrementan en un 47% y las convertimos en congeladas, ¿cuál sería el consumo de frutas congeladas en 2021?',
      content_data: {
        chart_type: 'bar_chart',
        chart_title: 'Consumo de alimentos frescos por persona expresado en Kg/mes',
        x_axis_label: 'Años',
        y_axis_label: 'Kg/mes',
        chart_data: {
          type: 'bar_chart',
          title: 'Consumo de alimentos frescos por persona expresado en Kg/mes',
          quarters: [
            {
              name: 'Año 2019',
              frutas: 15,
              pescado: 10,
              verdura: 20
            },
            {
              name: 'Año 2020', 
              frutas: 20,
              pescado: 10,
              verdura: 20
            },
            {
              name: 'Año 2021',
              frutas: 10,
              pescado: 5,
              verdura: 15
            },
            {
              name: 'Año 2022',
              frutas: 5,
              pescado: 5,
              verdura: 10
            }
          ],
          legend: {
            frutas: 'Frutas',
            pescado: 'Pescado',
            verdura: 'Verdura'
          }
        },
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de leer datos específicos de gráficos de barras, aplicar cálculos de porcentajes sobre valores concretos y determinar incrementos."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Identificación del valor base:\\\\n• Año 2021: Frutas frescas = 10 kg/mes\\\\n\\\\n📋 Cálculo del incremento del 47%:\\\\n• Incremento = 10 kg/mes × 47%\\\\n• Incremento = 10 × 0,47 = 4,7 kg/mes\\\\n\\\\n📋 Consumo de frutas congeladas:\\\\n• Frutas congeladas = Frutas frescas + Incremento\\\\n• Frutas congeladas = 10 + 4,7 = 14,7 kg/mes ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo directo del 47%\\\\n• Base 2021: 10 kg/mes\\\\n• 10 × 1,47 = 14,7 kg/mes ✅\\\\n\\\\n📊 Método 2: Cálculo por partes\\\\n• 47% de 10 = 4,7 kg/mes\\\\n• Total = 10 + 4,7 = 14,7 kg/mes ✅\\\\n\\\\n💰 Método 3: Aproximación mental\\\\n• 50% de 10 ≈ 5 kg/mes\\\\n• 47% será ligeramente menos que 5\\\\n• 10 + 4,7 ≈ 14,7 kg/mes ✅"
          }
        ]
      },
      option_a: 'En unos 12,50 kg/mes',
      option_b: 'En 14,70 kg/mes',
      option_c: 'En unos 13,30 kg/mes',
      option_d: 'En 15,20 kg/mes',
      correct_option: 1, // B = En 14,70 kg/mes (10 × 1,47)
      explanation: null, // Se maneja en el componente
      question_subtype: 'bar_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'percentage_calculation', 'basic_multiplication'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de consumo de frutas congeladas...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de consumo de frutas congeladas añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: En 14,70 kg/mes (10 kg/mes × 1,47 = 14,70)')
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

insertFrozenFishConsumptionQuestion()