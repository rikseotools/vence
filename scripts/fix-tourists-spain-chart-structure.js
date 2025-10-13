import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixTouristsSpainChartStructure() {
  try {
    console.log('🔧 Corrigiendo estructura de pregunta de turistas España...')
    
    // Obtener la pregunta actual
    const { data: question, error: fetchError } = await supabase
      .from('psychometric_questions')
      .select('*')
      .eq('id', '904994f7-d8f6-4c6f-97eb-5d101b7b1001')
      .single()

    if (fetchError) {
      console.error('❌ Error obteniendo pregunta:', fetchError)
      return
    }

    // Corregir la estructura para BarChartQuestion
    const updatedContentData = {
      chart_type: 'bar_chart',
      chart_title: 'Turismo en España',
      x_axis_label: 'Comunidades Autónomas',
      y_axis_label: 'Millones de turistas',
      chart_data: {
        type: 'bar_chart',
        title: 'Número de turistas',
        quarters: [
          { name: 'Andalucía', turistas: 10 },
          { name: 'Islas Canarias', turistas: 10 },
          { name: 'Cataluña', turistas: 7.5 },
          { name: 'Islas Baleares', turistas: 5 },
          { name: 'Resto comunidades', turistas: 7.5 }
        ],
        legend: {
          turistas: 'Turistas (millones)'
        }
      },
      explanation_sections: question.content_data.explanation_sections
    }

    // Actualizar la pregunta
    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update({ 
        content_data: updatedContentData
      })
      .eq('id', '904994f7-d8f6-4c6f-97eb-5d101b7b1001')

    if (updateError) {
      console.error('❌ Error actualizando pregunta:', updateError)
      return
    }

    console.log('✅ Pregunta de turistas España corregida')
    console.log('🔗 REVISAR PREGUNTA:')
    console.log('   http://localhost:3000/debug/question/904994f7-d8f6-4c6f-97eb-5d101b7b1001')

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

fixTouristsSpainChartStructure()