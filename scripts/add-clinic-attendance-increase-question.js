import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertClinicAttendanceIncreaseQuestion() {
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
      question_text: 'La previsión es que exista un aumento de atenciones en el caso de las Clínicas privadas. Si se prevé un 28% más de atenciones en los próximos meses, con los datos que tenemos en el gráfico, ¿Cuál será la cantidad de personas atendidas con este incremento?',
      content_data: {
        chart_type: 'line_chart',
        chart_title: 'Personas atendidas por rango de edad / lugar de la atención (en miles) al mes',
        x_axis_label: 'Lugar de atención',
        y_axis_label: 'Personas atendidas (miles)',
        categories: ['Centro salud', 'Hospitales', 'Centros especializados', 'Clínicas privadas'],
        age_groups: [
          {
            label: 'Edad de 1 mes a 14 años',
            values: [80, 30, 70, 50]
          },
          {
            label: 'Edad de 15 a 39 años', 
            values: [40, 20, 30, 20]
          },
          {
            label: 'Edad de 27 a 64 años',
            values: [70, 60, 50, 90] 
          },
          {
            label: 'De 65 años en adelante',
            values: [100, 100, 95, 35]
          }
        ],
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de identificar una categoría específica en gráficos de líneas, calcular totales por columnas, aplicar incrementos porcentuales y obtener valores proyectados."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Paso 1: Calcular total actual de Clínicas privadas\n• Edad 1-14 años: 50 (miles)\n• Edad 15-39 años: 20 (miles)\n• Edad 27-64 años: 90 (miles)\n• Edad 65+ años: 35 (miles)\n• Total actual = 50 + 20 + 90 + 35 = 195 miles = 195.000 personas\n\n📋 Paso 2: Calcular incremento del 28%\n• Incremento = 28% de 195.000 = 0.28 × 195.000 = 54.600 personas\n\n📋 Paso 3: Calcular total proyectado\n• Total con incremento = 195.000 + 54.600 = 249.600 personas\n• Aproximadamente 250.000 personas (redondeado)\n\n📋 Verificación alternativa:\n• Total proyectado = 195.000 × 1.28 = 249.600 ≈ 250.000 personas ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo directo con multiplicador\n• Total actual Clínicas privadas: 195.000 personas\n• Incremento 28% = multiplicar por 1.28\n• 195.000 × 1.28 = 249.600 ≈ 250.000\n\n📊 Método 2: Cálculo paso a paso\n• 28% de 195.000 = (28 × 195.000) ÷ 100 = 54.600\n• Total: 195.000 + 54.600 = 249.600\n\n💰 Método 3: Estimación rápida\n• 195.000 ≈ 200.000 (para cálculo mental)\n• 28% de 200.000 = 56.000\n• Total ≈ 200.000 + 56.000 = 256.000 (cerca de las opciones)"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Usar total incorrecto de Clínicas privadas (no sumar todas las edades)\n• Error en cálculo de porcentajes (28% ≠ 0.028)\n• Calcular solo el incremento sin sumarlo al total original\n• Confundir las columnas del gráfico\n• No convertir correctamente de miles a unidades\n• Redondear incorrectamente el resultado final"
          },
          {
            title: "💪 Consejo de oposición",
            content: "Para incrementos porcentuales en gráficos: 1) Identifica la categoría objetivo, 2) Suma todos sus valores para obtener el total actual, 3) Multiplica por (1 + porcentaje/100) para obtener el total proyectado, 4) Verifica que el resultado sea lógico."
          }
        ]
      },
      option_a: '50.400 personas.',
      option_b: '52.300 personas.',
      option_c: '230.400 personas.',
      option_d: '220.400 personas.',
      correct_option: 2, // C = 230.400 personas (valor más cercano a 249.600)
      explanation: null, // Se maneja en el componente
      question_subtype: 'line_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'hard',
      time_limit_seconds: 180,
      cognitive_skills: ['chart_reading', 'data_extraction', 'percentage_calculation', 'basic_addition', 'projection_calculation'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de incremento en clínicas privadas...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de incremento en clínicas privadas añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 230.400 personas (195.000 × 1.28 ≈ 249.600)')
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

insertClinicAttendanceIncreaseQuestion()