import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertFruitsPercentageDecrease2021To2022Question() {
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
      question_text: '¿Qué porcentaje ha descendido el consumo de frutas del año 2021 al año 2022?',
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
            content: "Capacidad de leer datos específicos de gráficos de barras, comparar valores entre períodos consecutivos y calcular descensos porcentuales."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Valores de consumo de frutas:\\\\n• Año 2021: 10 kg/mes\\\\n• Año 2022: 5 kg/mes\\\\n• Diferencia: 10 - 5 = 5 kg/mes de descenso\\\\n\\\\n📋 Cálculo del porcentaje de descenso:\\\\n• Descenso porcentual = (Diferencia ÷ Valor inicial) × 100\\\\n• Descenso porcentual = (5 ÷ 10) × 100\\\\n• Descenso porcentual = 0,5 × 100 = 50% ✅\\\\n\\\\n📋 Verificación:\\\\n• 50% de 10 kg/mes = 5 kg/mes\\\\n• 10 - 5 = 5 kg/mes en 2022 ✓"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo directo del descenso\\\\n• (10 - 5) ÷ 10 × 100 = 50% ✅\\\\n\\\\n📊 Método 2: Comparación visual\\\\n• 2022 es la mitad que 2021\\\\n• La mitad = 50% de descenso ✅\\\\n\\\\n💰 Método 3: Regla de tres\\\\n• Si 10 kg/mes = 100%\\\\n• Entonces 5 kg/mes = 50%\\\\n• Descenso = 100% - 50% = 50% ✅"
          }
        ]
      },
      option_a: '65 %',
      option_b: '50 %',
      option_c: '70 %',
      option_d: '60 %',
      correct_option: 1, // B = 50% ((10-5)/10 × 100)
      explanation: null, // Se maneja en el componente
      question_subtype: 'bar_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'percentage_calculation', 'comparison', 'basic_division'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de descenso porcentual de frutas 2021-2022...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de descenso porcentual de frutas 2021-2022 añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 50% de descenso ((10-5)/10 × 100)')
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

insertFruitsPercentageDecrease2021To2022Question()