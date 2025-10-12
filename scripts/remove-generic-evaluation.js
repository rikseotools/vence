// scripts/remove-generic-evaluation.js
// Eliminar sección genérica "¿Qué evalúa este ejercicio?"

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function removeGenericEvaluation() {
  const questionId = '96823492-d7b8-465e-9256-16be9b5541e9'
  
  console.log('🗑️ Eliminando sección genérica "¿Qué evalúa este ejercicio?"...')
  console.log(`📝 ID: ${questionId}`)

  try {
    // Primero obtener los datos actuales
    const { data: currentQuestion, error: fetchError } = await supabase
      .from('psychometric_questions')
      .select('content_data')
      .eq('id', questionId)
      .single()

    if (fetchError || !currentQuestion) {
      console.error('❌ Error obteniendo pregunta:', fetchError)
      return
    }

    // Actualizar las secciones de explicación eliminando la sección genérica
    const updatedContentData = {
      ...currentQuestion.content_data,
      explanation_sections: [
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: `📋 Paso 1: Calcular total de coches por año

• 2022: 25 + 45 + 15 + 25 = 110 (en miles = 110.000)
• 2023: 35 + 95 + 30 + 55 = 215 (en miles = 215.000)


📋 Paso 2: Obtener porcentajes de diésel

• 2022: 20% de diésel
• 2023: 10% de diésel


📋 Paso 3: Calcular diésel por año

• 2022: 20% de 110.000 = 22.000
• 2023: 10% de 215.000 = 21.500


📋 Paso 4: Sumar ambos años

• Total: 22.000 + 21.500 = 43.500`
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: `🔍 Método 1: Estimación rápida

• 2022: ~100 × 20% = ~20.000
• 2023: ~200 × 10% = ~20.000
• Total estimado: ~40.000-45.000


📊 Método 2: Cálculo mental optimizado

• 20% de 110 = 22 (en miles)
• 10% de 215 = 21,5 (en miles)
• Suma: 22 + 21,5 = 43,5 (en miles)


💰 Método 3: Verificación por descarte

• El resultado debe estar entre 40.000-50.000
• Solo 43.500 encaja perfectamente`
        },
        {
          title: "💪 Consejo de oposición",
          content: "Los psicotécnicos al principio parecen muy difíciles, pero solo hay que aprenderse los distintos tipos y los trucos para resolverlos. Una vez que dominas los patrones, se repiten constantemente. En gráficos mixtos: identifica qué datos necesitas, localízalos en el gráfico correcto, calcula paso a paso y verifica que el resultado tenga sentido."
        }
      ]
    }

    // Actualizar en la base de datos
    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update({ content_data: updatedContentData })
      .eq('id', questionId)

    if (updateError) {
      console.error('❌ Error actualizando explicación:', updateError)
      return
    }

    console.log('✅ Sección genérica eliminada exitosamente')
    console.log('📝 Estructura final optimizada:')
    console.log('   1. Análisis paso a paso')
    console.log('   2. Técnicas de análisis rápido')
    console.log('   3. Consejo de oposición')
    console.log('')
    console.log('🎯 Solo contenido útil y específico para esta pregunta')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA ACTUALIZADA:')
    console.log(`   http://localhost:3000/debug/question/${questionId}`)

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

// Ejecutar
removeGenericEvaluation()