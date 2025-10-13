import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function findInsuranceQuestion() {
  try {
    // Buscar preguntas que contengan "Marque" y "seguro"
    const { data: questions, error } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, created_at, question_subtype')
      .ilike('question_text', '%Marque%')
      .ilike('question_text', '%seguro%')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('❌ Error buscando pregunta:', error)
      return
    }

    console.log('🔍 Preguntas encontradas:', questions?.length || 0)
    
    if (questions && questions.length > 0) {
      questions.forEach((q, index) => {
        console.log(`\n📝 Pregunta ${index + 1}:`)
        console.log('   ID:', q.id)
        console.log('   Subtipo:', q.question_subtype)
        console.log('   Creada:', q.created_at)
        console.log('   Texto:', q.question_text.substring(0, 100) + '...')
        console.log('')
        console.log('🔗 REVISAR PREGUNTA:')
        console.log(`   http://localhost:3000/debug/question/${q.id}`)
        console.log('')
      })
      
      // Mostrar el más reciente como principal
      console.log('🎯 PREGUNTA MÁS RECIENTE:')
      console.log(`   http://localhost:3000/debug/question/${questions[0].id}`)
    } else {
      console.log('⚠️ No se encontraron preguntas con ese patrón')
    }
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

findInsuranceQuestion()