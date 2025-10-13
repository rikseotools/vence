import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertFishTotalConsumptionQuestion() {
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
      question_text: '¿Qué cantidad total de kg de pescado se han consumido entre los cuatro años por persona/mes?',
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
            content: "Capacidad de identificar una serie específica de datos en gráficos de barras, extraer valores de múltiples períodos y realizar sumas básicas para obtener totales acumulados."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Extracción de datos de pescado por año:\n• Año 2019: 10 kg/mes\n• Año 2020: 10 kg/mes\n• Año 2021: 5 kg/mes\n• Año 2022: 5 kg/mes\n\n📋 Cálculo del total:\n• Total pescado = 10 + 10 + 5 + 5\n• Suma paso a paso: 10 + 10 = 20, 20 + 5 = 25, 25 + 5 = 30\n• Total = 30 kg/mes ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Identificación visual\n• Localiza las barras de pescado (color oscuro) en cada año\n• Lee los valores directamente del gráfico o tabla\n• Suma: 10 + 10 + 5 + 5 = 30\n\n📊 Método 2: Suma mental agrupada\n• Agrupa años similares: (10 + 10) + (5 + 5)\n• Primera suma: 20, Segunda suma: 10\n• Total: 20 + 10 = 30\n\n💰 Método 3: Descarte de opciones\n• Opción A: 20 kg/mes - Muy bajo ❌\n• Opción B: 35 kg/mes - Muy alto ❌\n• Opción C: 30 kg/mes - Coincide con cálculo ✅\n• Opción D: 25 kg/mes - Cerca pero incorrecta ❌"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Confundir las series de datos (sumar frutas o verdura en lugar de pescado)\n• Leer mal la leyenda del gráfico\n• Errores de suma mental básica\n• No incluir todos los años en el cálculo\n• Leer mal los valores en la escala del eje Y\n• Confundir colores de las barras"
          },
          {
            title: "💪 Consejo de oposición",
            content: "Para totales de series específicas: 1) Identifica la serie objetivo usando la leyenda, 2) Localiza esa serie en cada período, 3) Extrae todos los valores, 4) Suma sistemáticamente. Verifica tu resultado comparando visualmente las alturas de las barras."
          }
        ]
      },
      option_a: '20 kg/mes',
      option_b: '35 kg/mes',
      option_c: '30 kg/mes',
      option_d: '25 kg/mes',
      correct_option: 2, // C = 30 kg/mes (10+10+5+5)
      explanation: null, // Se maneja en el componente
      question_subtype: 'bar_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'easy',
      time_limit_seconds: 90,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de consumo total de pescado...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de consumo total de pescado añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 30 kg/mes (10+10+5+5)')
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

insertFishTotalConsumptionQuestion()