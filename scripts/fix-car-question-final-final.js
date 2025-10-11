// scripts/fix-car-question-final-final.js
// Arreglar la pregunta de coches DEFINITIVAMENTE
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixCarQuestionFinalFinal() {
  try {
    console.log('🔧 Arreglando pregunta de coches DEFINITIVAMENTE...')

    // Buscar la pregunta
    const { data: question, error: findError } = await supabase
      .from('psychometric_questions')
      .select('id, correct_option, content_data')
      .eq('question_text', '¿Cuántos coches se vendieron en total?')
      .single()

    if (findError) {
      console.error('❌ No se encontró la pregunta:', findError)
      return
    }

    console.log('Estado actual:')
    console.log('  Respuesta marcada como correcta:', question.correct_option)
    console.log('  (1=A, 2=B, 3=C, 4=D)')

    // La respuesta DEBE ser B (option 2) = 323
    // Coche A: 24+36+12+38 = 110
    // Coche B: 89+24+37+63 = 213  
    // Total: 110+213 = 323 = Opción B

    const updates = {
      correct_option: 2, // B) 323 es la correcta
      content_data: {
        chart_data: {
          title: "COCHES VENDIDOS POR TRIMESTRE EN EL AÑO 2023",
          type: "bar_chart",
          quarters: [
            { name: "Trimestre 1", cocheA: 24, cocheB: 89 },
            { name: "Trimestre 2", cocheA: 36, cocheB: 24 },
            { name: "Trimestre 3", cocheA: 12, cocheB: 37 },
            { name: "Trimestre 4", cocheA: 38, cocheB: 63 }
          ],
          legend: {
            cocheA: "Coche A",
            cocheB: "Coche B"
          }
        }
      }
    }

    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update(updates)
      .eq('id', question.id)

    if (updateError) {
      console.error('❌ Error actualizando:', updateError)
      return
    }

    console.log('✅ Pregunta corregida:')
    console.log('  ✅ Respuesta correcta: 2 (B) = 323')
    console.log('  ✅ Datos del gráfico actualizados')
    console.log('')
    console.log('🔢 Verificación:')
    console.log('  Coche A: 24+36+12+38 = 110')
    console.log('  Coche B: 89+24+37+63 = 213')
    console.log('  Total: 110+213 = 323 ✅')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

fixCarQuestionFinalFinal()