import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertAndaluciaRestoComunidadesTouristsQuestion() {
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
      question_text: '¿Cuántos turistas suman entre el resto de comunidades autónomas y Andalucía?',
      content_data: {
        chart_type: 'bar_chart',
        chart_title: 'Turismo en España',
        x_axis_label: 'Comunidades Autónomas',
        y_axis_label: 'Millones de turistas',
        chart_data: {
          type: 'bar_chart',
          title: 'Número de turistas',
          quarters: [
            { name: 'Andalucía', turistas: 10 },
            { name: 'Islas Canarias', turistas: 10 },
            { name: 'Cataluña', turistas: 7.5 },
            { name: 'Islas Baleares', turistas: 5 },
            { name: 'Resto comunidades', turistas: 7.5 }
          ],
          legend: {
            turistas: 'Turistas (millones)'
          }
        },
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de leer gráficos de barras, identificar categorías específicas y sumar valores parciales de regiones determinadas."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Identificación de las comunidades solicitadas:\n• Andalucía: 10 millones de turistas\n• Resto comunidades: 7,5 millones de turistas\n\n📋 Suma de Andalucía y Resto comunidades:\n• Total = 10 + 7,5 = 17,5 millones de turistas\n• Total = 17.500.000 turistas ✅\n\n📋 Verificación:\n• Andalucía (10) + Resto comunidades (7,5) = 17,5 millones\n• 17,5 × 1.000.000 = 17.500.000 turistas ✓"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma directa\n• Andalucía (10) + Resto comunidades (7,5) = 17,5 millones ✅\n\n📊 Método 2: Identificación visual\n• Localizar las barras de Andalucía y Resto comunidades\n• Sumar sus valores: 17.500.000 turistas ✅\n\n💰 Método 3: Conversión de unidades\n• 17,5 millones = 17,5 × 1.000.000 = 17.500.000 turistas ✅"
          }
        ]
      },
      option_a: '16.500.000',
      option_b: '18.000.000',
      option_c: '18.500.000',
      option_d: '17.500.000',
      correct_option: 3, // D = 17.500.000
      explanation: null,
      question_subtype: 'bar_chart',
      difficulty: 'easy',
      time_limit_seconds: 90,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de turistas Andalucía y Resto comunidades...')

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

insertAndaluciaRestoComunidadesTouristsQuestion()