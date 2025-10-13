import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixLineChartDataStructure() {
  try {
    console.log('🔧 Corrigiendo estructura de datos de preguntas line_chart...')
    
    // Obtener preguntas line_chart problemáticas (las que tienen chart_data)
    const { data: questions, error: fetchError } = await supabase
      .from('psychometric_questions')
      .select('id, content_data')
      .eq('question_subtype', 'line_chart')
      .not('content_data->chart_data', 'is', null)

    if (fetchError) {
      console.error('❌ Error obteniendo preguntas:', fetchError)
      return
    }

    console.log(`📊 Encontradas ${questions.length} preguntas line_chart para corregir`)

    for (const question of questions) {
      if (question.content_data.chart_data && question.content_data.chart_data.age_groups) {
        console.log(`🔧 Corrigiendo pregunta ${question.id}...`)

        // Restructurar: mover age_groups y legend del chart_data al nivel principal
        const updatedContentData = {
          ...question.content_data,
          age_groups: question.content_data.chart_data.age_groups,
          legend: question.content_data.chart_data.legend || question.content_data.legend,
          chart_title: question.content_data.chart_data.title || question.content_data.chart_title,
          // Mantener chart_data por compatibilidad pero con estructura limpia
          chart_data: {
            type: question.content_data.chart_data.type,
            title: question.content_data.chart_data.title,
            age_groups: question.content_data.chart_data.age_groups,
            legend: question.content_data.chart_data.legend
          }
        }

        // Actualizar la pregunta
        const { error: updateError } = await supabase
          .from('psychometric_questions')
          .update({ content_data: updatedContentData })
          .eq('id', question.id)

        if (updateError) {
          console.error(`❌ Error actualizando pregunta ${question.id}:`, updateError)
        } else {
          console.log(`✅ Pregunta ${question.id} corregida`)
        }
      }
    }

    console.log('✅ Todas las preguntas line_chart han sido corregidas')
    console.log('🔗 REVISAR PREGUNTAS:')
    console.log('   http://localhost:3000/debug/question/ed0ac50a-9694-4177-ae4a-11381186ee19')
    console.log('   http://localhost:3000/debug/question/9c31eeed-aee4-46c9-bd43-318b3d3597c1')

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

fixLineChartDataStructure()