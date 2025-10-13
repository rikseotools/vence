import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function findRecentTableQuestions() {
  try {
    // Buscar preguntas de tipo data_tables
    const { data: questions, error } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, created_at, question_subtype')
      .eq('question_subtype', 'data_tables')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('❌ Error buscando preguntas:', error)
      return
    }

    console.log('🔍 Preguntas de tablas encontradas:', questions?.length || 0)
    
    if (questions && questions.length > 0) {
      questions.forEach((q, index) => {
        console.log(`\n📝 Pregunta ${index + 1}:`)
        console.log('   ID:', q.id)
        console.log('   Subtipo:', q.question_subtype)
        console.log('   Creada:', q.created_at)
        console.log('   Texto:', q.question_text.substring(0, 80) + '...')
        console.log(`   🔗 http://localhost:3000/debug/question/${q.id}`)
      })
      
      console.log('\n' + '='.repeat(50))
      console.log('🎯 TODAS LAS PREGUNTAS DE TABLAS:')
      questions.forEach((q, index) => {
        console.log(`${index + 1}. http://localhost:3000/debug/question/${q.id}`)
      })
    } else {
      console.log('⚠️ No se encontraron preguntas de tablas')
    }
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

findRecentTableQuestions()