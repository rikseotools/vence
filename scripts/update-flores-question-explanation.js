import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updateFloresQuestionExplanation() {
  try {
    const questionId = '7296edc6-f740-4bb0-9c71-6ca2a301f52d'
    
    // 1. Obtener la pregunta actual
    const { data: currentQuestion, error: fetchError } = await supabase
      .from('psychometric_questions')
      .select('content_data')
      .eq('id', questionId)
      .single()
    
    if (fetchError) {
      console.error('❌ Error obteniendo pregunta:', fetchError)
      return
    }
    
    console.log('✅ Pregunta encontrada, actualizando explicaciones...')
    
    // 2. Actualizar solo las explanation_sections, removiendo las dos últimas
    const updatedContentData = {
      ...currentQuestion.content_data,
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de cross-referencing múltiple: localizar datos específicos combinando información de 3 tablas diferentes con múltiples filtros simultáneos."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 TABLA 1: Identificar flores con color rosa\n✅ Rosa (colores: blanco, amarillo y rosa) - tiene ramos 6\n✅ Clavel (colores: amarillo y rosa) - tiene ramos 3 y 6\n✅ Gardenia (color: rosa) - tiene ramos 3, 6 y 12\n✅ Crisantemo (colores: blanco y rosa) - tiene ramos 3, 6 y 12\n✅ Orquídea (colores: blanco y rosa) - tiene ramos 3, 6 y 12\n✅ Gerbera (colores: amarillo y rosa) - tiene ramos 3 y 6\n\n📋 FILTRO: Solo las que tienen ramos de 6 (media docena)\n✅ Rosa, Clavel, Gardenia, Crisantemo, Orquídea, Gerbera\n\n📋 TABLA 3: De estas, ¿cuáles tienen entrega a domicilio = SÍ?\n❌ Rosa: NO\n❌ Clavel: NO\n✅ Gardenia: SÍ\n❌ Crisantemo: NO\n✅ Orquídea: SÍ\n❌ Gerbera: NO"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Filtrado progresivo\n• Paso 1: Marcar todas las flores rosas en Tabla 1\n• Paso 2: De estas, seleccionar las que tienen ramos \"6\"\n• Paso 3: Verificar en Tabla 3 cuáles tienen \"SÍ\" en entrega\n• Resultado: 2 flores (Gardenia y Orquídea)\n\n📊 Método 2: Descarte visual rápido\n• Observar columna \"Entrega domicilio\" en Tabla 3\n• Solo hay 4 flores con \"SÍ\": Margarita, Gardenia, Tulipán, Orquídea\n• De estas, verificar cuáles son rosas en Tabla 1\n• Descartar: Margarita (blanco/amarillo), Tulipán (amarillo)\n\n💰 Método 3: Descarte de opciones\n• Opción A (3): Imposible, máximo 2 cumplen entrega = SÍ y color rosa\n• Opción B (2): ✅ Correcto (Gardenia + Orquídea)\n• Opción C (0): Incorrecto, sí hay flores que cumplen\n• Opción D (1): Incorrecto, son más de 1"
        }
        // Removidas: "❌ Errores comunes a evitar" y "💪 Consejo de oposición"
      ]
    }
    
    // 3. Actualizar en base de datos
    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update({ 
        content_data: updatedContentData,
        updated_at: new Date().toISOString()
      })
      .eq('id', questionId)
    
    if (updateError) {
      console.error('❌ Error actualizando pregunta:', updateError)
      return
    }
    
    console.log('✅ Pregunta actualizada exitosamente')
    console.log('📝 ID:', questionId)
    console.log('♻️  Removidas secciones: "❌ Errores comunes" y "💪 Consejo de oposición"')
    console.log('✅ Quedan 3 secciones: Evaluación, Análisis paso a paso, Técnicas rápidas')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA ACTUALIZADA:')
    console.log(`   http://localhost:3000/debug/question/${questionId}`)
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

updateFloresQuestionExplanation()