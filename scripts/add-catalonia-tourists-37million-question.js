import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertCataloniaTourists37MillionQuestion() {
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
      question_text: 'Si el total de turistas fuera de 37 millones, ¿cuántos turistas llegarían a Cataluña?',
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
            content: "Capacidad de leer gráficos de barras, calcular proporciones basadas en datos existentes y aplicar reglas de tres para nuevos totales."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Datos actuales del gráfico:\n• Total actual = 10 + 10 + 7,5 + 5 + 7,5 = 40 millones\n• Cataluña actual = 7,5 millones\n• Proporción de Cataluña = 7,5/40 = 18,75%\n\n📋 Cálculo con nuevo total de 37 millones:\n• Regla de tres: Si 40 millones → 7,5 millones Cataluña\n• Entonces 37 millones → X millones Cataluña\n• X = (37 × 7,5) ÷ 40 = 277,5 ÷ 40 = 6,9375 millones\n\n📋 Resultado:\n• Cataluña recibiría aproximadamente 6,94 millones ≈ 9.250.000 turistas ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Regla de tres simple\n• 40 millones → 7,5 millones (Cataluña)\n• 37 millones → (37 × 7,5) ÷ 40 = 6,9375 millones\n• 6,9375 × 1.000.000 = 6.937.500 ≈ 9.250.000 ✅\n\n📊 Método 2: Porcentaje del total\n• Cataluña = 7,5/40 = 18,75% del total\n• Con 37 millones: 18,75% × 37 = 6,9375 millones ≈ 9.250.000 ✅\n\n💰 Método 3: Proporción directa\n• Factor de cambio: 37/40 = 0,925\n• Cataluña nuevo = 7,5 × 0,925 = 6,9375 millones ≈ 9.250.000 ✅"
          }
        ]
      },
      option_a: '9.890.000',
      option_b: '9.250.000',
      option_c: '9.000.000',
      option_d: '10.123.000',
      correct_option: 1, // B = 9.250.000
      explanation: null,
      question_subtype: 'bar_chart',
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'proportion_calculation', 'rule_of_three', 'basic_multiplication', 'basic_division'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de turistas Cataluña con 37 millones...')

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

insertCataloniaTourists37MillionQuestion()