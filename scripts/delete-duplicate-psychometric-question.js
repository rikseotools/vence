// scripts/delete-duplicate-psychometric-question.js
// Eliminar pregunta psicotécnica duplicada de coches vendidos

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function deleteDuplicateQuestion() {
  const questionId = '22494a1e-0506-4dd1-b31b-13df672326fe'
  
  console.log('🗑️ Eliminando pregunta duplicada...')
  console.log(`📝 ID: ${questionId}`)

  try {
    // Primero verificar que la pregunta existe
    const { data: question, error: fetchError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, created_at')
      .eq('id', questionId)
      .single()

    if (fetchError || !question) {
      console.log('❌ La pregunta no existe o ya fue eliminada')
      return
    }

    console.log(`✅ Pregunta encontrada: "${question.question_text}"`)
    console.log(`📅 Creada: ${question.created_at}`)

    // Eliminar la pregunta
    const { error: deleteError } = await supabase
      .from('psychometric_questions')
      .delete()
      .eq('id', questionId)

    if (deleteError) {
      console.error('❌ Error eliminando pregunta:', deleteError)
      return
    }

    console.log('✅ Pregunta duplicada eliminada exitosamente')

    // Verificar que se eliminó
    const { data: verification, error: verifyError } = await supabase
      .from('psychometric_questions')
      .select('id')
      .eq('id', questionId)
      .single()

    if (verifyError && verifyError.code === 'PGRST116') {
      console.log('🔍 Verificación exitosa - la pregunta ya no existe en la base de datos')
    } else if (verification) {
      console.warn('⚠️ La pregunta aún existe - puede que no se haya eliminado correctamente')
    }

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

// Ejecutar
deleteDuplicateQuestion()