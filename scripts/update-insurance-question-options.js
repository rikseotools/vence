import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updateInsuranceQuestionOptions() {
  try {
    const questionId = '092b0309-7dfe-4991-9788-bec3153a4c5e'
    
    // Actualizar las opciones de respuesta
    const { error } = await supabase
      .from('psychometric_questions')
      .update({
        option_a: 'Criterio A',
        option_b: 'Criterio D',
        option_c: 'Criterio B', 
        option_d: 'Criterio C',
        updated_at: new Date().toISOString()
      })
      .eq('id', questionId)
    
    if (error) {
      console.error('❌ Error actualizando opciones:', error)
      return
    }
    
    console.log('✅ Opciones de respuesta actualizadas exitosamente')
    console.log('📝 ID:', questionId)
    console.log('✅ Nuevas opciones:')
    console.log('   A: Criterio A')
    console.log('   B: Criterio D')
    console.log('   C: Criterio B ← Respuesta correcta')
    console.log('   D: Criterio C')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA ACTUALIZADA:')
    console.log(`   http://localhost:3000/debug/question/${questionId}`)
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

updateInsuranceQuestionOptions()