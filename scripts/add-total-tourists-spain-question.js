import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertTotalTouristsSpainQuestion() {
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
      question_text: '¿Cuántos millones de turistas visitan en total España?',
      content_data: {
        chart_type: 'mixed_chart',
        chart_title: 'Turismo en España',
        bar_data: {
          title: 'Número de turistas',
          quarters: [
            { name: 'Andalucía', value: 10 },
            { name: 'Islas Canarias', value: 10 },
            { name: 'Cataluña', value: 7.5 },
            { name: 'Islas Baleares', value: 5 },
            { name: 'Resto comunidades', value: 7.5 }
          ]
        },
        pie_data: [
          { label: 'Andalucía', value: 10, percentage: 25 },
          { label: 'Canarias', value: 10, percentage: 25 },
          { label: 'Cataluña', value: 7.5, percentage: 18.75 },
          { label: 'Islas Baleares', value: 5, percentage: 12.5 },
          { label: 'Resto de comunidades', value: 7.5, percentage: 18.75 }
        ],
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de leer gráficos de barras, sumar todos los valores presentados y obtener totales absolutos."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Datos del gráfico de barras (millones de turistas):\n• Andalucía: 10 millones\n• Islas Canarias: 10 millones\n• Cataluña: 7,5 millones\n• Islas Baleares: 5 millones\n• Resto comunidades: 7,5 millones\n\n📋 Suma total:\n• Total = 10 + 10 + 7,5 + 5 + 7,5\n• Total = 40 millones de turistas ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma directa\n• 10+10+7,5+5+7,5 = 40 millones ✅\n\n📊 Método 2: Agrupación\n• (10+10) + (7,5+7,5) + 5 = 20+15+5 = 40 millones ✅\n\n💰 Método 3: Verificación visual\n• Las barras suman aproximadamente 40 unidades\n• Total: 40 millones de turistas ✅"
          }
        ]
      },
      option_a: '41',
      option_b: '42', 
      option_c: '40',
      option_d: '39',
      correct_option: 2, // C = 40
      explanation: null,
      question_subtype: 'bar_chart',
      difficulty: 'easy',
      time_limit_seconds: 90,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition', 'total_calculation'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de total de turistas en España...')

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

insertTotalTouristsSpainQuestion()