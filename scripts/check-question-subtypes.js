// scripts/check-question-subtypes.js
// Script para investigar qué question_subtype se usa para gráficos de barras
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkQuestionSubtypes() {
  try {
    console.log('🔍 Investigating question subtypes...')

    // 1. Ver todos los subtypes que existen
    const { data: subtypes, error: subtypesError } = await supabase
      .from('psychometric_questions')
      .select('question_subtype')
      .not('question_subtype', 'is', null)
    
    if (subtypesError) {
      console.error('❌ Error getting subtypes:', subtypesError)
      return
    }

    // Contar frecuencia de cada subtype
    const counts = {}
    subtypes.forEach(item => {
      counts[item.question_subtype] = (counts[item.question_subtype] || 0) + 1
    })

    console.log('📊 Question subtypes found:')
    Object.entries(counts).forEach(([subtype, count]) => {
      console.log(`   - ${subtype}: ${count} questions`)
    })

    // 2. Buscar preguntas relacionadas con gráficos
    console.log('\n🔍 Looking for chart-related questions...')
    
    const { data: chartQuestions, error: chartError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, question_subtype, content_data')
      .or('question_text.ilike.%gráfico%,question_text.ilike.%barras%,content_data->>chart_type.eq.bar_chart')
      .limit(5)

    if (chartError) {
      console.error('❌ Error getting chart questions:', chartError)
    } else {
      console.log(`📋 Found ${chartQuestions?.length || 0} chart-related questions:`)
      chartQuestions?.forEach((q, index) => {
        console.log(`\n${index + 1}. ID: ${q.id}`)
        console.log(`   Subtype: ${q.question_subtype}`)
        console.log(`   Text: ${q.question_text.substring(0, 60)}...`)
        if (q.content_data?.chart_type) {
          console.log(`   Chart type: ${q.content_data.chart_type}`)
        }
      })
    }

    // 3. Ver qué cuestiones se renderizan en la imagen que me mostró
    console.log('\n🖼️ Looking for questions in capacidad-administrativa > graficos...')
    
    const { data: graficosQuestions, error: graficosError } = await supabase
      .from('psychometric_questions')
      .select(`
        id, question_text, question_subtype, content_data,
        psychometric_sections!inner(section_key),
        psychometric_categories!inner(category_key)
      `)
      .eq('psychometric_categories.category_key', 'capacidad-administrativa')
      .eq('psychometric_sections.section_key', 'graficos')
      .limit(10)

    if (graficosError) {
      console.error('❌ Error getting graficos questions:', graficosError)
    } else {
      console.log(`📈 Found ${graficosQuestions?.length || 0} questions in graficos section:`)
      graficosQuestions?.forEach((q, index) => {
        console.log(`\n${index + 1}. ID: ${q.id}`)
        console.log(`   Subtype: ${q.question_subtype}`)
        console.log(`   Text: ${q.question_text.substring(0, 80)}...`)
      })
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Ejecutar el script
checkQuestionSubtypes()