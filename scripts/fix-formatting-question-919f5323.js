import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixFormattingQuestion919f5323() {
  try {
    console.log('🔧 Corrigiendo formato de la pregunta 919f5323...')
    
    // Obtener la pregunta actual
    const { data: question, error: fetchError } = await supabase
      .from('psychometric_questions')
      .select('*')
      .eq('id', '919f5323-1137-41cf-916a-2eaaed21cd23')
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
          content: "Capacidad de interpretar gráficos de sectores, identificar porcentajes específicos y aplicar cálculos de porcentajes sobre totales modificados."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Identificación del porcentaje del Equipo 1:\n• Equipo 1: 21,8% del total\n\n📋 Cálculo con puntuación máxima de 200:\n• Puntos Equipo 1 = 21,8% × 200\n• Puntos Equipo 1 = 0,218 × 200\n• Puntos Equipo 1 = 43,6 puntos ✅\n\n📋 Verificación:\n• 43,6 puntos representan el 21,8% de 200 puntos\n• 43,6 ÷ 200 = 0,218 = 21,8% ✓"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Cálculo directo del porcentaje\n• 21,8% × 200 = 43,6 puntos ✅\n\n📊 Método 2: Regla de tres\n• Si 100% = 200 puntos\n• Entonces 21,8% = (21,8 × 200) ÷ 100 = 43,6 puntos ✅\n\n💰 Método 3: Cálculo fraccionario\n• 21,8% = 218/1000\n• (218 × 200) ÷ 1000 = 43.600 ÷ 1000 = 43,6 puntos ✅"
        }
      ]
    }

    // Actualizar la pregunta
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({ content_data: updatedContentData })
      .eq('id', '919f5323-1137-41cf-916a-2eaaed21cd23')
      .select()

    if (error) {
      console.error('❌ Error actualizando pregunta:', error)
      return
    }

    console.log('✅ Formato de pregunta 919f5323 corregido exitosamente')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log('   http://localhost:3000/debug/question/919f5323-1137-41cf-916a-2eaaed21cd23')

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

fixFormattingQuestion919f5323()