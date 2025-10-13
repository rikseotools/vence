// scripts/add-kiwi-consumption-question.js
// Añadir pregunta psicotécnica sobre consumo de kiwis basado en porcentajes

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addKiwiConsumptionQuestion() {
  console.log('🥝 Añadiendo pregunta de consumo de kiwis...')

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
    question_text: 'Dentro del total del consumo de fruta fresca al mes, se ha comprobado que el 5% son naranjas, 15% son mandarinas, 20% son manzanas y el 20% son plátanos y el resto se distribuye a partes iguales entre kiwis y fresas. Según estos datos, ¿Qué cantidad de kg/mes habría habido de consumo de kiwis en el año 2020?',
    content_data: {
      chart_type: 'bar_chart',
      chart_title: 'Consumo de alimentos frescos por persona expresado en Kg/mes',
      description: 'Observa el siguiente gráfico de barras que muestra el consumo de diferentes alimentos por año:',
      chart_data: {
        title: 'Consumo de alimentos frescos por persona expresado en Kg/mes',
        categories: ['Año 2019', 'Año 2020', 'Año 2021', 'Año 2022'],
        series: [
          {
            name: 'Fruta',
            data: [15, 20, 10, 5],
            color: '#e91e63'
          },
          {
            name: 'Pescado', 
            data: [10, 10, 5, 5],
            color: '#424242'
          },
          {
            name: 'Verdura',
            data: [20, 20, 15, 10],
            color: '#ff9800'
          }
        ]
      },
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de combinar información gráfica con cálculos de porcentajes y distribuciones proporcionales."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Paso 1: Identificar el consumo total de fruta en 2020\\n• Observar la barra rosa del año 2020\\n• Consumo total de fruta: 20 kg/mes\\n\\n📋 Paso 2: Calcular el porcentaje de kiwis\\n• Frutas conocidas: naranjas (5%) + mandarinas (15%) + manzanas (20%) + plátanos (20%) = 60%\\n• Resto: 100% - 60% = 40%\\n• Este 40% se reparte a partes iguales entre kiwis y fresas\\n• Porcentaje de kiwis: 40% ÷ 2 = 20%\\n\\n📋 Paso 3: Calcular la cantidad de kiwis\\n• Kiwis = 20% del consumo total de fruta\\n• Kiwis = 20% × 20 kg/mes = 4 kg/mes"
        },
        {
          title: "⚡ TÉCNICAS DE CÁLCULO RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Suma de porcentajes conocidos\\n• 5% + 15% + 20% + 20% = 60%\\n• Resto: 100% - 60% = 40%\\n• Kiwis: 40% ÷ 2 = 20%\\n\\n📊 Método 2: Cálculo directo\\n• 20% de 20 kg = 0.20 × 20 = 4 kg\\n• Verificación: 20% es 1/5, y 20÷5 = 4\\n\\n💡 Método 3: Estimación rápida\\n• Si total es 20 kg y kiwis son ~20%\\n• 20% de 20 ≈ 4 kg\\n• Entre las opciones, 4 kg/mes es la única lógica\\n\\n🚨 Método 4: Verificación por descarte\\n• 8 kg sería 40% (demasiado alto)\\n• 2 kg sería 10% (demasiado bajo)\\n• 5 kg sería 25% (no cuadra con 20%)\\n• 4 kg es exactamente 20% ✅"
        }
      ]
    },
    option_a: '2 kg/mes',
    option_b: '8 kg/mes',
    option_c: '5 kg/mes',
    option_d: '4 kg/mes',
    correct_option: 3, // D = 4 kg/mes (20% de 20 kg)
    explanation: "Primero calculamos el porcentaje de kiwis: 100% - (5% + 15% + 20% + 20%) = 40%, que se reparte entre kiwis y fresas = 20% cada uno. Luego: 20% de 20 kg/mes = 4 kg/mes de kiwis.",
    difficulty: 'medium',
    time_limit_seconds: 200, // 3.5 minutos
    cognitive_skills: ['mathematical_reasoning', 'chart_reading', 'percentage_calculation', 'data_extraction', 'proportional_distribution'],
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

    console.log('✅ Pregunta de consumo de kiwis añadida exitosamente:')
    console.log(`   📝 ID: ${data[0]?.id}`)
    console.log(`   🏷️ Tipo: ${data[0]?.question_subtype}`)
    console.log(`   ❓ Pregunta: ${data[0]?.question_text.substring(0, 100)}...`)
    console.log(`   ✅ Respuesta correcta: 4 kg/mes (20% de 20 kg)`)

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
    console.log('🆕 Usa el componente BarChartQuestion para gráficos de barras')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

// Ejecutar
addKiwiConsumptionQuestion()