import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertHighestAttendanceLocationQuestion() {
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
      question_text: '¿En qué lugar, de los que aparecen en la tabla, se atendió a mayor número de personas?',
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
            label: "27-38 años",
            values: [70, 60, 50, 25]
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
            content: "Capacidad de leer gráficos de líneas con múltiples series, sumar todas las categorías por lugar de atención y determinar el mayor total."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Suma por lugar de atención (en miles):\n• Centros de salud: 95+30+70+100 = 295.000 personas\n• Hospitales: 30+20+60+100 = 210.000 personas\n• Centros especialidades: 70+30+50+90 = 240.000 personas\n• Clínicas privadas: 30+20+25+30 = 105.000 personas\n\n📋 Comparación de totales:\n• Centros de salud: 295.000 (MÁXIMO) ✅\n• Hospitales: 210.000\n• Centros especialidades: 240.000\n• Clínicas privadas: 105.000\n\n📋 Conclusión:\n• Mayor número de personas atendidas: Centros de salud ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma por columnas\n• Centros salud: 95+30+70+100 = 295.000 ✅\n• Otros lugares tienen totales menores\n\n📊 Método 2: Comparación visual\n• La línea verde (Centros salud) está consistentemente alta\n• Sus valores son los mayores en la mayoría de grupos\n• Total mayor: Centros de salud ✅\n\n💰 Método 3: Identificación de máximos\n• 1-14 años: Centros salud (100) es máximo\n• 60+ años: Centros salud (100) comparte máximo\n• Suma total máxima: Centros de salud ✅"
          }
        ]
      },
      option_a: 'Centro especialidades',
      option_b: 'Clínicas privadas',
      option_c: 'Hospitales',
      option_d: 'Centros de salud',
      correct_option: 3, // D = Centros de salud
      explanation: null,
      question_subtype: 'line_chart',
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'basic_addition', 'comparison', 'total_calculation'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de lugar con mayor atención...')

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

insertHighestAttendanceLocationQuestion()