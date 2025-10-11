// scripts/fix-car-question-completely.js
// Arreglar COMPLETAMENTE la pregunta de coches
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixCarQuestionCompletely() {
  try {
    console.log('🔧 Arreglando COMPLETAMENTE la pregunta de coches...')

    // Datos correctos de la imagen
    const correctData = {
      question_text: "¿Cuántos coches se vendieron en total?",
      option_a: "289",
      option_b: "323", 
      option_c: "429",
      option_d: "110",
      correct_option: 2, // B) 323 es la respuesta CORRECTA
      explanation: "Para calcular el total de coches vendidos, sumamos las ventas de ambos modelos por trimestre: Coche A (24+36+12+38=110) + Coche B (89+24+37+63=213) = 323 coches en total.",
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
        },
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Tu capacidad para interpretar gráficos de barras y realizar cálculos con los datos presentados en tablas."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO",
            content: "• Coche A por trimestre: 24 + 36 + 12 + 38 = 110 coches\n• Coche B por trimestre: 89 + 24 + 37 + 63 = 213 coches\n• Total general: 110 + 213 = 323 coches ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Usa la tabla de datos en lugar de leer el gráfico barra por barra\n🧮 Método 2: Suma por columnas (modelo) en lugar de por filas (trimestre)\n💰 Método 3: Verifica que tu resultado coincida con una de las opciones"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "No confundir los totales por trimestre con el total general. Verificar que sumas todos los modelos y todos los trimestres."
          },
          {
            title: "💪 Consejo de oposición",
            content: "En gráficos de barras múltiples, siempre verifica que entiendes qué representa cada color antes de empezar a calcular."
          }
        ]
      }
    }

    // Verificar el cálculo
    const totalA = correctData.content_data.chart_data.quarters.reduce((sum, q) => sum + q.cocheA, 0)
    const totalB = correctData.content_data.chart_data.quarters.reduce((sum, q) => sum + q.cocheB, 0)
    const total = totalA + totalB

    console.log('🔢 Verificación del cálculo:')
    console.log(`   Coche A: ${totalA}`)
    console.log(`   Coche B: ${totalB}`)
    console.log(`   Total: ${total}`)
    console.log(`   ✅ Respuesta correcta: ${correctData.option_b}`)

    if (total.toString() !== correctData.option_b) {
      console.error('❌ ERROR: El cálculo no coincide con la respuesta!')
      return
    }

    // Buscar la pregunta
    const { data: question, error: findError } = await supabase
      .from('psychometric_questions')
      .select('id')
      .eq('question_text', '¿Cuántos coches se vendieron en total?')
      .single()

    if (findError) {
      console.error('❌ No se encontró la pregunta:', findError)
      return
    }

    // Actualizar COMPLETAMENTE la pregunta
    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update(correctData)
      .eq('id', question.id)

    if (updateError) {
      console.error('❌ Error actualizando pregunta:', updateError)
      return
    }

    console.log('✅ Pregunta completamente arreglada!')
    console.log('✅ Respuesta correcta: B) 323')
    console.log('✅ Explicación corregida (sin frutas/verduras)')
    console.log('✅ Leyenda simplificada (solo Coche A/B)')
    console.log(`🔍 Preview: http://localhost:3000/debug/question/${question.id}`)

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

fixCarQuestionCompletely()