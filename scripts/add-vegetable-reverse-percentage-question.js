import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertVegetableReversePercentageQuestion() {
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
      question_text: 'Si ha habido un incremento del 25 % del consumo de verduras del año 2018 al 2019 ¿Qué cantidad de verdura se habría consumido en el año 2018 por persona?',
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
            content: "Capacidad de realizar cálculos de porcentajes inversos, aplicar reglas de tres y comprender relaciones matemáticas entre valores de diferentes períodos en gráficos de barras."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Datos conocidos del problema:\n• Consumo de verduras en 2019: 20 kg/mes (del gráfico)\n• Incremento de 2018 a 2019: 25%\n• Pregunta: ¿Cuánto se consumió en 2018?\n\n📋 Planteamiento del problema:\n• Si 2018 = X kg/mes\n• Entonces 2019 = X + 25% de X = X × 1.25\n• Sabemos que 2019 = 20 kg/mes\n• Por tanto: X × 1.25 = 20\n\n📋 Resolución:\n• X = 20 ÷ 1.25 = 16 kg/mes\n• Verificación: 16 × 1.25 = 20 ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Regla de tres directa\n• Si 125% = 20 kg/mes (año 2019)\n• Entonces 100% = X kg/mes (año 2018)\n• X = (20 × 100) ÷ 125 = 2000 ÷ 125 = 16 kg/mes\n\n📊 Método 2: División directa\n• 2019 representa 125% del valor de 2018\n• 20 kg/mes ÷ 1.25 = 16 kg/mes\n\n💰 Método 3: Verificación lógica\n• 16 kg + 25% de 16 = 16 + 4 = 20 kg ✅\n• El resultado debe ser menor que 20 kg (porque hubo incremento)"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Calcular 20 kg - 25% = 15 kg (error conceptual)\n• Confundir el sentido del porcentaje (aplicar 25% sobre 20 en lugar de buscar el valor base)\n• Error en la regla de tres (invertir numerador/denominador)\n• Usar datos de otros años en lugar del 2019\n• No verificar el resultado con el cálculo inverso\n• Confundir incremento con decremento"
          },
          {
            title: "💪 Consejo de oposición",
            content: "En problemas de porcentajes inversos: 1) Identifica claramente qué valor conoces y cuál buscas, 2) Plantea la ecuación: valor_base × (1 + porcentaje/100) = valor_final, 3) Despeja el valor_base, 4) Siempre verifica multiplicando el resultado por el porcentaje de incremento."
          }
        ]
      },
      option_a: '22 kg',
      option_b: '15 kg',
      option_c: '24 kg',
      option_d: '16 kg',
      correct_option: 3, // D = 16 kg (20 ÷ 1.25)
      explanation: null, // Se maneja en el componente
      question_subtype: 'bar_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'hard',
      time_limit_seconds: 150,
      cognitive_skills: ['chart_reading', 'percentage_calculation', 'inverse_calculation', 'mathematical_reasoning'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de cálculo porcentual inverso...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de cálculo porcentual inverso añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 16 kg (20 kg ÷ 1.25 = 16 kg)')
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

insertVegetableReversePercentageQuestion()