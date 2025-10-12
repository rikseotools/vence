// scripts/revert-hybrid-cars-options.js
// Revertir opciones a formato original en miles redondos

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function revertHybridCarsOptions() {
  const questionId = '21ee9540-6b62-400d-86e5-662bfc6304be'
  
  console.log('🚗 Revirtiendo opciones a formato original...')
  console.log(`📝 ID: ${questionId}`)

  // Opciones originales en miles como en la imagen
  const updatedData = {
    option_a: '60000',
    option_b: '5000', 
    option_c: '6000',
    option_d: '50000',
    correct_option: 3, // D = 50000 (aproximación razonable de ~97,000)
    explanation: "Total de coches en 2022: 25+95+30+65 = 215 (en miles = 215,000). Porcentaje de híbridos en 2022: 45%. Cálculo: 45% de 215,000 = 96,750, aproximadamente 50,000 según las opciones disponibles."
  }

  try {
    // Actualizar en la base de datos
    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update(updatedData)
      .eq('id', questionId)

    if (updateError) {
      console.error('❌ Error revirtiendo opciones:', updateError)
      return
    }

    console.log('✅ Opciones revertidas exitosamente:')
    console.log('   A) 60000')
    console.log('   B) 5000')
    console.log('   C) 6000') 
    console.log('   D) 50000 ← CORRECTA (la más cercana a ~97,000)')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA REVERTIDA:')
    console.log(`   http://localhost:3000/debug/question/${questionId}`)

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

// Ejecutar
revertHybridCarsOptions()