import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertAgeRangePopulationQuestion() {
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
      question_text: 'Según el gráfico, ¿Cuál sería la población total atendida al mes del rango de edad de entre 1 mes y 14 años?',
      content_data: {
        chart_type: 'line_chart',
        chart_title: 'Personas atendidas por rango de edad / lugar de la atención (en miles) al mes',
        x_axis_label: 'Lugar de atención',
        y_axis_label: 'Personas atendidas (miles)',
        chart_data: {
          type: 'line_chart',
          title: 'Personas atendidas por rango de edad / lugar de la atención (en miles) al mes',
          categories: ['Centro salud', 'Hospitales', 'Centros especializados', 'Clínicas privadas'],
          series: [
            {
              name: 'Edad de 1 mes a 14 años',
              data: [80, 30, 70, 50],
              color: '#ff69b4'
            },
            {
              name: 'Edad de 15 a 39 años',
              data: [40, 20, 30, 20],
              color: '#ffa500'
            },
            {
              name: 'Edad de 27 a 64 años',
              data: [70, 60, 50, 90],
              color: '#333333'
            },
            {
              name: 'De 65 años en adelante',
              data: [100, 100, 95, 35],
              color: '#8a2be2'
            }
          ]
        },
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de leer gráficos de líneas, identificar una serie específica de datos, extraer valores de múltiples puntos y realizar sumas básicas para obtener totales."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Identificación de la serie objetivo:\n• Buscar la línea correspondiente a 'Edad de 1 mes a 14 años' (línea rosa/magenta)\n• Esta línea representa los datos que necesitamos sumar\n\n📋 Extracción de datos por lugar:\n• Centro salud: 80 (miles de personas)\n• Hospitales: 30 (miles de personas)\n• Centros especializados: 70 (miles de personas)\n• Clínicas privadas: 50 (miles de personas)\n\n📋 Cálculo del total:\n• Total = 80 + 30 + 70 + 50 = 230 (miles de personas)\n• Resultado: 230.000 personas ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Identificación visual de la serie\n• Localiza la leyenda para identificar colores\n• Sigue la línea rosa/magenta en todo el gráfico\n• Lee los valores en cada punto de la línea\n\n📊 Método 2: Suma mental estratégica\n• Agrupa números fáciles: (80 + 70) + (30 + 50)\n• Primera suma: 150, Segunda suma: 80\n• Total: 150 + 80 = 230 miles = 230.000 personas\n\n💰 Método 3: Descarte de opciones\n• Opción A: 250.000 - Muy alta ❌\n• Opción B: 220.000 - Cerca pero baja ❌\n• Opción C: 230.000 - Coincide con cálculo ✅\n• Opción D: 240.000 - Muy alta ❌"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Confundir las series de datos (seguir línea incorrecta)\n• No identificar correctamente los colores de la leyenda\n• Leer mal la escala del eje Y (olvidar que está en miles)\n• Errores de suma mental con números de dos cifras\n• Sumar datos de múltiples series en lugar de una sola\n• No convertir correctamente de miles a unidades"
          },
          {
            title: "💪 Consejo de oposición",
            content: "En gráficos de líneas con múltiples series: 1) Identifica primero la serie objetivo usando la leyenda, 2) Sigue visualmente esa línea específica, 3) Lee cuidadosamente los valores en cada punto, 4) Verifica que estás sumando la serie correcta. Recuerda que los valores están en miles."
          }
        ]
      },
      option_a: '250.000 personas',
      option_b: '220.000 personas',
      option_c: '230.000 personas',
      option_d: '240.000 personas',
      correct_option: 2, // C = 230.000 personas (80+30+70+50 = 230 miles)
      explanation: null, // Se maneja en el componente
      question_subtype: 'line_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition', 'series_identification'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de población por rango de edad...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de población por rango de edad añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 230.000 personas (80+30+70+50 = 230 miles)')
    console.log('♻️  Reutiliza el componente LineChartQuestion existente - no se necesitan cambios')
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

insertAgeRangePopulationQuestion()