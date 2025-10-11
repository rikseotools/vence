// scripts/add-solution-explanation.js
// Añadir explicación detallada de la solución paso a paso
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addSolutionExplanation() {
  try {
    console.log('📝 Añadiendo explicación detallada de la solución...')

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

    // Explicación completa paso a paso
    const updatedData = {
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
            content: "Tu capacidad para interpretar gráficos de barras y realizar cálculos básicos con los datos presentados en tablas de apoyo."
          },
          {
            title: "📊 SOLUCIÓN PASO A PASO:",
            content: "Para calcular el total de coches vendidos, necesitamos sumar las ventas de ambos modelos en todos los trimestres:\n\n🚗 COCHE A:\n• Trimestre 1: 24 coches\n• Trimestre 2: 36 coches\n• Trimestre 3: 12 coches\n• Trimestre 4: 38 coches\n• TOTAL COCHE A: 24 + 36 + 12 + 38 = 110 coches\n\n🚙 COCHE B:\n• Trimestre 1: 89 coches\n• Trimestre 2: 24 coches\n• Trimestre 3: 37 coches\n• Trimestre 4: 63 coches\n• TOTAL COCHE B: 89 + 24 + 37 + 63 = 213 coches\n\n🏁 TOTAL GENERAL:\n110 + 213 = 323 coches\n\n✅ Respuesta correcta: B) 323"
          },
          {
            title: "⚡ TÉCNICA RÁPIDA PARA EXÁMENES:",
            content: "🔍 Método 1: Suma por columnas\nEn lugar de leer el gráfico barra por barra, usa la tabla de datos y suma por columnas (modelos).\n\n🧮 Método 2: Verificación rápida\nAntes de calcular, observa las opciones de respuesta para tener una idea del rango esperado.\n\n⏰ Método 3: Cálculo mental\nAgrupa números redondos: 24+36 ≈ 60, 12+38 = 50, entonces Coche A ≈ 110"
          },
          {
            title: "❌ Errores comunes a evitar:",
            content: "• NO sumar solo un trimestre\n• NO confundir totales por trimestre con totales por modelo\n• NO olvidar incluir algún modelo en el cálculo\n• NO leer mal los valores del gráfico (usar la tabla de apoyo)"
          },
          {
            title: "💪 Consejo de oposición:",
            content: "En gráficos con múltiples series (varios modelos), siempre verifica que has incluido TODAS las series en tu cálculo final. La pregunta pide el TOTAL, no parciales."
          }
        ]
      }
    }

    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update(updatedData)
      .eq('id', question.id)

    if (updateError) {
      console.error('❌ Error actualizando explicación:', updateError)
      return
    }

    console.log('✅ Explicación detallada añadida!')
    console.log('📝 Incluye:')
    console.log('  ✅ Solución paso a paso completa')
    console.log('  ✅ Cálculos detallados por modelo')
    console.log('  ✅ Técnicas rápidas para exámenes')
    console.log('  ✅ Errores comunes a evitar')
    console.log('  ✅ Consejos de oposición')

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

addSolutionExplanation()