import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertChocolatinasPercentageQuestion() {
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
      question_text: '¿Cuál es el porcentaje de ventas del cuarto trimestre en el 2023?',
      content_data: {
        chart_type: 'bar_chart',
        chart_title: 'CHOCOLATINAS VENDIDAS',
        x_axis_label: 'Trimestres',
        y_axis_label: 'Cantidad vendida',
        question_context: 'Una tienda de barrio se dedica a la venta de golosinas y quiere saber si les compensa o no seguir vendiendo chocolatinas comparando las que se vendieron en el 2022 con las que se vendieron en 2023. Conteste las preguntas relacionadas con el gráfico:',
        chart_data: {
          type: 'bar_chart',
          title: 'CHOCOLATINAS VENDIDAS',
          quarters: [
            {
              name: 'PRIMER TRIMESTRE',
              año2022: 24,
              año2023: 89
            },
            {
              name: 'SEGUNDO TRIMESTRE', 
              año2022: 36,
              año2023: 24
            },
            {
              name: 'TERCER TRIMESTRE',
              año2022: 12,
              año2023: 37
            },
            {
              name: 'CUARTO TRIMESTRE',
              año2022: 38,
              año2023: 63
            }
          ],
          legend: {
            año2022: 'AÑO 2022',
            año2023: 'AÑO 2023'
          }
        },
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de calcular porcentajes a partir de datos de gráfico de barras, y realizar operaciones mentales con números de dos cifras sin calculadora."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Datos del cuarto trimestre 2023:\n• Chocolatinas vendidas: 63 unidades ✅\n\n📋 Total de ventas 2023:\n• Primer trimestre: 89 chocolatinas\n• Segundo trimestre: 24 chocolatinas\n• Tercer trimestre: 37 chocolatinas\n• Cuarto trimestre: 63 chocolatinas\n• TOTAL 2023: 89 + 24 + 37 + 63 = 213 chocolatinas\n\n📋 Cálculo del porcentaje:\n• Fórmula: (Cuarto trimestre / Total) × 100\n• (63 ÷ 213) × 100 = 29,57% ≈ 30%"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma rápida mental\n• Total 2023: 89 + 24 + 37 + 63\n• Agrupación: (89 + 37) + (24 + 63) = 126 + 87 = 213\n• Aproximación: 63/213 ≈ 63/210 = 30%\n\n📊 Método 2: Comparación visual\n• 63 es aproximadamente 1/3 de 213\n• 1/3 = 33,3%, pero 63 < 70 (que sería 1/3 de 210)\n• Por tanto debe ser menos del 33%, el 30% encaja\n\n💰 Método 3: Descarte de opciones\n• Opción A: 30% - Cálculo correcto ✅\n• Opción B: 40% - Demasiado alto (sería 85/213) ❌\n• Opción C: 50% - Imposible (sería 106/213) ❌\n• Opción D: No se puede saber - Falso, sí se puede ❌"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Calcular sobre el total de ambos años (2022+2023) en lugar de solo 2023\n• Confundir el cuarto trimestre 2022 (38) con el de 2023 (63)\n• Redondear mal: 29,57% no es 40% ni 50%\n• No sumar correctamente el total de 2023 (error en suma mental)"
          },
          {
            title: "💪 Consejo de oposición",
            content: "Para cálculos de porcentaje sin calculadora: agrupa números para facilitar la suma mental, usa aproximaciones para verificar (63/210 ≈ 30%), y siempre verifica que el porcentaje sea lógico comparado visualmente con el gráfico."
          }
        ]
      },
      option_a: 'El 30% aproximadamente.',
      option_b: 'El 40% aproximadamente.',
      option_c: 'El 50% aproximadamente.',
      option_d: 'No se puede saber.',
      correct_option: 0, // A = El 30% aproximadamente
      explanation: null, // Se maneja en el componente
      question_subtype: 'bar_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'percentage_calculation', 'mental_math'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de chocolatinas...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de chocolatinas añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: El 30% aproximadamente (63/213 = 29,57%)')
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

insertChocolatinasPercentageQuestion()