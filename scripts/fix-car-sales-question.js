// scripts/fix-car-sales-question.js
// Corregir pregunta de coches con datos exactos de la imagen
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixCarSalesQuestion() {
  try {
    console.log('🔧 Corrigiendo pregunta de coches con datos exactos...')

    // Datos EXACTOS extraídos de la imagen
    const correctChartData = {
      title: "COCHES VENDIDOS POR TRIMESTRE EN EL AÑO 2023",
      type: "bar_chart",
      quarters: [
        { name: "Trimestre 1", modelA: 24, modelB: 89 },
        { name: "Trimestre 2", modelA: 36, modelB: 24 },
        { name: "Trimestre 3", modelA: 12, modelB: 37 },
        { name: "Trimestre 4", modelA: 38, modelB: 63 }
      ],
      legend: {
        modelA: "Modelo A",
        modelB: "Modelo B"
      }
    }

    // Verificar totales según la imagen
    const totalModelA = correctChartData.quarters.reduce((sum, q) => sum + q.modelA, 0) // 110
    const totalModelB = correctChartData.quarters.reduce((sum, q) => sum + q.modelB, 0) // 213
    const totalGeneral = totalModelA + totalModelB // 323

    console.log('🔢 Totales según imagen:')
    console.log(`   Modelo A: ${totalModelA}`)
    console.log(`   Modelo B: ${totalModelB}`)
    console.log(`   Total: ${totalGeneral}`)
    console.log(`   ✅ Coincide con respuesta B: 323`)

    // Buscar la pregunta existente de coches
    const { data: existingQuestion, error: findError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text')
      .eq('question_text', '¿Cuántos coches se vendieron en total?')
      .single()

    if (findError) {
      console.error('❌ No se encontró la pregunta existente:', findError)
      return
    }

    console.log(`📋 Actualizando pregunta: ${existingQuestion.id}`)

    // Actualizar con los datos corregidos
    const updatedData = {
      content_data: {
        chart_data: correctChartData,
        explanation_sections: [
          {
            title: "📊 ANÁLISIS DEL GRÁFICO",
            content: "Este gráfico de barras muestra las ventas de dos modelos de coches (A y B) distribuidas por trimestres durante 2023."
          },
          {
            title: "🎯 ESTRATEGIA DE RESOLUCIÓN",
            content: "Para encontrar el total de coches vendidos:\n• Sumar todas las ventas del Modelo A: 24 + 36 + 12 + 38 = 110\n• Sumar todas las ventas del Modelo B: 89 + 24 + 37 + 63 = 213\n• Suma total: 110 + 213 = 323 coches"
          },
          {
            title: "⚡ TÉCNICA RÁPIDA",
            content: "Aprovecha la tabla de datos incluida para sumar directamente por columnas en lugar de leer el gráfico barra por barra."
          },
          {
            title: "🔍 VERIFICACIÓN",
            content: "Comprueba que has sumado correctamente: el total debe ser 323, que corresponde a la opción B."
          }
        ]
      }
    }

    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update(updatedData)
      .eq('id', existingQuestion.id)

    if (updateError) {
      console.error('❌ Error actualizando pregunta:', updateError)
      return
    }

    console.log('✅ Pregunta corregida exitosamente!')
    console.log(`🔍 Preview: http://localhost:3000/debug/question/${existingQuestion.id}`)
    console.log(`🎯 Test URL: http://localhost:3000/auxiliar-administrativo-estado/test/psicotecnicos/capacidad-administrativa`)

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

fixCarSalesQuestion()