import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixFormattingQuestion460310e2() {
  try {
    console.log('🔧 Corrigiendo formato de la pregunta 460310e2...')
    
    // Obtener la pregunta actual
    const { data: question, error: fetchError } = await supabase
      .from('psychometric_questions')
      .select('*')
      .eq('id', '460310e2-c68f-4e6e-88f8-d9d5ea27b888')
      .single()

    if (fetchError) {
      console.error('❌ Error obteniendo pregunta:', fetchError)
      return
    }

    // Corregir el formato de las explicaciones
    const updatedContentData = {
      ...question.content_data,
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de leer datos específicos de gráficos de barras, comparar valores entre períodos consecutivos y calcular descensos porcentuales."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Valores de consumo de frutas:\n• Año 2021: 10 kg/mes\n• Año 2022: 5 kg/mes\n• Diferencia: 10 - 5 = 5 kg/mes de descenso\n\n📋 Cálculo del porcentaje de descenso:\n• Descenso porcentual = (Diferencia ÷ Valor inicial) × 100\n• Descenso porcentual = (5 ÷ 10) × 100\n• Descenso porcentual = 0,5 × 100 = 50% ✅\n\n📋 Verificación:\n• 50% de 10 kg/mes = 5 kg/mes\n• 10 - 5 = 5 kg/mes en 2022 ✓"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Cálculo directo del descenso\n• (10 - 5) ÷ 10 × 100 = 50% ✅\n\n📊 Método 2: Comparación visual\n• 2022 es la mitad que 2021\n• La mitad = 50% de descenso ✅\n\n💰 Método 3: Regla de tres\n• Si 10 kg/mes = 100%\n• Entonces 5 kg/mes = 50%\n• Descenso = 100% - 50% = 50% ✅"
        }
      ]
    }

    // Actualizar la pregunta
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({ content_data: updatedContentData })
      .eq('id', '460310e2-c68f-4e6e-88f8-d9d5ea27b888')
      .select()

    if (error) {
      console.error('❌ Error actualizando pregunta:', error)
      return
    }

    console.log('✅ Formato de pregunta 460310e2 corregido exitosamente')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log('   http://localhost:3000/debug/question/460310e2-c68f-4e6e-88f8-d9d5ea27b888')

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

fixFormattingQuestion460310e2()