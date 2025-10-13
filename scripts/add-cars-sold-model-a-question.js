import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertCarsModelAQuestion() {
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
      question_text: '¿Cuántos coches se vendieron del modelo A?',
      content_data: {
        chart_type: 'bar_chart',
        chart_title: 'COCHES VENDIDOS POR TRIMESTRE EN EL AÑO 2023',
        x_axis_label: 'Trimestres',
        y_axis_label: 'Número de coches vendidos',
        question_context: 'En este tipo de pruebas, se nos presenta un gráfico (barras, quesito,...) con datos numéricos y se nos plantean, en la mayoría de los casos cuestiones de índole matemático que hay que resolver con la información que nos aparece en dichos gráficos.',
        chart_data: {
          type: 'bar_chart',
          title: 'COCHES VENDIDOS POR TRIMESTRE EN EL AÑO 2023',
          quarters: [
            {
              name: 'TRIMESTRE 1',
              modeloA: 24,
              modeloB: 89
            },
            {
              name: 'TRIMESTRE 2', 
              modeloA: 36,
              modeloB: 24
            },
            {
              name: 'TRIMESTRE 3',
              modeloA: 12,
              modeloB: 37
            },
            {
              name: 'TRIMESTRE 4',
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
            content: "Capacidad de leer datos de gráficos de barras y realizar sumas básicas para obtener totales por categorías. Habilidad de interpretar leyendas y distinguir entre diferentes series de datos."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Datos del Modelo A por trimestre:\n• Trimestre 1: 24 coches\n• Trimestre 2: 36 coches\n• Trimestre 3: 12 coches\n• Trimestre 4: 38 coches\n\n📋 Cálculo del total:\n• Total Modelo A = 24 + 36 + 12 + 38\n• Suma paso a paso: 24 + 36 = 60, 60 + 12 = 72, 72 + 38 = 110\n• Total = 110 coches ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma mental agrupada\n• Agrupa números fáciles: (24 + 36) + (12 + 38)\n• Primera suma: 60, Segunda suma: 50\n• Total: 60 + 50 = 110\n\n📊 Método 2: Identificación visual\n• Observa las barras naranjas (Modelo A) en cada trimestre\n• Lee directamente los valores de la tabla inferior\n• Suma: 24 + 36 + 12 + 38 = 110\n\n💰 Método 3: Descarte de opciones\n• Opción A: 105 - Muy cercana, verificar cálculo ❌\n• Opción B: 110 - Resultado del cálculo correcto ✅\n• Opción C: 123 - Muy alta ❌\n• Opción D: 145 - Demasiado alta ❌"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Confundir las series (sumar Modelo B en lugar de Modelo A)\n• Leer mal la leyenda o colores del gráfico\n• Errores de suma mental (especialmente con números de dos cifras)\n• Incluir datos de ambos modelos por error\n• No verificar el resultado con una suma alternativa"
          },
          {
            title: "💪 Consejo de oposición",
            content: "En gráficos de barras con múltiples series, identifica primero qué color/patrón corresponde a cada categoría. Usa la tabla de datos cuando esté disponible para verificar tu lectura visual del gráfico. Siempre double-check tu suma mental."
          }
        ]
      },
      option_a: '105',
      option_b: '110',
      option_c: '123',
      option_d: '145',
      correct_option: 1, // B = 110 (24+36+12+38)
      explanation: null, // Se maneja en el componente
      question_subtype: 'bar_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'easy',
      time_limit_seconds: 90,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de coches modelo A...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de coches modelo A añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 110 coches (24+36+12+38)')
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

insertCarsModelAQuestion()