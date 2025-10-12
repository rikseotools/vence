// scripts/update-hybrid-cars-chart-title.js
// Actualizar título del gráfico de barras para indicar que están en miles

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function updateHybridCarsChartTitle() {
  const questionId = '21ee9540-6b62-400d-86e5-662bfc6304be'
  
  console.log('🚗 Actualizando título del gráfico de coches híbridos...')
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

    // Actualizar solo el título del gráfico de barras
    const updatedContentData = {
      ...currentQuestion.content_data,
      chart_data: {
        ...currentQuestion.content_data.chart_data,
        bar_chart: {
          ...currentQuestion.content_data.chart_data.bar_chart,
          title: 'Ventas por trimestre (en miles)'
        }
      }
    }

    // Actualizar en la base de datos
    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update({ content_data: updatedContentData })
      .eq('id', questionId)

    if (updateError) {
      console.error('❌ Error actualizando título:', updateError)
      return
    }

    console.log('✅ Título del gráfico de barras actualizado exitosamente')
    console.log('📊 Nuevo título: "Ventas por trimestre (en miles)"')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA ACTUALIZADA:')
    console.log(`   http://localhost:3000/debug/question/${questionId}`)

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

// Ejecutar
updateHybridCarsChartTitle()