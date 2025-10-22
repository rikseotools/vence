import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function checkTableSchema() {
  try {
    const supabase = getSupabase()
    
    console.log('🔍 Checking existing questions...')
    const { data: questions } = await supabase
      .from('psychometric_questions')
      .select('*')
      .limit(1)
    
    if (questions && questions.length > 0) {
      console.log('📊 Sample question structure:', Object.keys(questions[0]))
      console.log('📊 Full sample question:', questions[0])
    } else {
      console.log('📊 No questions found')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkTableSchema()