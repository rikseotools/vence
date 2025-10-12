// scripts/add-fruits-vegetables-explanation.js
// Añadir explicación didáctica completa a la pregunta de frutas y verduras

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addFruitsVegetablesExplanation() {
  const questionId = '4838d19f-673e-4911-99d0-1cfbeb5b0c7d'
  
  console.log('📚 Añadiendo explicación didáctica completa...')
  console.log(`📝 ID: ${questionId}`)

  try {
    // Primero obtener los datos actuales
    const { data: currentQuestion, error: fetchError } = await supabase
      .from('psychometric_questions')
      .select('content_data, option_a, option_b, option_c, option_d, correct_option')
      .eq('id', questionId)
      .single()

    if (fetchError || !currentQuestion) {
      console.error('❌ Error obteniendo pregunta:', fetchError)
      return
    }

    console.log('📊 Datos actuales:')
    console.log('   A)', currentQuestion.option_a)
    console.log('   B)', currentQuestion.option_b) 
    console.log('   C)', currentQuestion.option_c)
    console.log('   D)', currentQuestion.option_d)
    console.log('   Correcta:', currentQuestion.correct_option)

    // Añadir explicación específica para esta pregunta
    const updatedContentData = {
      ...currentQuestion.content_data,
      explanation_sections: [
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: `📋 Paso 1: Sumar consumo total de frutas por año

• 2019: 12 kg
• 2020: 15 kg  
• 2021: 18 kg
• 2022: 20 kg
• Total frutas: 12 + 15 + 18 + 20 = 65 kg


📋 Paso 2: Sumar consumo total de verduras por año

• 2019: 8 kg
• 2020: 10 kg
• 2021: 12 kg  
• 2022: 14 kg
• Total verduras: 8 + 10 + 12 + 14 = 44 kg


📋 Paso 3: Calcular la diferencia total

• Diferencia = Total frutas - Total verduras
• Diferencia = 65 - 44 = 21 kg`
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: `🔍 Método 1: Estimación rápida

• Frutas: ~15 × 4 años = ~60 kg
• Verduras: ~10 × 4 años = ~40 kg  
• Diferencia estimada: ~20 kg
• La respuesta más cercana es 21 kg


📊 Método 2: Cálculo mental optimizado

• Diferencias por año: (12-8) + (15-10) + (18-12) + (20-14)
• = 4 + 5 + 6 + 6 = 21 kg
• Más rápido que sumar totales separados


💰 Método 3: Verificación por descarte

• Si fuera 15 kg → muy bajo (diferencia mínima por año sería ~4)
• Si fuera 30 kg → muy alto (diferencia máxima por año sería ~7)
• 21 kg es coherente con las diferencias observadas`
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

    console.log('✅ Explicación didáctica añadida exitosamente')
    console.log('📝 Incluye:')
    console.log('   - Análisis paso a paso con valores específicos')
    console.log('   - 3 técnicas de análisis rápido para oposiciones')
    console.log('   - Método de estimación y verificación por descarte')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA CON EXPLICACIÓN:')
    console.log(`   http://localhost:3000/debug/question/${questionId}`)

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

// Ejecutar
addFruitsVegetablesExplanation()