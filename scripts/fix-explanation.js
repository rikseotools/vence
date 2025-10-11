// scripts/fix-explanation.js
// Corregir la explicación para usar "Coche A/B" en lugar de "Modelo A/B"
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixExplanation() {
  try {
    console.log('🔧 Corrigiendo explicación para usar "Coche A/B"...')

    // Buscar la pregunta
    const { data: question, error: findError } = await supabase
      .from('psychometric_questions')
      .select('id')
      .eq('question_text', '¿Cuántos coches se vendieron en total?')
      .single()

    if (findError) {
      console.error('❌ No se encontró la pregunta:', findError)
      return
    }

    // Actualizar la explicación
    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update({
        explanation: "El total se calcula sumando las ventas de ambos coches: Coche A (24+36+12+38=110) + Coche B (89+24+37+63=213) = 323 coches en total."
      })
      .eq('id', question.id)

    if (updateError) {
      console.error('❌ Error actualizando explicación:', updateError)
      return
    }

    console.log('✅ Explicación corregida!')
    console.log('📝 Nueva explicación usa "Coche A" y "Coche B" consistentemente')

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

fixExplanation()