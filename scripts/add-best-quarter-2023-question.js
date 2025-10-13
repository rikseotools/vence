// scripts/add-best-quarter-2023-question.js
// Añadir pregunta psicotécnica sobre el trimestre con más ventas en 2023

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addBestQuarter2023Question() {
  console.log('📊 Añadiendo pregunta de mejor trimestre 2023...')

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
    question_text: '¿Cuál es el trimestre que más ventas ha tenido en el año 2023?',
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
                { value: 89, color: '#9e9e9e', name: 'Año 2023' }
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
          content: "Capacidad de comparar valores dentro de un mismo período (año 2023) e identificar el trimestre con mayor rendimiento."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Paso 1: Identificar ventas por trimestre en 2023 (barras grises)\n• 1º Trimestre 2023: 89 mil coches\n• 2º Trimestre 2023: 95 mil coches\n• 3º Trimestre 2023: 30 mil coches\n• 4º Trimestre 2023: 55 mil coches\n\n📋 Paso 2: Comparar los valores\n• Mayor valor: 95 mil coches\n• Trimestre correspondiente: 2º Trimestre\n\n📋 Paso 3: Verificar la respuesta\n• El 2º Trimestre tiene 95 mil coches\n• Es claramente superior a los demás trimestres\n• Diferencia significativa: 95 - 89 = 6 mil coches más que el siguiente mejor"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Comparación visual directa\n• Buscar la barra gris más alta en el gráfico\n• La barra del 2º Trimestre sobresale claramente\n• Valor aproximado de 95 mil coches\n\n📊 Método 2: Comparación sistemática\n• Recorrer de izquierda a derecha las barras grises\n• 1º: 89, 2º: 95, 3º: 30, 4º: 55\n• El 2º Trimestre es el máximo\n\n💡 Método 3: Descarte por inspección\n• 3º Trimestre claramente bajo (30)\n• 4º Trimestre moderado (55)\n• Competencia entre 1º (89) y 2º (95)\n• 2º Trimestre gana por diferencia visible\n\n🚨 Método 4: Verificación de opciones\n• A) 3º: 30 mil (muy bajo)\n• B) 4º: 55 mil (moderado)\n• C) 2º: 95 mil (el más alto) ✅\n• D) 1º: 89 mil (segundo más alto)"
        }
      ]
    },
    option_a: 'En el tercer trimestre.',
    option_b: 'En el cuarto trimestre.',
    option_c: 'En el segundo trimestre.',
    option_d: 'En el primer trimestre.',
    correct_option: 2, // C = En el segundo trimestre (95 mil coches)
    explanation: "Analizando las barras grises de 2023: 1º trimestre (89 mil), 2º trimestre (95 mil), 3º trimestre (30 mil), 4º trimestre (55 mil). El segundo trimestre tuvo las mayores ventas con 95.000 coches.",
    difficulty: 'easy',
    time_limit_seconds: 120, // 2 minutos
    cognitive_skills: ['chart_reading', 'data_comparison', 'maximum_identification', 'visual_analysis', 'pattern_recognition'],
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

    console.log('✅ Pregunta de mejor trimestre 2023 añadida exitosamente:')
    console.log(`   📝 ID: ${data[0]?.id}`)
    console.log(`   🏷️ Tipo: ${data[0]?.question_subtype}`)
    console.log(`   ❓ Pregunta: ${data[0]?.question_text}`)
    console.log(`   ✅ Respuesta correcta: En el segundo trimestre (95 mil coches)`)

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
addBestQuarter2023Question()