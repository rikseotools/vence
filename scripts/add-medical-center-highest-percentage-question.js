import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertMedicalCenterHighestPercentageQuestion() {
  try {
    console.log('🔍 Buscando sección de gráficos en capacidad administrativa...')
    
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('*')
      .eq('category_key', 'capacidad-administrativa')
      .single()

    if (categoryError) {
      console.error('❌ Error buscando categoría:', categoryError)
      return
    }

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

    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: '¿Cuál de los cuatro centros de atención médica soporta un porcentaje mayor de pacientes si nos fijamos en el total de los rangos de edad de 15 a 26 años y 27 a 59 años?',
      content_data: {
        categories: ['Centros salud', 'Hospitales', 'Centros especialidades', 'Clínicas privadas'],
        age_groups: [
          {
            label: "1 mes a 14 años",
            values: [95, 30, 70, 30]
          },
          {
            label: "15-26 años", 
            values: [35, 10, 25, 5]
          },
          {
            label: "27-59 años",
            values: [65, 60, 50, 90]
          },
          {
            label: "60+ años",
            values: [100, 100, 90, 30]
          }
        ],
        chart_title: 'Personas atendidas por rango de edad / lugar de la atención (en miles) al mes',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de leer gráficos de líneas, sumar valores de rangos específicos de edad por categoría y comparar totales para identificar el mayor."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Suma de rangos 15-26 años y 27-59 años por centro:\n• Centros de salud: 35 + 65 = 100.000 personas\n• Hospitales: 10 + 60 = 70.000 personas\n• Centros especialidades: 25 + 50 = 75.000 personas\n• Clínicas privadas: 5 + 90 = 95.000 personas\n\n📋 Comparación de totales:\n• Centros de salud: 100.000 (MÁXIMO) ✅\n• Hospitales: 70.000\n• Centros especialidades: 75.000\n• Clínicas privadas: 95.000\n\n📋 Porcentaje del total de estos rangos:\n• Total de los 4 centros: 100+70+75+95 = 340.000\n• Centros de salud: 100/340 = 29,41% (el mayor)"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma por rangos específicos\n• Solo sumar 15-26 años y 27-59 años por centro\n• Centros salud: 35+65 = 100 (máximo) ✅\n\n📊 Método 2: Identificación visual\n• La línea verde (Centros salud) tiene valores altos en ambos rangos\n• 15-26: valor medio-alto, 27-59: valor alto\n• Mayor total: Centros de salud ✅\n\n💰 Método 3: Comparación directa\n• Verificar que 100.000 > 95.000 > 75.000 > 70.000\n• Centros de salud es el mayor ✅"
          }
        ]
      },
      option_a: 'Hospitales.',
      option_b: 'Centros de salud.',
      option_c: 'Centros de especialidades.',
      option_d: 'Clínicas privadas.',
      correct_option: 1, // B = Centros de salud
      explanation: null,
      question_subtype: 'line_chart',
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition', 'comparison', 'selective_calculation'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de centro médico con mayor porcentaje...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

    return data[0]?.id

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

insertMedicalCenterHighestPercentageQuestion()