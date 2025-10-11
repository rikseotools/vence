// scripts/check-existing-pie-question.js
// Script para ver en detalle la pregunta de gráfico existente
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkExistingPieQuestion() {
  try {
    console.log('🔍 Checking existing pie chart question...')

    const { data: question, error } = await supabase
      .from('psychometric_questions')
      .select('*')
      .eq('id', 'a7b48ff5-c350-4ec6-b807-383969bad8c2')
      .single()

    if (error) {
      console.error('❌ Error getting question:', error)
      return
    }

    console.log('📋 Question details:')
    console.log('ID:', question.id)
    console.log('Text:', question.question_text)
    console.log('Subtype:', question.question_subtype)
    console.log('Options:')
    console.log('  A:', question.option_a)
    console.log('  B:', question.option_b)  
    console.log('  C:', question.option_c)
    console.log('  D:', question.option_d)
    console.log('Correct:', question.correct_option)
    
    console.log('\n📊 Content Data:')
    console.log(JSON.stringify(question.content_data, null, 2))
    
    console.log('\n💡 Explanation:')
    console.log(question.explanation)

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Ejecutar el script
checkExistingPieQuestion()