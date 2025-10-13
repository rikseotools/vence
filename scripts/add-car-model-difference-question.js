import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertCarModelDifferenceQuestion() {
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
      question_text: '¿Cuál es la diferencia entre la venta de coches del modelo A y el B?',
      content_data: {
        chart_type: 'bar_chart',
        chart_title: 'COCHES VENDIDOS POR TRIMESTRE EN EL AÑO 2023',
        x_axis_label: 'Trimestres',
        y_axis_label: 'Número de coches vendidos',
        chart_data: {
          type: 'bar_chart',
          title: 'COCHES VENDIDOS POR TRIMESTRE EN EL AÑO 2023',
          quarters: [
            {
              name: 'Trimestre 1',
              modeloA: 24,
              modeloB: 89
            },
            {
              name: 'Trimestre 2', 
              modeloA: 36,
              modeloB: 24
            },
            {
              name: 'Trimestre 3',
              modeloA: 12,
              modeloB: 37
            },
            {
              name: 'Trimestre 4',
              modeloA: 38,
              modeloB: 63
            }
          ],
          legend: {
            modeloA: 'Coche A',
            modeloB: 'Coche B'
          }
        },
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de extraer datos de gráficos de barras, realizar sumas por categorías completas y calcular diferencias entre totales de diferentes series de datos."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Datos del Modelo A por trimestre:\n• Trimestre 1: 24 coches\n• Trimestre 2: 36 coches\n• Trimestre 3: 12 coches\n• Trimestre 4: 38 coches\n• Total Modelo A = 24 + 36 + 12 + 38 = 110 coches\n\n📋 Datos del Modelo B por trimestre:\n• Trimestre 1: 89 coches\n• Trimestre 2: 24 coches\n• Trimestre 3: 37 coches\n• Trimestre 4: 63 coches\n• Total Modelo B = 89 + 24 + 37 + 63 = 213 coches\n\n📋 Cálculo de la diferencia:\n• Diferencia = Modelo B - Modelo A\n• Diferencia = 213 - 110 = 103 coches ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma mental por grupos\n• Modelo A: (24 + 36) + (12 + 38) = 60 + 50 = 110\n• Modelo B: (89 + 24) + (37 + 63) = 113 + 100 = 213\n• Diferencia: 213 - 110 = 103\n\n📊 Método 2: Usando la tabla de datos\n• Lee directamente los valores de la tabla inferior\n• Suma cada modelo por separado\n• Calcula la diferencia final\n\n💰 Método 3: Verificación visual\n• El Modelo B tiene barras claramente más altas en T1 y T4\n• La diferencia debe ser significativa\n• 103 es lógico comparado con los totales"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Confundir las series (sumar datos mixtos de ambos modelos)\n• Error en el orden de la resta (110 - 213 = -103)\n• Errores de suma mental en números de dos cifras\n• Leer mal la leyenda del gráfico\n• No sumar todos los trimestres de cada modelo\n• Usar solo un trimestre en lugar del total anual"
          },
          {
            title: "💪 Consejo de oposición",
            content: "Para diferencias entre series completas: 1) Identifica claramente cada serie usando la leyenda, 2) Suma todos los valores de cada serie por separado, 3) Resta el menor del mayor, 4) Verifica que el resultado sea lógico comparado con las alturas visuales del gráfico."
          }
        ]
      },
      option_a: '105',
      option_b: '103',
      option_c: '112',
      option_d: '130',
      correct_option: 1, // B = 103 (213 - 110)
      explanation: null, // Se maneja en el componente
      question_subtype: 'bar_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition', 'subtraction'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de diferencia entre modelos de coches...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de diferencia entre modelos de coches añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 103 coches (Modelo B: 213 - Modelo A: 110)')
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

insertCarModelDifferenceQuestion()