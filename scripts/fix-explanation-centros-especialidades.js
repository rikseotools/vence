// scripts/fix-explanation-centros-especialidades.js
// Corregir la explicación que tiene el error de aproximación

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixExplanation() {
  const questionId = '588c79ed-05fa-421a-8f32-23e4038b700b'
  
  console.log('🔧 Corrigiendo explicación con error de aproximación...')

  try {
    const { data: currentQuestion, error: fetchError } = await supabase
      .from('psychometric_questions')
      .select('content_data')
      .eq('id', questionId)
      .single()

    if (fetchError || !currentQuestion) {
      console.error('❌ Error obteniendo pregunta:', fetchError)
      return
    }

    // Corregir la explicación
    const updatedContentData = {
      ...currentQuestion.content_data,
      explanation_sections: [
        {
          title: "📊 ANÁLISIS PASO A PASO - GRÁFICO DE LÍNEAS:",
          content: `📋 Paso 1: Localizar la serie correcta en el gráfico

• Buscar columna: "Centros de especialidades" (3ª columna)
• Buscar línea: "27-59 años" (línea más oscura)
• Leer valor exacto donde se cruzan: 50 (miles de personas)


📋 Paso 2: Obtener total de pacientes en Centros de especialidades

• 0-1 años: 70 mil
• 15-26 años: 30 mil
• 27-59 años: 50 mil
• 60+ años: 60 mil
• Total: 70 + 30 + 50 + 60 = 210 mil personas


📋 Paso 3: Calcular el porcentaje

• Fórmula: (Grupo objetivo ÷ Total) × 100
• Cálculo: (50 ÷ 210) × 100
• Resultado: 23.81% ≈ 23,8% ✅`
        },
        {
          title: "⚡ TÉCNICAS DE CÁLCULO MENTAL (Para oposiciones)",
          content: `🔍 Método 1: Estimación visual rápida

• 50 de 210 es aproximadamente 1/4 del total
• 1/4 = 25%, así que el resultado debe estar cerca del 25%
• Entre las opciones, 23,8% es la más cercana a 25%


🧮 Método 2: Simplificación por aproximación

• 50 ÷ 210 ≈ 50 ÷ 200 = 1/4 = 25%
• Pero como 210 > 200, el resultado será algo menor que 25%
• 23,8% es coherente con esta lógica


💡 Método 3: Cálculo mental directo

• 50 ÷ 210 = 5 ÷ 21
• 5 ÷ 20 = 0,25 = 25%
• Como 21 > 20, el resultado será menor: ~23,8%


🚨 Método 4: Descarte por lógica

• 22% está cerca, pero es ligeramente bajo
• 23,8% es el cálculo exacto ✅
• 21,80% es demasiado bajo para 50/210
• 20,83% es claramente incorrecto (sería ~44/210)`
        }
      ]
    }

    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update({ content_data: updatedContentData })
      .eq('id', questionId)

    if (updateError) {
      console.error('❌ Error actualizando explicación:', updateError)
      return
    }

    console.log('✅ Explicación corregida exitosamente')
    console.log('🔧 Error corregido: 23.81% ≈ 23,8% (no 20,83%)')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA:')
    console.log(`   http://localhost:3000/debug/question/${questionId}`)

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

fixExplanation()