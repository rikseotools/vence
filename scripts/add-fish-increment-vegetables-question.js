import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertFishIncrementVegetablesQuestion() {
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
      question_text: 'Si nos fijamos en la tabla, ¿qué cantidad de kg/mes tendría que incrementar el pescado para ponerse al mismo nivel que la verdura entre los cuatro años representados?',
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
            content: "Capacidad de calcular totales de series específicas en gráficos de barras, comparar totales entre categorías diferentes y determinar la diferencia necesaria para igualar valores."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Cálculo del total de verduras (4 años):\\n• 2019: 20 kg/mes\\n• 2020: 20 kg/mes\\n• 2021: 15 kg/mes\\n• 2022: 10 kg/mes\\n• Total verduras = 20 + 20 + 15 + 10 = 65 kg/mes\\n\\n📋 Cálculo del total de pescado (4 años):\\n• 2019: 10 kg/mes\\n• 2020: 10 kg/mes\\n• 2021: 5 kg/mes\\n• 2022: 5 kg/mes\\n• Total pescado = 10 + 10 + 5 + 5 = 30 kg/mes\\n\\n📋 Diferencia necesaria:\\n• Incremento necesario = 65 - 30 = 35 kg/mes ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma por categorías\\n• Verduras: 20+20+15+10 = 65 kg/mes\\n• Pescado: 10+10+5+5 = 30 kg/mes\\n• Diferencia: 65 - 30 = 35 kg/mes ✅\\n\\n📊 Método 2: Comparación visual\\n• Las barras naranjas (verdura) son consistentemente más altas\\n• Las barras negras (pescado) son más bajas\\n• La diferencia visual sugiere un incremento significativo\\n\\n💰 Método 3: Agrupación de años\\n• Años 2019-2020: Verdura(40) vs Pescado(20) = 20 de diferencia\\n• Años 2021-2022: Verdura(25) vs Pescado(10) = 15 de diferencia\\n• Total diferencia: 20 + 15 = 35 kg/mes ✅"
          }
        ]
      },
      option_a: 'En unos 30 kg/mes',
      option_b: 'En 20 kg/mes',
      option_c: 'En unos 25 kg/mes',
      option_d: 'En 35 kg/mes',
      correct_option: 3, // D = En 35 kg/mes (65 - 30)
      explanation: null, // Se maneja en el componente
      question_subtype: 'bar_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'comparison', 'basic_addition', 'subtraction'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de incremento pescado vs verdura...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de incremento pescado vs verdura añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: En 35 kg/mes (Verdura: 65 - Pescado: 30 = 35)')
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

insertFishIncrementVegetablesQuestion()