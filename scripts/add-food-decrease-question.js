import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertFoodDecreaseQuestion() {
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
      question_text: '¿Qué cantidad total han disminuido los tres productos de los años 2020 al 2022? (En kilos/mes).',
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
            content: "Capacidad de extraer datos específicos de un gráfico de barras, realizar sumas de múltiples categorías en años específicos, y calcular la diferencia entre totales de dos períodos diferentes."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Extracción de datos por año:\n• Año 2020: Frutas(20) + Pescado(10) + Verdura(20) = 50 kg/mes\n• Año 2022: Frutas(5) + Pescado(5) + Verdura(10) = 20 kg/mes\n\n📋 Cálculo de la disminución:\n• Disminución = Total 2020 - Total 2022\n• Disminución = 50 - 20 = 30 kg/mes ✅\n\n📋 Verificación:\n• El resultado es positivo (hubo disminución)\n• La disminución es significativa (60% menos consumo)"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma visual por columnas\n• 2020: Identifica las tres barras del año, suma alturas\n• 2022: Identifica las tres barras del año, suma alturas\n• Resta: 50 - 20 = 30\n\n📊 Método 2: Suma por categorías\n• Frutas: 20 → 5 (disminución: 15)\n• Pescado: 10 → 5 (disminución: 5)\n• Verdura: 20 → 10 (disminución: 10)\n• Total disminución: 15 + 5 + 10 = 30\n\n💰 Método 3: Descarte de opciones\n• Opción A: 30 kg/mes - Coincide con cálculo ✅\n• Opción B: 35 kg/mes - Muy alta ❌\n• Opción C: 15 kg/mes - Solo la mitad ❌\n• Opción D: 25 kg/mes - Cerca pero incorrecta ❌"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Confundir los años (usar 2019 o 2021 en lugar de 2020 y 2022)\n• Sumar solo una o dos categorías en lugar de las tres\n• Calcular mal la suma de cada año (errores aritméticos)\n• Invertir la operación (calcular 2022 - 2020 = -30)\n• Leer mal los valores en el gráfico debido a la escala"
          },
          {
            title: "💪 Consejo de oposición",
            content: "En problemas de disminución/incremento entre períodos: 1) Identifica claramente los años pedidos, 2) Suma TODAS las categorías de cada año, 3) Resta período inicial - período final, 4) Verifica que el signo del resultado sea lógico (positivo para disminución)."
          }
        ]
      },
      option_a: '30 kg/mes',
      option_b: '35 kg/mes',
      option_c: '15 kg/mes',
      option_d: '25 kg/mes',
      correct_option: 0, // A = 30 kg/mes (50 - 20)
      explanation: null, // Se maneja en el componente
      question_subtype: 'bar_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition', 'subtraction'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de disminución de alimentos...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de disminución de alimentos añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 30 kg/mes (2020: 50 kg/mes - 2022: 20 kg/mes)')
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

insertFoodDecreaseQuestion()