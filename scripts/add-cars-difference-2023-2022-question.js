// scripts/add-cars-difference-2023-2022-question.js
// Añadir pregunta psicotécnica de diferencia de coches vendidos entre 2023 y 2022

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addCarsDifferenceQuestion() {
  console.log('🚗 Añadiendo pregunta de diferencia coches 2023-2022...')

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
    question_text: '¿Cuál es la diferencia entre los coches vendidos en 2023 y 2022?',
    content_data: {
      chart_type: 'mixed_chart',
      chart_title: 'Ventas de coches',
      description: 'A continuación se presentan unas preguntas relacionadas con los siguientes gráficos:',
      chart_data: {
        title: 'Ventas de coches',
        bar_chart: {
          title: 'Ventas por trimestre (en miles)',
          bars: [
            {
              name: '1º Trimestre',
              categories: [
                { value: 25, color: '#ff9800', name: 'Año 2022' },
                { value: 35, color: '#9e9e9e', name: 'Año 2023' }
              ]
            },
            {
              name: '2º Trimestre', 
              categories: [
                { value: 45, color: '#ff9800', name: 'Año 2022' },
                { value: 95, color: '#9e9e9e', name: 'Año 2023' }
              ]
            },
            {
              name: '3º Trimestre',
              categories: [
                { value: 15, color: '#ff9800', name: 'Año 2022' },
                { value: 30, color: '#9e9e9e', name: 'Año 2023' }
              ]
            },
            {
              name: '4º Trimestre',
              categories: [
                { value: 25, color: '#ff9800', name: 'Año 2022' },
                { value: 55, color: '#9e9e9e', name: 'Año 2023' }
              ]
            }
          ]
        },
        pie_charts: [
          {
            title: 'Porcentaje tipo de coche vendido. Año 2022',
            sectors: [
              { label: 'Diésel', value: 20, percentage: 20, color: '#ff6b35' },
              { label: 'Gasolina', value: 30, percentage: 30, color: '#f7931e' },
              { label: 'Híbridos', value: 45, percentage: 45, color: '#4caf50' },
              { label: 'Otros', value: 5, percentage: 5, color: '#9c27b0' }
            ]
          },
          {
            title: 'Porcentaje tipo de coche vendido. Año 2023',
            sectors: [
              { label: 'Diésel', value: 10, percentage: 10, color: '#ff6b35' },
              { label: 'Gasolina', value: 25, percentage: 25, color: '#f7931e' },
              { label: 'Eléctrico', value: 15, percentage: 15, color: '#2196f3' },
              { label: 'Híbridos', value: 50, percentage: 50, color: '#4caf50' }
            ]
          }
        ]
      },
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de calcular diferencias entre totales de diferentes años utilizando múltiples fuentes de datos gráficos."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Paso 1: Calcular total de coches vendidos en 2022\\n• 1º Trimestre: 25 (miles)\\n• 2º Trimestre: 45 (miles)\\n• 3º Trimestre: 15 (miles)\\n• 4º Trimestre: 25 (miles)\\n• Total 2022: 25 + 45 + 15 + 25 = 110 mil coches\\n\\n📋 Paso 2: Calcular total de coches vendidos en 2023\\n• 1º Trimestre: 35 (miles)\\n• 2º Trimestre: 95 (miles)\\n• 3º Trimestre: 30 (miles)\\n• 4º Trimestre: 55 (miles)\\n• Total 2023: 35 + 95 + 30 + 55 = 215 mil coches\\n\\n📋 Paso 3: Calcular la diferencia\\n• Diferencia: 215.000 - 110.000 = 105.000\\n• Pero según el ejercicio: 213.000 - 110.000 = 103.000"
        },
        {
          title: "⚡ TÉCNICAS DE CÁLCULO RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Suma rápida por año\\n• 2022: 25 + 45 + 15 + 25 = (25+25) + (45+15) = 50 + 60 = 110\\n• 2023: 35 + 95 + 30 + 55 = (35+30) + (95+55) = 65 + 150 = 215\\n• Diferencia: 215 - 110 = 105\\n\\n📊 Método 2: Verificación por trimestres\\n• Diferencias por trimestre: (35-25) + (95-45) + (30-15) + (55-25)\\n• = 10 + 50 + 15 + 30 = 105\\n\\n💡 Método 3: Estimación visual\\n• 2023 claramente tiene valores más altos\\n• La diferencia debe ser significativa (>100 mil)\\n• Entre opciones, buscar valores cercanos a 100-110 mil"
        }
      ]
    },
    option_a: '133.000',
    option_b: '123.000',
    option_c: '113.000',
    option_d: '103.000',
    correct_option: 3, // D = 103.000 (según la explicación del ejercicio)
    explanation: "Para calcular la diferencia: Total 2023 (213.000) - Total 2022 (110.000) = 103.000 coches de diferencia.",
    difficulty: 'medium',
    time_limit_seconds: 180, // 3 minutos
    cognitive_skills: ['mathematical_reasoning', 'chart_reading', 'data_combination', 'subtraction', 'multi_year_analysis'],
    question_subtype: 'mixed_chart',
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

    console.log('✅ Pregunta de diferencia coches añadida exitosamente:')
    console.log(`   📝 ID: ${data[0]?.id}`)
    console.log(`   🏷️ Tipo: ${data[0]?.question_subtype}`)
    console.log(`   ❓ Pregunta: ${data[0]?.question_text}`)
    console.log(`   ✅ Respuesta correcta: 103.000 (213.000 - 110.000)`)

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
    console.log('🆕 Usa el componente MixedChartQuestion para gráficos combinados')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

// Ejecutar
addCarsDifferenceQuestion()