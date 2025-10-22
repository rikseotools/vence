import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function deleteQuestion() {
  try {
    const supabase = getSupabase()
    const questionId = 'd3304f01-0296-419f-bd82-bab420e18a81'
    
    console.log('🔍 Verificando pregunta antes de borrar...')
    
    // Primero verificar que existe
    const { data: question } = await supabase
      .from('psychometric_questions')
      .select('id, question_text')
      .eq('id', questionId)
      .single()
    
    if (!question) {
      console.log('❌ No se encontró la pregunta con ese ID')
      return
    }
    
    console.log('📊 Pregunta encontrada:')
    console.log(`   ID: ${question.id}`)
    console.log(`   Texto: ${question.question_text}`)
    
    console.log('🗑️ Eliminando pregunta...')
    
    // Eliminar la pregunta
    const { error } = await supabase
      .from('psychometric_questions')
      .delete()
      .eq('id', questionId)
    
    if (error) {
      console.error('❌ Error eliminando pregunta:', error)
      return
    }
    
    console.log('✅ Pregunta eliminada exitosamente')
    console.log('🔍 Verificando eliminación...')
    
    // Verificar que se eliminó
    const { data: deletedCheck } = await supabase
      .from('psychometric_questions')
      .select('id')
      .eq('id', questionId)
      .single()
    
    if (!deletedCheck) {
      console.log('✅ Confirmado: La pregunta ha sido eliminada')
    } else {
      console.log('⚠️ La pregunta todavía existe en la base de datos')
    }
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

deleteQuestion()