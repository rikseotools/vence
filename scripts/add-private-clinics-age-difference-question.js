import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertPrivateClinicsAgeDifferenceQuestion() {
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
      question_text: '¿Qué diferencia de personas atendidas en Clínicas privadas hay entre la población de 15 a 26 años y la de 60 o más años?',
      content_data: {
        chart_type: 'line_chart',
        chart_title: 'Personas atendidas por rango de edad / lugar de la atención (en miles) al mes',
        x_axis_label: 'Centros de atención',
        y_axis_label: 'Personas (en miles)',
        chart_data: {
          type: 'line_chart',
          title: 'Personas atendidas por rango de edad / lugar de la atención (en miles) al mes',
          age_groups: [
            {
              name: "15-26 años",
              centros_salud: 70,
              hospitales: 35,
              centros_especialidades: 25,
              clinicas_privadas: 5
            },
            {
              name: "27-38 años", 
              centros_salud: 60,
              hospitales: 35,
              centros_especialidades: 25,
              clinicas_privadas: 35
            },
            {
              name: "60+ años",
              centros_salud: 95,
              hospitales: 50,
              centros_especialidades: 75,
              clinicas_privadas: 35
            }
          ],
          legend: {
            centros_salud: "Centros de salud",
            hospitales: "Hospitales", 
            centros_especialidades: "Centros de especialidades",
            clinicas_privadas: "Clínicas privadas"
          }
        },
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de leer gráficos de líneas con múltiples series, identificar valores específicos para rangos de edad concretos y calcular diferencias entre grupos."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Identificación de valores en Clínicas privadas:\n• Población 15-26 años: 5.000 personas (5 en miles)\n• Población 60+ años: 35.000 personas (35 en miles)\n\n📋 Cálculo de la diferencia:\n• Diferencia = 60+ años - 15-26 años\n• Diferencia = 35.000 - 5.000\n• Diferencia = 30.000 personas ✅\n\n📋 Verificación:\n• El grupo de 60+ años tiene 7 veces más atendidos\n• 35.000 - 5.000 = 30.000 personas de diferencia ✓"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Lectura directa del gráfico\n• Línea rosa en Clínicas privadas: 5 vs 35 (en miles)\n• Diferencia = 35 - 5 = 30 miles = 30.000 personas ✅\n\n📊 Método 2: Comparación visual\n• La diferencia es notable visualmente\n• 60+ años está muy por encima de 15-26 años\n• Diferencia aproximada de 30.000 personas ✅\n\n💰 Método 3: Verificación por rangos\n• 60+ años: entre 30-40 miles (35)\n• 15-26 años: entre 0-10 miles (5)\n• Diferencia: aproximadamente 30.000 ✅"
          }
        ]
      },
      option_a: '35.000 personas.',
      option_b: '30.000 personas.',
      option_c: '25.000 personas.',
      option_d: '15.000 personas.',
      correct_option: 1, // B = 30.000 personas (35.000 - 5.000)
      explanation: null, // Se maneja en el componente
      question_subtype: 'line_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'subtraction', 'comparison'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de diferencia de edad en clínicas privadas...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de diferencia de edad en clínicas privadas añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: 30.000 personas (35.000 - 5.000)')
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

insertPrivateClinicsAgeDifferenceQuestion()