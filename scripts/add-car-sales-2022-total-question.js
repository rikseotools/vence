import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertCarSales2022TotalQuestion() {
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
      question_text: '¿Cuánto suman las ventas del 2022?',
      content_data: {
        chart_type: 'bar_chart',
        chart_title: 'Ventas de coches',
        x_axis_label: 'Trimestres',
        y_axis_label: 'Miles de coches',
        chart_data: {
          type: 'bar_chart',
          title: 'Ventas de coches',
          quarters: [
            {
              name: '1º Trimestre',
              año_2022: 24,
              año_2023: 89
            },
            {
              name: '2º Trimestre', 
              año_2022: 36,
              año_2023: 24
            },
            {
              name: '3º Trimestre',
              año_2022: 12,
              año_2023: 37
            },
            {
              name: '4º Trimestre',
              año_2022: 38,
              año_2023: 63
            }
          ],
          legend: {
            año_2022: 'Año 2022',
            año_2023: 'Año 2023'
          }
        },
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de leer gráficos de barras comparativos, identificar datos de un año específico y sumar todos los trimestres de ese período."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Ventas del año 2022 por trimestre:\n• 1º Trimestre 2022: 24.000 coches (24 en miles)\n• 2º Trimestre 2022: 36.000 coches (36 en miles)\n• 3º Trimestre 2022: 12.000 coches (12 en miles)\n• 4º Trimestre 2022: 38.000 coches (38 en miles)\n\n📋 Suma total del año 2022:\n• Total = 24 + 36 + 12 + 38 = 110 miles\n• Total = 110.000 coches ✅\n\n📋 Verificación:\n• Solo se suman las barras naranjas (año 2022)\n• Total: 110.000 coches vendidos en 2022 ✓"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma directa de 2022\n• 24+36+12+38 = 110.000 coches ✅\n\n📊 Método 2: Identificación visual\n• Solo leer las barras naranjas (2022)\n• Sumar todos los trimestres: 110.000 ✅\n\n💰 Método 3: Agrupación por semestres\n• 1º+2º trimestre: 24+36 = 60\n• 3º+4º trimestre: 12+38 = 50\n• Total: 60+50 = 110.000 coches ✅"
          }
        ]
      },
      option_a: '150.000.',
      option_b: '130.000.',
      option_c: '120.000.',
      option_d: '110.000.',
      correct_option: 3, // D = 110.000
      explanation: null,
      question_subtype: 'bar_chart',
      difficulty: 'easy',
      time_limit_seconds: 90,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition', 'selective_reading'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de ventas totales 2022...')

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

insertCarSales2022TotalQuestion()