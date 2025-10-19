import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function updateQuestion16() {
  try {
    const updatedQuestionData = {
      question_subtype: 'word_analysis'
    }

    const { data, error } = await supabase
      .from('psychometric_questions')
      .update(updatedQuestionData)
      .eq('id', 'f1fe1059-222e-4c02-8e97-49a65e1530cc')
      .select()

    if (error) {
      console.error('❌ Error actualizando pregunta:', error)
      return
    }

    console.log('✅ Pregunta 16 actualizada para usar word_analysis')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

updateQuestion16()