import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertOphthalmologySpecialty1526YearsQuestion() {
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
      question_text: 'En los Centros de especialidades, el 60% de personas atendidas fue por la especialidad de oftalmología; ¿cuántas personas fueron atendidas en esta especialidad del rango de edad de 15 a 26 años?',
      content_data: {
        categories: ['Centros salud', 'Hospitales', 'Centros especialidades', 'Clínicas privadas'],
        age_groups: [
          {
            label: "1 mes a 14 años",
            values: [95, 30, 70, 30]
          },
          {
            label: "15-26 años", 
            values: [30, 20, 25, 20]
          },
          {
            label: "27-59 años",
            values: [70, 60, 50, 25]
          },
          {
            label: "60+ años",
            values: [100, 100, 75, 30]
          }
        ],
        chart_title: 'Personas atendidas por rango de edad / lugar de la atención (en miles) al mes',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de leer gráficos de líneas, identificar valores específicos de categorías y rangos de edad concretos, y aplicar cálculos de porcentajes sobre valores extraídos."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 Identificación del valor en Centros de especialidades:\n• Rango 15-26 años en Centros especialidades: 25.000 personas (25 en miles)\n\n📋 Cálculo del 60% para oftalmología:\n• Personas atendidas por oftalmología = 60% × 25.000\n• Oftalmología = 0,60 × 25.000 = 15.000 personas ✅\n\n📋 Verificación:\n• Total en Centros especialidades (15-26 años): 25.000 personas\n• 60% de especialidad oftalmología: 15.000 personas\n• 40% otras especialidades: 10.000 personas\n• Total: 15.000 + 10.000 = 25.000 ✓"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo directo del 60%\n• 25.000 × 0,60 = 15.000 personas ✅\n\n📊 Método 2: Identificación visual y cálculo\n• Centros especialidades, línea amarilla en 15-26 años: 25 (miles)\n• 60% de 25.000 = 15.000 personas ✅\n\n💰 Método 3: Cálculo fraccionario\n• 60% = 3/5 de 25.000\n• (3 × 25.000) ÷ 5 = 75.000 ÷ 5 = 15.000 personas ✅"
          }
        ]
      },
      option_a: '16.000 pacientes.',
      option_b: '14.000 pacientes.',
      option_c: '17.000 pacientes.',
      option_d: '15.000 pacientes.',
      correct_option: 3, // D = 15.000 pacientes
      explanation: null,
      question_subtype: 'line_chart',
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['chart_reading', 'data_extraction', 'percentage_calculation', 'selective_reading'],
      is_active: true,
      is_verified: true
    }

    console.log('💾 Insertando pregunta de oftalmología en Centros especialidades...')

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

insertOphthalmologySpecialty1526YearsQuestion()