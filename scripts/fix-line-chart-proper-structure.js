import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixLineChartProperStructure() {
  try {
    console.log('🔧 Corrigiendo estructura de datos de preguntas line_chart a formato correcto...')
    
    // IDs de las preguntas que necesitan corrección
    const questionIds = [
      'ed0ac50a-9694-4177-ae4a-11381186ee19',
      '9c31eeed-aee4-46c9-bd43-318b3d3597c1'
    ]

    for (const questionId of questionIds) {
      console.log(`🔧 Corrigiendo pregunta ${questionId}...`)

      // Obtener la pregunta actual
      const { data: question, error: fetchError } = await supabase
        .from('psychometric_questions')
        .select('*')
        .eq('id', questionId)
        .single()

      if (fetchError) {
        console.error(`❌ Error obteniendo pregunta ${questionId}:`, fetchError)
        continue
      }

      // Transformar la estructura de datos
      const currentAgeGroups = question.content_data.age_groups
      const categories = ['Centros salud', 'Hospitales', 'Centros especialidades', 'Clínicas privadas']
      const categoryKeys = ['centros_salud', 'hospitales', 'centros_especialidades', 'clinicas_privadas']

      // Convertir formato
      const newAgeGroups = currentAgeGroups.map(ageGroup => {
        const values = categoryKeys.map(key => ageGroup[key])
        return {
          label: ageGroup.name,
          values: values
        }
      })

      // Actualizar content_data con la estructura correcta
      const updatedContentData = {
        ...question.content_data,
        age_groups: newAgeGroups,
        categories: categories,
        // Mantener chart_data para compatibilidad
        chart_data: {
          type: "line_chart",
          title: question.content_data.chart_title,
          age_groups: newAgeGroups,
          categories: categories,
          legend: question.content_data.legend
        }
      }

      // Actualizar la pregunta
      const { error: updateError } = await supabase
        .from('psychometric_questions')
        .update({ content_data: updatedContentData })
        .eq('id', questionId)

      if (updateError) {
        console.error(`❌ Error actualizando pregunta ${questionId}:`, updateError)
      } else {
        console.log(`✅ Pregunta ${questionId} corregida con estructura correcta`)
      }
    }

    console.log('✅ Todas las preguntas line_chart han sido corregidas con estructura correcta')
    console.log('🔗 REVISAR PREGUNTAS:')
    console.log('   http://localhost:3000/debug/question/ed0ac50a-9694-4177-ae4a-11381186ee19')
    console.log('   http://localhost:3000/debug/question/9c31eeed-aee4-46c9-bd43-318b3d3597c1')

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

fixLineChartProperStructure()