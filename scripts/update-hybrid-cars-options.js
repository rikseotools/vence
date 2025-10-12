// scripts/update-hybrid-cars-options.js
// Actualizar opciones de respuesta para que sean coherentes con el cálculo

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function updateHybridCarsOptions() {
  const questionId = '21ee9540-6b62-400d-86e5-662bfc6304be'
  
  console.log('🚗 Actualizando opciones de respuesta de coches híbridos...')
  console.log(`📝 ID: ${questionId}`)

  // Cálculo correcto: 45% de 215,000 = 96,750
  // Opciones coherentes alrededor de este valor
  const updatedData = {
    option_a: '90,000',      // Algo menor
    option_b: '96,750',      // Exacto  
    option_c: '105,000',     // Algo mayor
    option_d: '85,000',      // Menor
    correct_option: 1,       // B = 96,750 (el cálculo exacto)
    explanation: "Total de coches en 2022: 25+95+30+65 = 215 (en miles = 215,000). Porcentaje de híbridos en 2022: 45%. Cálculo: 45% de 215,000 = 0.45 × 215,000 = 96,750 coches híbridos."
  }

  try {
    // Actualizar en la base de datos
    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update(updatedData)
      .eq('id', questionId)

    if (updateError) {
      console.error('❌ Error actualizando opciones:', updateError)
      return
    }

    console.log('✅ Opciones de respuesta actualizadas exitosamente:')
    console.log('   A) 90,000')
    console.log('   B) 96,750 ← CORRECTA')
    console.log('   C) 105,000') 
    console.log('   D) 85,000')
    console.log('')
    console.log('📊 Cálculo: 45% de 215,000 = 96,750 coches híbridos')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA ACTUALIZADA:')
    console.log(`   http://localhost:3000/debug/question/${questionId}`)

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

// Ejecutar
updateHybridCarsOptions()