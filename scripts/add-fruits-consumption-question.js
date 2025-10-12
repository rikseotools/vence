// scripts/add-fruits-consumption-question.js
// Añadir pregunta psicotécnica de gráfico de barras - consumo de frutas, pescado y verduras

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addFruitsConsumptionQuestion() {
  console.log('🍎 Añadiendo pregunta de consumo de frutas por año...')

  // Primero obtenemos el section_id de "graficos" en "capacidad-administrativa"
  const { data: section, error: sectionError } = await supabase
    .from('psychometric_sections')
    .select('id, section_key, category_id, psychometric_categories(id, category_key)')
    .eq('section_key', 'graficos')
    .eq('psychometric_categories.category_key', 'capacidad-administrativa')
    .single()

  if (sectionError || !section) {
    console.error('❌ Error obteniendo sección de gráficos:', sectionError)
    return
  }

  console.log(`✅ Sección encontrada: ${section.id} (${section.section_key})`)
  console.log(`✅ Categoría ID: ${section.category_id}`)

  const questionData = {
    category_id: section.category_id,
    section_id: section.id,
    question_text: 'Se ha propuesto que el consumo de frutas aumente para el año 2023 un 35% respecto al año 2019. ¿Cuántos kg/mes supondría ese incremento?',
    content_data: {
      chart_type: 'bar_chart',
      chart_title: 'Consumo de alimentos frescos por persona expresado en Kg/mes',
      x_axis_label: 'Años',
      y_axis_label: 'Kg/mes',
      description: 'Gráfico que muestra el consumo de frutas, pescado y verduras desde 2019 hasta 2022',
      chart_data: {
        type: 'bar_chart',
        title: 'Consumo de alimentos frescos por persona expresado en Kg/mes',
        quarters: [
          {
            name: 'Año 2019',
            frutas: 15,
            pescado: 10,
            verduras: 20
          },
          {
            name: 'Año 2020', 
            frutas: 20,
            pescado: 10,
            verduras: 20
          },
          {
            name: 'Año 2021',
            frutas: 10,
            pescado: 5,
            verduras: 15
          },
          {
            name: 'Año 2022',
            frutas: 5,
            pescado: 5,
            verduras: 10
          }
        ],
        legend: {
          frutas: 'Frutas',
          pescado: 'Pescado',
          verduras: 'Verduras'
        }
      },
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de cálculo de porcentajes sobre datos extraídos de gráficos de barras, requiriendo localizar un valor específico y aplicar operaciones matemáticas básicas."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Datos necesarios del gráfico:\n✅ Consumo de frutas en 2019: 15 kg/mes\n✅ Incremento propuesto: 35% del valor de 2019\n\n📋 Cálculo del incremento:\n• Base (2019): 15 kg/mes\n• Incremento: 35% de 15 = 0.35 × 15 = 5.25 kg/mes\n• El incremento ES la respuesta (no el total)"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Cálculo mental del 35%\n• 10% de 15 = 1.5\n• 30% = 3 × 1.5 = 4.5\n• 5% = 0.5 × 1.5 = 0.75\n• 35% = 4.5 + 0.75 = 5.25 kg/mes\n\n📊 Método 2: Fracción equivalente\n• 35% = 35/100 = 7/20\n• 7/20 × 15 = (7 × 15)/20 = 105/20 = 5.25\n\n💰 Método 3: Descarte de opciones\n• Opción A: 5,25 → ✅ CORRECTO (35% de 15)\n• Opción B: 6,00 → ❌ Sería 40% de 15\n• Opción C: 7,5 → ❌ Sería 50% de 15\n• Opción D: 5,5 → ❌ Aproximadamente 37% de 15"
        },
        {
          title: "❌ Errores comunes a evitar",
          content: "• Confundir incremento con total: responder 20.25 (15 + 5.25)\n• Leer el año equivocado: usar datos de 2020, 2021 o 2022\n• Error en porcentajes: calcular 25% o 45% en lugar de 35%\n• Leer categoría incorrecta: usar datos de pescado o verduras"
        },
        {
          title: "💪 Consejo de oposición",
          content: "En problemas de porcentajes sobre gráficos, SIEMPRE identifica: 1) El valor base (año 2019), 2) El porcentaje exacto (35%), 3) Si piden incremento o total final. Lee la pregunta DOS veces."
        }
      ]
    },
    option_a: 'unos 5,25 kg/mes',
    option_b: '6,00 kg/mes',
    option_c: 'aproximadamente 7,5 kg/mes',
    option_d: '5,5 kg/mes',
    correct_option: 0, // A = unos 5,25 kg/mes (35% de 15)
    explanation: "El consumo de frutas en 2019 fue de 15 kg/mes. Un incremento del 35% significa: 35% de 15 = 0.35 × 15 = 5.25 kg/mes. La pregunta pide el incremento, no el total.",
    difficulty: 'medium',
    time_limit_seconds: 120, // 2 minutos
    cognitive_skills: ['mathematical_reasoning', 'percentage_calculation', 'chart_reading'],
    question_subtype: 'bar_chart',
    is_active: true,
    is_verified: true
  }

  try {
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de consumo de frutas añadida exitosamente:')
    console.log(`   📝 ID: ${data[0]?.id}`)
    console.log(`   🏷️ Tipo: ${data[0]?.question_subtype}`)
    console.log(`   ❓ Pregunta: ${data[0]?.question_text}`)
    console.log(`   ✅ Respuesta correcta: unos 5,25 kg/mes (35% de 15 kg/mes)`)

    // Verificar que se insertó correctamente
    const { data: verification, error: verifyError } = await supabase
      .from('psychometric_questions')
      .select('*')
      .eq('id', data[0].id)
      .single()

    if (verifyError) {
      console.error('❌ Error verificando pregunta:', verifyError)
      return
    }

    console.log('\n🔍 Verificación exitosa - la pregunta está en la base de datos')
    console.log('🎯 La pregunta aparecerá en los tests de Capacidad Administrativa > Gráficos')
    console.log('♻️  Reutiliza el componente BarChartQuestion existente - no se necesitan cambios')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

// Ejecutar
addFruitsConsumptionQuestion()