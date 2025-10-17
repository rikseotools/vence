import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function findOrthographyQuestions() {
  try {
    const { data: questions, error } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, created_at')
      .or('question_text.ilike.%errores%,question_text.ilike.%orden alfabético%,question_text.ilike.%acentos%,question_text.ilike.%ortográficos%,question_text.ilike.%transcrib%,question_text.ilike.%palabras faltan%')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching questions:', error)
      return
    }

    console.log('🔍 Últimas preguntas de ortografía añadidas:')
    console.log('=' .repeat(60))
    
    questions.forEach((question, index) => {
      const questionText = question.question_text.length > 60 
        ? question.question_text.substring(0, 60) + '...'
        : question.question_text
      
      console.log(`${index + 1}. ID: ${question.id}`)
      console.log(`   Pregunta: ${questionText}`)
      console.log(`   Link: http://localhost:3000/debug/question/${question.id}`)
      console.log(`   Creada: ${new Date(question.created_at).toLocaleString()}`)
      console.log('')
    })

  } catch (error) {
    console.error('❌ Script error:', error)
  }
}

findOrthographyQuestions()