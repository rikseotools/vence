// scripts/update-chocolate-question-explanations.js
// Actualizar explicaciones personalizadas de la pregunta de chocolatinas

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function updateChocolateQuestionExplanations() {
  const questionId = '187ed4b6-6a65-4d44-ba16-50029b4281f0'
  
  console.log('🍫 Actualizando explicaciones personalizadas de la pregunta de chocolatinas...')
  console.log(`📝 ID: ${questionId}`)

  // Nuevas explicaciones específicas para esta pregunta
  const newExplanationSections = [
    {
      title: "💡 ¿Qué evalúa este ejercicio?",
      content: "Capacidad de leer e interpretar gráficos de barras comparativos, extrayendo datos específicos de un año concreto (2022) ignorando información de distracción (2023)."
    },
    {
      title: "📊 ANÁLISIS PASO A PASO:",
      content: "📋 Datos del año 2022 (barras naranjas):\n✅ PRIMER TRIMESTRE: 24 chocolatinas\n✅ SEGUNDO TRIMESTRE: 36 chocolatinas  \n✅ TERCER TRIMESTRE: 12 chocolatinas\n✅ CUARTO TRIMESTRE: 38 chocolatinas\n\n📋 Comparación rápida:\n• Trimestre con MÁS ventas: 4º (38)\n• Trimestre con MENOS ventas: 3º (12)"
    },
    {
      title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
      content: "🔍 Método 1: Descarte visual rápido\n• Ignorar completamente las barras azules (2023)\n• Comparar solo alturas de barras naranjas (2022)\n• El cuarto trimestre claramente supera al resto\n\n📊 Método 2: Lectura directa de valores\n• Leer números encima de cada barra naranja\n• 24 → 36 → 12 → 38\n• Máximo = 38 = Cuarto trimestre\n\n💰 Método 3: Descarte de opciones\n• Opción A: \"En el cuarto\" → ✅ CORRECTO (38 > todos)\n• Opción B: \"En el tercero\" → ❌ Es el MÍNIMO (12)\n• Opción C: \"En el primero\" → ❌ Solo 24 (menor que 36 y 38)\n• Opción D: \"En el segundo\" → ❌ 36 es menor que 38"
    },
    {
      title: "❌ Errores comunes a evitar",
      content: "• Confundir años: leer datos de 2023 en lugar de 2022\n• Leer la pregunta mal: buscar mínimo en lugar de máximo\n• Comparar trimestres entre años: 1º de 2022 vs 1º de 2023\n• Sumar trimestres: dar el total en lugar del trimestre específico"
    },
    {
      title: "💪 Consejo de oposición",
      content: "En gráficos comparativos, SIEMPRE lee la pregunta DOS veces para identificar qué año/categoría específica te piden. Marca visualmente la serie correcta antes de buscar el valor."
    }
  ]

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

    // Actualizar solo las explanation_sections manteniendo el resto
    const updatedContentData = {
      ...currentQuestion.content_data,
      explanation_sections: newExplanationSections
    }

    // Actualizar en la base de datos
    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update({ content_data: updatedContentData })
      .eq('id', questionId)

    if (updateError) {
      console.error('❌ Error actualizando explicaciones:', updateError)
      return
    }

    console.log('✅ Explicaciones personalizadas actualizadas exitosamente')
    console.log('📚 Nuevas secciones añadidas:')
    newExplanationSections.forEach((section, index) => {
      console.log(`   ${index + 1}. ${section.title}`)
    })

    console.log('')
    console.log('🔗 REVISAR PREGUNTA ACTUALIZADA:')
    console.log(`   http://localhost:3000/debug/question/${questionId}`)

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

// Ejecutar
updateChocolateQuestionExplanations()