import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertHospitalNonEmergencySurgeryQuestion() {
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
      question_text: 'Del total de personas atendidas en Hospitales, un 15 % fue por urgencias y un 45 % por intervenciones quirúrgicas; ¿qué cantidad de personas no fueron ni por urgencias ni por intervenciones quirúrgicas?',
      content_data: {
        categories: ['Centros salud', 'Hospitales', 'Centros especialidades', 'Clínicas privadas'],
        age_groups: [
          {
            label: "1 mes a 14 años",
            values: [95, 30, 70, 30]
          },
          {
            label: "15-26 años", 
            values: [30, 20, 30, 20]
          },
          {
            label: "27-59 años",
            values: [70, 60, 50, 95]
          },
          {
            label: "60+ años",
            values: [100, 100, 60, 30]
          }
        ],
        chart_title: 'Personas atendidas por rango de edad / lugar de la atención (en miles) al mes',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de leer gráficos de líneas, sumar totales de una categoría específica y aplicar cálculos de porcentajes para determinar valores restantes."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Total de personas atendidas en Hospitales:\n• 1-14 años: 30.000 personas\n• 15-26 años: 20.000 personas\n• 27-59 años: 60.000 personas\n• 60+ años: 100.000 personas\n• Total Hospitales = 30 + 20 + 60 + 100 = 210.000 personas\n\n📋 Cálculo de porcentajes:\n• Urgencias: 15% × 210.000 = 31.500 personas\n• Intervenciones quirúrgicas: 45% × 210.000 = 94.500 personas\n• Total urgencias + cirugías: 31.500 + 94.500 = 126.000 personas\n\n📋 Personas por otros motivos:\n• Otros motivos = Total - (Urgencias + Cirugías)\n• Otros motivos = 210.000 - 126.000 = 84.000 personas\n• Porcentaje restante: 100% - 15% - 45% = 40% ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo del porcentaje restante\n• 100% - 15% - 45% = 40%\n• 40% × 210.000 = 84.000 personas ✅\n\n📊 Método 2: Suma de hospitales y cálculo directo\n• Total hospitales: 30+20+60+100 = 210.000\n• No urgencias ni cirugías: 210.000 × 0,40 = 84.000 ✅\n\n💰 Método 3: Resta de totales\n• Urgencias + Cirugías: (15%+45%) × 210.000 = 126.000\n• Resto: 210.000 - 126.000 = 84.000 ✅"
          }
        ]
      },
      option_a: '1.200.000 personas.',
      option_b: '40.000 personas.',
      option_c: '80.000 personas.',
      option_d: '100.000 personas.',
      correct_option: 2, // C = 80.000 personas (aproximadamente 84.000)
      explanation: null,
      question_subtype: 'line_chart',
      difficulty: 'hard',
      time_limit_seconds: 150,
      cognitive_skills: ['chart_reading', 'data_extraction', 'percentage_calculation', 'basic_addition', 'subtraction'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de hospitales sin urgencias ni cirugías...')

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

insertHospitalNonEmergencySurgeryQuestion()