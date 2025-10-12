// scripts/add-fish-consumption-question.js
// Añadir pregunta psicotécnica de gráfico de barras - incremento consumo de pescado

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addFishConsumptionQuestion() {
  console.log('🐟 Añadiendo pregunta de incremento de pescado...')

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
    question_text: 'Si se espera un incremento en el consumo de pescado fresco para el año 2023 del 22% sobre el año anterior, ¿Qué cantidad de consumo se espera de pescado fresco para dicho año?',
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
          content: "Capacidad de calcular el total final después de aplicar un porcentaje de incremento sobre un valor específico extraído de un gráfico de barras."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Identificación de datos clave:\n✅ Año base para el incremento: 2022 (\"año anterior\" a 2023)\n✅ Consumo de pescado en 2022: 5 kg/mes\n✅ Incremento propuesto: 22% sobre 2022\n\n📋 Cálculo del total esperado para 2023:\n• Base (2022): 5 kg/mes\n• Incremento: 22% de 5 = 0.22 × 5 = 1.1 kg/mes\n• Total 2023: 5 + 1.1 = 6.1 kg/mes"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Cálculo mental del 22%\n• 20% de 5 = 1.0 kg/mes\n• 2% de 5 = 0.1 kg/mes\n• 22% = 1.0 + 0.1 = 1.1 kg/mes\n• Total: 5 + 1.1 = 6.1 kg/mes\n\n📊 Método 2: Factor multiplicativo\n• Incremento del 22% = multiplicar por 1.22\n• 5 × 1.22 = 6.1 kg/mes\n\n💰 Método 3: Descarte de opciones\n• Opción A: 1,1 → ❌ Es solo el incremento, no el total\n• Opción B: 7,1 → ❌ Sería incremento del 42%\n• Opción C: 5,1 → ❌ Sería incremento del 2%\n• Opción D: 6,1 → ✅ CORRECTO (5 + 22% de 5)"
        },
        {
          title: "❌ Errores comunes a evitar",
          content: "• Confundir incremento con total: responder 1.1 en lugar de 6.1\n• Usar año incorrecto: aplicar 22% sobre 2019, 2020 o 2021\n• Leer categoría incorrecta: usar datos de frutas o verduras\n• Error en porcentajes: calcular 20% o 25% en lugar de 22%"
        },
        {
          title: "💪 Consejo de oposición",
          content: "En problemas de incremento porcentual: 1) Identifica el año base ('año anterior'), 2) Localiza el valor exacto en el gráfico, 3) Calcula incremento, 4) SUMA al valor original. La pregunta pide el TOTAL esperado."
        }
      ]
    },
    option_a: '1,1 kg/mes',
    option_b: '7,1 kg/mes',
    option_c: '5,1 kg/mes',
    option_d: '6,1 kg/mes',
    correct_option: 3, // D = 6,1 kg/mes (5 + 22% de 5)
    explanation: "El consumo de pescado en 2022 fue de 5 kg/mes. Un incremento del 22% significa: 22% de 5 = 1.1 kg/mes. El total esperado para 2023 es: 5 + 1.1 = 6.1 kg/mes.",
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

    console.log('✅ Pregunta de incremento de pescado añadida exitosamente:')
    console.log(`   📝 ID: ${data[0]?.id}`)
    console.log(`   🏷️ Tipo: ${data[0]?.question_subtype}`)
    console.log(`   ❓ Pregunta: ${data[0]?.question_text}`)
    console.log(`   ✅ Respuesta correcta: 6,1 kg/mes (5 + 22% de 5)`)

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
addFishConsumptionQuestion()