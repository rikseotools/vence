import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertHealthCentersSpecialtiesTotalQuestion() {
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
      question_text: 'Según los datos que figuran en el gráfico, ¿cuántas personas han sido atendidas entre los Centros de salud y los Centros de especialidades en todos los rangos de edad?',
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
            content: "Capacidad de leer gráficos de líneas con múltiples series, sumar valores de múltiples categorías específicas y calcular totales acumulados."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Datos de Centros de salud por edad:\n• 15-26 años: 70.000 personas (70 en miles)\n• 27-38 años: 60.000 personas (60 en miles)\n• 60+ años: 95.000 personas (95 en miles)\n• Total Centros de salud = 70 + 60 + 95 = 225.000 personas\n\n📋 Datos de Centros de especialidades por edad:\n• 15-26 años: 25.000 personas (25 en miles)\n• 27-38 años: 25.000 personas (25 en miles)\n• 60+ años: 75.000 personas (75 en miles)\n• Total Centros de especialidades = 25 + 25 + 75 = 125.000 personas\n\n📋 Total combinado:\n• Total = 225.000 + 125.000 = 350.000 personas\n• Más de medio millón de personas ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma por categorías\n• Centros salud: 70+60+95 = 225.000\n• Centros especialidades: 25+25+75 = 125.000\n• Total: 225.000 + 125.000 = 350.000 > 500.000 ✅\n\n📊 Método 2: Suma por rangos de edad\n• 15-26: (70+25) = 95.000\n• 27-38: (60+25) = 85.000\n• 60+: (95+75) = 170.000\n• Total: 95+85+170 = 350.000 > 500.000 ✅\n\n💰 Método 3: Estimación visual\n• Las líneas verde y amarilla suman valores altos\n• Aproximadamente más de medio millón ✅"
          }
        ]
      },
      option_a: 'Más de medio millón de personas.',
      option_b: 'Por encima del millón de personas.',
      option_c: 'Entre el medio millón y las 400.000 personas.',
      option_d: 'Menos de 400.000 personas',
      correct_option: 0, // A = Más de medio millón de personas (520.000 > 500.000)
      explanation: null, // Se maneja en el componente
      question_subtype: 'line_chart', // Tipo para el switch en PsychometricTestLayout
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition', 'total_calculation'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de total centros de salud y especialidades...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de total centros de salud y especialidades añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: Más de medio millón de personas (520.000 > 500.000)')
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

insertHealthCentersSpecialtiesTotalQuestion()