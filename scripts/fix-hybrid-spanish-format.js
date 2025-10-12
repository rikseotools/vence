// scripts/fix-hybrid-spanish-format.js
// Corregir formato de números a estilo español en pregunta de híbridos

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixHybridSpanishFormat() {
  const questionId = '21ee9540-6b62-400d-86e5-662bfc6304be'
  
  console.log('🇪🇸 Corrigiendo formato español en pregunta de híbridos...')
  console.log(`📝 ID: ${questionId}`)

  // Opciones con formato español
  const updatedData = {
    option_a: '90.000',
    option_b: '96.750',
    option_c: '105.000',
    option_d: '85.000',
    correct_option: 1, // B = 96.750
    explanation: "Total de coches en 2022: 25+95+30+65 = 215 (en miles = 215.000). Porcentaje de híbridos en 2022: 45%. Cálculo: 45% de 215.000 = 0,45 × 215.000 = 96.750 coches híbridos."
  }

  try {
    // Actualizar en la base de datos
    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update(updatedData)
      .eq('id', questionId)

    if (updateError) {
      console.error('❌ Error actualizando formato:', updateError)
      return
    }

    console.log('✅ Formato de números corregido a estilo español:')
    console.log('   A) 90.000')
    console.log('   B) 96.750 ← CORRECTA')
    console.log('   C) 105.000')
    console.log('   D) 85.000')
    console.log('')
    console.log('🔢 Cambios: 90,000 → 90.000, 96,750 → 96.750, etc.')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA ACTUALIZADA:')
    console.log(`   http://localhost:3000/debug/question/${questionId}`)

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

// Ejecutar
fixHybridSpanishFormat()