import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertFishPriceSavings2019Question() {
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
      question_text: 'Si de media el pescado fresco tiene un coste de 16 €/kg y el pescado congelado es de 12 €/kg consumiendo la misma cantidad de uno y de otro, en el año 2019 ¿cuánto nos hubiéramos ahorrado al mes?',
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
            content: "Capacidad de leer datos específicos de gráficos de barras, aplicar cálculos de precios por unidad y determinar diferencias de coste entre opciones."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Consumo de pescado en 2019:\n• Año 2019: 10 kg/mes de pescado\n\n📋 Coste del pescado fresco:\n• Precio fresco = 16 €/kg\n• Coste mensual fresco = 10 kg × 16 €/kg = 160 €\n\n📋 Coste del pescado congelado:\n• Precio congelado = 12 €/kg\n• Coste mensual congelado = 10 kg × 12 €/kg = 120 €\n\n📋 Ahorro mensual:\n• Ahorro = 160 € - 120 € = 40 € al mes ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo directo de la diferencia\n• (16 - 12) €/kg × 10 kg = 4 € × 10 = 40 € ✅\n\n📊 Método 2: Cálculo por separado\n• Fresco: 10 × 16 = 160 €\n• Congelado: 10 × 12 = 120 €\n• Ahorro: 160 - 120 = 40 € ✅\n\n💰 Método 3: Multiplicación simplificada\n• Diferencia de precio: 4 €/kg\n• Consumo: 10 kg/mes\n• Ahorro: 4 × 10 = 40 € ✅"
          }
        ]
      },
      option_a: '40 €',
      option_b: '120 €',
      option_c: '30 €',
      option_d: '160 €',
      correct_option: 0, // A = 40 €
      explanation: null,
      question_subtype: 'bar_chart',
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_multiplication', 'subtraction', 'cost_calculation'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de ahorro pescado 2019...')

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

insertFishPriceSavings2019Question()