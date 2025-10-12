// scripts/clean-all-old-explanations.js
// Limpiar TODAS las explicaciones viejas que causan conflicto

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanAllOldExplanations() {
  const questionId = '588c79ed-05fa-421a-8f32-23e4038b700b'
  
  console.log('🧹 Limpiando TODAS las explicaciones viejas con errores...')

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

    // Crear content_data completamente limpio - solo con lo esencial y correcto
    const cleanContentData = {
      exam_tip: "En gráficos de líneas: 1) Identifica la serie correcta por color/leyenda, 2) Localiza el punto exacto, 3) Lee el valor con precisión, 4) Suma todos los valores de esa categoría.",
      subtitle: "(en miles) al mes",
      age_groups: currentQuestion.content_data.age_groups,
      categories: currentQuestion.content_data.categories,
      chart_type: "line_chart",
      chart_title: "Personas atendidas por rango de edad / lugar de la atención",
      x_axis_label: "Tipo de centro",
      y_axis_label: "Número de personas (miles)",
      question_context: "Observa el siguiente gráfico de líneas que muestra la distribución de pacientes por edad y tipo de centro:",
      target_group_value: 50,
      total_target_center: 210,
      evaluation_description: "Tu capacidad para interpretar gráficos de líneas con múltiples series y calcular porcentajes específicos.",
      
      // ÚNICA explicación correcta y completa
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


📋 Paso 3: Calcular el porcentaje EXACTO

• Fórmula: (Parte ÷ Total) × 100
• Aplicado: (50 ÷ 210) × 100
• Resultado: 23.809523... %
• Respuesta más cercana: 23,8% ✅`
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

• A) 22% - Cerca pero algo bajo
• B) 23,8% - Es el más cercano al cálculo exacto ✅
• C) 21,80% - Demasiado bajo para 50/210  
• D) 20,83% - Muy bajo, claramente incorrecto`
        }
      ]
    }

    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update({ content_data: cleanContentData })
      .eq('id', questionId)

    if (updateError) {
      console.error('❌ Error actualizando pregunta:', updateError)
      return
    }

    console.log('✅ Todas las explicaciones viejas eliminadas')
    console.log('🧹 Propiedades conflictivas removidas:')
    console.log('   - quick_method_1, quick_method_2, quick_method_3')
    console.log('   - common_errors')
    console.log('   - Cualquier referencia a 20,83%')
    console.log('')
    console.log('✅ Solo queda la explicación correcta y exacta')
    console.log('📊 Resultado: (50 ÷ 210) × 100 = 23.809...% → 23,8%')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA LIMPIA:')
    console.log(`   http://localhost:3000/debug/question/${questionId}`)

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

cleanAllOldExplanations()