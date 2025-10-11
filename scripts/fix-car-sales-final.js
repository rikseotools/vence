// scripts/fix-car-sales-final.js
// Corregir pregunta con datos EXACTOS de la imagen original
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixCarSalesFinal() {
  try {
    console.log('🔧 Corrigiendo pregunta con datos EXACTOS de imagen original...')

    // Datos EXACTOS de la imagen original (no del que generé)
    const correctChartData = {
      title: "COCHES VENDIDOS POR TRIMESTRE EN EL AÑO 2023",
      type: "bar_chart",
      quarters: [
        { name: "Trimestre 1", cocheA: 24, cocheB: 89 },
        { name: "Trimestre 2", cocheA: 36, cocheB: 24 },
        { name: "Trimestre 3", cocheA: 12, cocheB: 37 },
        { name: "Trimestre 4", cocheA: 38, cocheB: 63 }
      ],
      legend: {
        cocheA: "Coche A",  // EXACTO de la imagen
        cocheB: "Coche B"   // EXACTO de la imagen
      }
    }

    // Verificar totales
    const totalCocheA = correctChartData.quarters.reduce((sum, q) => sum + q.cocheA, 0) // 110
    const totalCocheB = correctChartData.quarters.reduce((sum, q) => sum + q.cocheB, 0) // 213
    const totalGeneral = totalCocheA + totalCocheB // 323

    console.log('🔢 Totales verificados:')
    console.log(`   Coche A: ${totalCocheA}`)
    console.log(`   Coche B: ${totalCocheB}`)
    console.log(`   Total: ${totalGeneral}`)
    console.log(`   ✅ Respuesta correcta: B) 323`)

    // Buscar la pregunta existente
    const { data: question, error: findError } = await supabase
      .from('psychometric_questions')
      .select('id')
      .eq('question_text', '¿Cuántos coches se vendieron en total?')
      .single()

    if (findError) {
      console.error('❌ No se encontró la pregunta:', findError)
      return
    }

    // Actualizar con estructura corregida
    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update({
        content_data: {
          chart_data: correctChartData,
          explanation_sections: [
            {
              title: "📊 ANÁLISIS DEL GRÁFICO",
              content: "Este gráfico muestra las ventas de Coche A y Coche B por trimestres en 2023. Observa que ambos modelos tienen ventas variables a lo largo del año."
            },
            {
              title: "🎯 ESTRATEGIA DE RESOLUCIÓN",
              content: "Para calcular el total:\n• Coche A: 24 + 36 + 12 + 38 = 110 unidades\n• Coche B: 89 + 24 + 37 + 63 = 213 unidades\n• Total general: 110 + 213 = 323 coches"
            },
            {
              title: "⚡ TÉCNICA RÁPIDA", 
              content: "Usa la tabla de datos que acompaña al gráfico para sumar directamente, es más rápido que leer las barras una por una."
            },
            {
              title: "🔍 VERIFICACIÓN",
              content: "Comprueba tu suma: 110 + 213 = 323. Esta es la opción B, que debe ser la respuesta correcta."
            }
          ]
        }
      })
      .eq('id', question.id)

    if (updateError) {
      console.error('❌ Error actualizando:', updateError)
      return
    }

    console.log('✅ Pregunta corregida con datos exactos!')
    console.log(`🔍 Preview: http://localhost:3000/debug/question/${question.id}`)

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

fixCarSalesFinal()