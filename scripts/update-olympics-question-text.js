import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updateOlympicsQuestionText() {
  try {
    const questionId = 'a09b1e11-39ea-44c4-8fc9-aa1dd123d9a6'
    
    // Actualizar el texto de la pregunta para mayor claridad
    const { error } = await supabase
      .from('psychometric_questions')
      .update({
        question_text: '¿Cuál es la suma total de todas las participaciones en JJ.OO de invierno de los cinco países de la tabla?',
        updated_at: new Date().toISOString()
      })
      .eq('id', questionId)
    
    if (error) {
      console.error('❌ Error actualizando pregunta:', error)
      return
    }
    
    console.log('✅ Texto de la pregunta actualizado exitosamente')
    console.log('📝 ID:', questionId)
    console.log('✅ Nueva pregunta: "¿Cuál es la suma total de todas las participaciones en JJ.OO de invierno de los cinco países de la tabla?"')
    console.log('✅ Respuesta correcta: C (100 = 12+24+21+24+19)')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA ACTUALIZADA:')
    console.log(`   http://localhost:3000/debug/question/${questionId}`)
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

updateOlympicsQuestionText()