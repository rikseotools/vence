import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertCatalunaCanariasTouristsQuestion() {
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
      question_text: '¿Cuántos millones de turistas visitan Cataluña e Islas Canarias?',
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
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de leer gráficos de barras, identificar categorías específicas y sumar valores parciales."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Identificación de las comunidades solicitadas:\n• Cataluña: 7,5 millones de turistas\n• Islas Canarias: 10 millones de turistas\n\n📋 Suma de Cataluña e Islas Canarias:\n• Total = 7,5 + 10\n• Total = 17,5 millones de turistas\n• Total = 17.500.000 turistas ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma directa\n• Cataluña (7,5) + Canarias (10) = 17,5 millones ✅\n\n📊 Método 2: Identificación visual\n• Localizar las barras correspondientes\n• Sumar sus valores: 17.500.000 ✅\n\n💰 Método 3: Verificación\n• 17,5 millones = 17.500.000 turistas\n• Respuesta exacta: 17.500.000 ✅"
          }
        ]
      },
      option_a: '17.500.000',
      option_b: '18.000.000',
      option_c: '17.230.000',
      option_d: '19.500.000',
      correct_option: 0, // A = 17.500.000
      explanation: null,
      question_subtype: 'bar_chart',
      difficulty: 'easy',
      time_limit_seconds: 90,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de turistas Cataluña e Islas Canarias...')

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

insertCatalunaCanariasTouristsQuestion()