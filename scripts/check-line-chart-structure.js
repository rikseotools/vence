import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkLineChartStructure() {
  try {
    console.log('🔍 Verificando estructura de preguntas line_chart que funcionan...')
    
    // Buscar una pregunta line_chart que funcione
    const { data: workingQuestion, error: workingError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, content_data')
      .eq('question_subtype', 'line_chart')
      .not('content_data->chart_data', 'is', null)
      .limit(1)

    if (workingError) {
      console.error('❌ Error obteniendo pregunta funcional:', workingError)
      return
    }

    if (workingQuestion.length > 0) {
      console.log('✅ Pregunta line_chart funcional encontrada:')
      console.log('ID:', workingQuestion[0].id)
      console.log('Texto:', workingQuestion[0].question_text.substring(0, 50) + '...')
      console.log('\n📊 Estructura chart_data:')
      console.log(JSON.stringify(workingQuestion[0].content_data.chart_data, null, 2))
    }

    console.log('\n🔍 Verificando pregunta problemática ed0ac50a...')
    
    // Verificar la pregunta problemática
    const { data: problematicQuestion, error: problematicError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, content_data')
      .eq('id', 'ed0ac50a-9694-4177-ae4a-11381186ee19')
      .single()

    if (problematicError) {
      console.error('❌ Error obteniendo pregunta problemática:', problematicError)
      return
    }

    console.log('✅ Pregunta problemática:')
    console.log('ID:', problematicQuestion.id)
    console.log('Texto:', problematicQuestion.question_text.substring(0, 50) + '...')
    console.log('\n📊 Estructura chart_data:')
    console.log(JSON.stringify(problematicQuestion.content_data.chart_data, null, 2))

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

checkLineChartStructure()