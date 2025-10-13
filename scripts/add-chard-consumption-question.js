import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertChardConsumptionQuestion() {
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
      question_text: 'En el caso de la verdura, el consumo total de kg/mes del año 2020 se reparten de la siguiente manera: coliflor: 23%; judías verdes: 17%; acelgas: 30%; espinacas: 25% y el resto otras verduras. Con estos datos, ¿qué cantidad de kg. se habrían consumido de acelgas en el año 2020?',
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
            content: "Capacidad de identificar datos específicos en gráficos de barras, aplicar distribuciones porcentuales sobre valores base y realizar cálculos de porcentajes con precisión."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Paso 1: Identificar el total de verduras en 2020\\n• Del gráfico: Verduras en año 2020 = 20 kg/mes\\n\\n📋 Paso 2: Verificar distribución porcentual\\n• Coliflor: 23%\\n• Judías verdes: 17%\\n• Acelgas: 30% ← OBJETIVO\\n• Espinacas: 25%\\n• Otras verduras: 100% - (23% + 17% + 30% + 25%) = 5%\\n• Total: 100% ✓\\n\\n📋 Paso 3: Calcular consumo de acelgas\\n• 30% de 20 kg/mes = (30 ÷ 100) × 20 = 0.30 × 20 = 6 kg/mes\\n• Pero el problema pide en kg anuales: 6 kg/mes × 12 meses = 72 kg ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo directo\\n• Total verduras 2020: 20 kg/mes\\n• 30% de 20 = 6 kg/mes\\n• Anual: 6 × 12 = 72 kg ✅\\n\\n📊 Método 2: Regla de tres\\n• Si 100% = 20 kg/mes\\n• Entonces 30% = X kg/mes\\n• X = (30 × 20) ÷ 100 = 6 kg/mes\\n• Anual: 6 × 12 = 72 kg ✅\\n\\n💰 Método 3: Descarte de opciones\\n• Opción A: 73 kg - Muy cercana, verificar ❌\\n• Opción B: 75 kg - Alta ❌\\n• Opción C: 70 kg - Baja ❌\\n• Opción D: 72 kg - Coincide con cálculo ✅"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Usar datos de otro año en lugar de 2020\\n• No multiplicar por 12 meses para obtener el total anual\\n• Error en cálculo de porcentajes (30% ≠ 0.03)\\n• Leer mal el valor de verduras en el gráfico\\n• Confundir el porcentaje de acelgas con otros vegetales\\n• No verificar que los porcentajes sumen 100%"
          },
          {
            title: "💪 Consejo de oposición",
            content: "En problemas de distribución porcentual: 1) Identifica el valor base del gráfico, 2) Verifica que los porcentajes sumen 100%, 3) Aplica el porcentaje específico, 4) Convierte a la unidad solicitada (mensual a anual). Siempre verifica que tu resultado sea lógico."
          }
        ]
      },
      option_a: '73 kg',
      option_b: '75 kg',
      option_c: '70 kg',
      option_d: '72 kg',
      correct_option: 3, // D = 72 kg (30% de 20 kg/mes × 12 meses)
      explanation: null, // Se maneja en el componente
      question_subtype: 'bar_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'percentage_calculation', 'data_extraction', 'unit_conversion'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de consumo de acelgas...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de consumo de acelgas añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 72 kg (30% de 20 kg/mes × 12 meses)')
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

insertChardConsumptionQuestion()