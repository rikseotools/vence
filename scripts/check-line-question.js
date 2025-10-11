// scripts/check-line-question.js
// Script para verificar si la pregunta de líneas existe
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkLineQuestion() {
  try {
    console.log('🔍 Checking line chart question...')

    const questionId = '588c79ed-05fa-421a-8f32-23e4038b700b'

    // 1. Verificar si existe por ID
    const { data: byId, error: idError } = await supabase
      .from('psychometric_questions')
      .select('*')
      .eq('id', questionId)
      .single()

    if (idError) {
      console.log('❌ Question not found by ID:', idError.message)
    } else {
      console.log('✅ Question found by ID:', byId.id)
      console.log('   - Text:', byId.question_text.substring(0, 60) + '...')
      console.log('   - Type:', byId.question_subtype)
    }

    // 2. Buscar preguntas de tipo line_chart
    const { data: lineCharts, error: lineError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, question_subtype, created_at')
      .eq('question_subtype', 'line_chart')
      .order('created_at', { ascending: false })

    if (lineError) {
      console.log('❌ Error getting line charts:', lineError)
    } else {
      console.log(`\n📊 Found ${lineCharts.length} line chart questions:`)
      lineCharts.forEach((q, index) => {
        console.log(`${index + 1}. ID: ${q.id}`)
        console.log(`   Text: ${q.question_text.substring(0, 60)}...`)
        console.log(`   Created: ${q.created_at}`)
      })
    }

    // 3. Buscar preguntas recientes en graficos
    const { data: recent, error: recentError } = await supabase
      .from('psychometric_questions')
      .select(`
        id, question_text, question_subtype, created_at,
        psychometric_sections!inner(section_key)
      `)
      .eq('psychometric_sections.section_key', 'graficos')
      .order('created_at', { ascending: false })
      .limit(5)

    if (recentError) {
      console.log('❌ Error getting recent questions:', recentError)
    } else {
      console.log(`\n📈 Last 5 questions in graficos section:`)
      recent.forEach((q, index) => {
        console.log(`${index + 1}. ID: ${q.id}`)
        console.log(`   Type: ${q.question_subtype}`)
        console.log(`   Text: ${q.question_text.substring(0, 50)}...`)
        console.log(`   Created: ${q.created_at}`)
        console.log(`   Preview: http://localhost:3000/debug/question/${q.id}`)
        console.log('')
      })
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Ejecutar el script
checkLineQuestion()