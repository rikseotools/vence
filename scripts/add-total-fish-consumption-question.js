import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertTotalFishConsumptionQuestion() {
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
      question_text: 'Entre los cuatro años, ¿Qué cantidad de Tm. se han consumido de pescado al mes?',
      content_data: {
        chart_type: 'bar_chart',
        chart_title: 'Consumo de alimentos frescos por persona expresado en Kg/mes',
        x_axis_label: 'Años',
        y_axis_label: 'Kg/mes',
        question_context: 'Los psicotécnicos de capacidad administrativa evalúan nuestra capacidad de organización y el manejo de datos. Dicha capacidad administrativa se puede medir a través de pruebas de atención, percepción o equivalencias. Lo más complejo de este tipo de pruebas es entender correctamente qué es lo que se nos está pidiendo, puesto que no llegamos a comprender bien la tabla o el gráfico que se nos presenta.',
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
            content: "Capacidad de interpretar gráficos de barras, extraer datos específicos de una categoría, realizar sumas básicas y aplicar conversiones de unidades (kg a toneladas). También evalúa atención al detalle y comprensión de equivalencias."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Extracción de datos de pescado por año:\n• Año 2019: 10 kg/mes\n• Año 2020: 10 kg/mes\n• Año 2021: 5 kg/mes\n• Año 2022: 5 kg/mes\n\n📋 Suma total:\n• Total pescado = 10 + 10 + 5 + 5 = 30 kg/mes\n\n📋 Conversión a toneladas:\n• 1 tonelada = 1000 kg\n• 30 kg ÷ 1000 = 0,03 Tm ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Identificación visual\n• Localiza las barras oscuras (pescado) en cada año\n• Lee los valores directamente del eje Y\n• Suma mental: 10 + 10 + 5 + 5 = 30\n\n📊 Método 2: Conversión rápida\n• Memoriza: dividir kg entre 1000 = toneladas\n• 30 ÷ 1000 = 0,03 (mover coma 3 posiciones)\n\n💰 Método 3: Descarte de opciones\n• Opción A: 0,3 Tm - 10 veces mayor ❌\n• Opción B: 0,003 Tm - 10 veces menor ❌  \n• Opción C: 3 Tm - 100 veces mayor ❌\n• Opción D: 0,03 Tm - Conversión correcta ✅"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Confundir las series de datos (sumar frutas o verdura en lugar de pescado)\n• Error en la suma: 10+10+5+5 ≠ 25 o 35\n• Error de conversión: confundir factor 1000 (kg→Tm)\n• Leer mal el gráfico: confundir colores o leyenda\n• No entender que pide el TOTAL de los cuatro años"
          },
          {
            title: "💪 Consejo de oposición",
            content: "En problemas de conversión de unidades, siempre verifica tu resultado: ¿30 kg de pescado al mes son 0,03 toneladas? Sí, porque 1 Tm = 1000 kg. Usa la leyenda para identificar correctamente cada serie de datos. Para conversiones rápidas: kg÷1000=Tm (mover coma 3 posiciones a la izquierda)."
          }
        ]
      },
      option_a: '0,3 Tm.',
      option_b: '0,003 Tm.',
      option_c: '3 Tm.',
      option_d: '0,03 Tm.',
      correct_option: 3, // D = 0,03 Tm (30 kg ÷ 1000)
      explanation: null, // Se maneja en el componente
      question_subtype: 'bar_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'unit_conversion', 'basic_addition'],
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
    console.log('✅ Respuesta correcta: 0,03 Tm (30 kg ÷ 1000)')
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

insertTotalFishConsumptionQuestion()