import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertCanaryIslandsTouristsQuestion() {
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
      question_text: 'Si el total de turistas fuera de 38 millones, ¿cuántos turistas llegarán a las Islas Canarias?',
      content_data: {
        chart_data: [
          {"label": "ANDALUCÍA", "value": 6950000, "percentage": 18.3},
          {"label": "ISLAS CANARIAS", "value": 7144000, "percentage": 18.8},
          {"label": "CATALUÑA", "value": 9120000, "percentage": 24.0},
          {"label": "ISLAS BALEARES", "value": 4940000, "percentage": 13.0},
          {"label": "RESTO COMUNIDADES", "value": 9846000, "percentage": 25.9}
        ],
        total_value: 38000000,
        chart_title: "NÚMERO DE TURISTAS",
        chart_subtitle: "Porcentaje recepción de turistas",
        question_context: "Gráfico mixto que combina barras horizontales y gráfico de sectores para mostrar la distribución del turismo por comunidades autónomas.",
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de aplicar porcentajes sobre totales específicos, leer gráficos mixtos (barras + sectores) y realizar cálculos de proporcionalidad directa."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Datos del problema:\\n• Total de turistas: 38 millones\\n• Porcentaje de Islas Canarias: 18,8% (del gráfico de sectores)\\n• Pregunta: ¿Cuántos turistas a Canarias?\\n\\n📋 Aplicación de la regla de tres:\\n• Si 100% = 38.000.000 turistas\\n• Entonces 18,8% = X turistas\\n• X = (18,8 × 38.000.000) ÷ 100\\n\\n📋 Cálculo:\\n• X = (18,8 × 38) ÷ 100 × 1.000.000\\n• X = 714,4 ÷ 100 × 1.000.000\\n• X = 7,144 × 1.000.000 = 7.144.000 turistas ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo directo con decimales\\n• 18,8% de 38 millones = 0,188 × 38.000.000\\n• 0,188 × 38 = 7,144\\n• Resultado: 7.144.000 turistas ✅\\n\\n📊 Método 2: Regla de tres simplificada\\n• 38 millones × 18,8 ÷ 100\\n• 38 × 18,8 = 714,4\\n• 714,4 ÷ 100 = 7,144 millones = 7.144.000 ✅\\n\\n💰 Método 3: Estimación por fracciones\\n• 18,8% ≈ 19% ≈ aproximadamente 1/5\\n• 38 millones ÷ 5 = 7,6 millones\\n• 7.144.000 es cercano a esta estimación ✅"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Confundir porcentajes: usar 18,3% (Andalucía) en lugar de 18,8% (Canarias)\\n• Error en cálculo decimal: 18,8% = 0,188, no 0,0188\\n• Leer mal el gráfico de sectores vs. el de barras\\n• No convertir correctamente millones a unidades\\n• Redondear incorrectamente el resultado final\\n• Usar datos del gráfico de barras en lugar del porcentaje"
          },
          {
            title: "💪 Consejo de oposición",
            content: "En gráficos mixtos (barras + sectores): usa siempre el gráfico de sectores para porcentajes ya que es más preciso. Para cálculos con millones, trabaja con decimales primero: 38 × 0,188 = 7,144, luego convierte a millones. Verifica que tu resultado sea lógico comparado visualmente con el tamaño del sector."
          }
        ]
      },
      option_a: '7.230.250',
      option_b: '6.950.000',
      option_c: '7.769.000',
      option_d: '7.144.000',
      correct_option: 3, // D = 7.144.000 (18,8% de 38 millones)
      explanation: null, // Se maneja en el componente
      question_subtype: 'mixed_chart', // Gráfico mixto (barras + sectores)
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'percentage_calculation', 'mixed_chart_analysis', 'basic_multiplication'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de turistas en Canarias...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de turistas en Canarias añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 7.144.000 turistas (18,8% de 38 millones)')
    console.log('♻️  Reutiliza el componente PieChartQuestion existente - no se necesitan cambios')
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

insertCanaryIslandsTouristsQuestion()