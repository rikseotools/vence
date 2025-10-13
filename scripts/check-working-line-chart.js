import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkWorkingLineChart() {
  try {
    console.log('🔍 Buscando preguntas line_chart que realmente funcionan...')
    
    // Buscar preguntas line_chart sin chart_data (las que funcionan)
    const { data: workingQuestions, error: workingError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, content_data')
      .eq('question_subtype', 'line_chart')
      .is('content_data->chart_data', null)
      .limit(2)

    if (workingError) {
      console.error('❌ Error obteniendo preguntas funcionales:', workingError)
      return
    }

    if (workingQuestions.length > 0) {
      console.log('✅ Preguntas line_chart funcionales encontradas:')
      workingQuestions.forEach((q, index) => {
        console.log(`\n${index + 1}. ID: ${q.id}`)
        console.log(`   Texto: ${q.question_text.substring(0, 50)}...`)
        console.log('   Estructura age_groups:')
        console.log(JSON.stringify(q.content_data.age_groups, null, 2))
        if (q.content_data.categories) {
          console.log('   Categorías:', q.content_data.categories)
        }
      })
    } else {
      console.log('❌ No se encontraron preguntas line_chart funcionales')
    }

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

checkWorkingLineChart()