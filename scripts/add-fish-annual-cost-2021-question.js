import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertFishAnnualCost2021Question() {
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
      question_text: 'Si el precio del pescado durante el año 2021 fue de unos 16 €/kg, ¿cuánto habría pagado una persona a lo largo de todo el año 2021?',
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
            content: "Capacidad de leer datos específicos de gráficos de barras, convertir consumo mensual a anual y aplicar cálculos de precio por unidad."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Identificación del consumo de pescado en 2021:\n• Año 2021: 5 kg/mes de pescado\n\n📋 Conversión a consumo anual:\n• Consumo anual = 5 kg/mes × 12 meses\n• Consumo anual = 60 kg/año\n\n📋 Cálculo del costo total:\n• Precio = 16 €/kg\n• Costo total = 60 kg × 16 €/kg\n• Costo total = 960 € ✅\n\n📋 Verificación:\n• 5 kg/mes × 12 meses = 60 kg/año\n• 60 kg × 16 €/kg = 960 € ✓"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo directo\n• 5 kg/mes × 12 meses × 16 €/kg = 960 € ✅\n\n📊 Método 2: Cálculo por pasos\n• Consumo anual: 5 × 12 = 60 kg\n• Costo total: 60 × 16 = 960 € ✅\n\n💰 Método 3: Multiplicación simplificada\n• 5 × 12 × 16 = 5 × 192 = 960 € ✅"
          }
        ]
      },
      option_a: '960 €',
      option_b: '970 €',
      option_c: '1920 €',
      option_d: '870 €',
      correct_option: 0, // A = 960 € (5 kg/mes × 12 meses × 16 €/kg)
      explanation: null, // Se maneja en el componente
      question_subtype: 'bar_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_multiplication', 'unit_conversion'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de costo anual pescado 2021...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de costo anual pescado 2021 añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 960 € (5 kg/mes × 12 meses × 16 €/kg)')
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

insertFishAnnualCost2021Question()