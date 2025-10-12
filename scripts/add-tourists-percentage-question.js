// scripts/add-tourists-percentage-question.js
// Añadir pregunta psicotécnica de turistas - porcentaje Andalucía e Islas Baleares

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addTouristsPercentageQuestion() {
  console.log('🏖️ Añadiendo pregunta de porcentaje de turistas...')

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
    question_text: '¿Qué porcentaje de turistas hay entre Andalucía e Islas Baleares?',
    content_data: {
      chart_type: 'mixed_chart',
      chart_title: 'Número de turistas',
      description: 'Observa los siguientes gráficos sobre el número de turistas por comunidades autónomas:',
      chart_data: {
        title: 'Número de turistas',
        bar_chart: {
          title: 'Número de turistas',
          bars: [
            {
              name: 'Andalucía',
              categories: [
                { value: 6500000, color: '#5f9ea0', name: 'Turistas' }
              ]
            },
            {
              name: 'Islas Canarias', 
              categories: [
                { value: 6000000, color: '#5f9ea0', name: 'Turistas' }
              ]
            },
            {
              name: 'Cataluña',
              categories: [
                { value: 7500000, color: '#5f9ea0', name: 'Turistas' }
              ]
            },
            {
              name: 'Islas Baleares',
              categories: [
                { value: 3500000, color: '#5f9ea0', name: 'Turistas' }
              ]
            },
            {
              name: 'Resto comunidades',
              categories: [
                { value: 7500000, color: '#5f9ea0', name: 'Turistas' }
              ]
            }
          ]
        },
        pie_charts: [
          {
            title: 'Porcentaje recepción de turistas',
            sectors: [
              { label: 'Andalucía', value: 18.8, percentage: 18.8, color: '#5f9ea0' },
              { label: 'Cataluña', value: 24.2, percentage: 24.2, color: '#ff6b35' },
              { label: 'Islas Canarias', value: 19.4, percentage: 19.4, color: '#2e8b57' },
              { label: 'Islas Baleares', value: 12.5, percentage: 12.5, color: '#4169e1' },
              { label: 'Resto de comunidades', value: 25.1, percentage: 25.1, color: '#483d8b' }
            ]
          }
        ]
      },
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de interpretar gráficos mixtos (barras + circular) y realizar operaciones de suma con porcentajes."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Paso 1: Identificar los datos en el gráfico circular\\n• Buscar 'Andalucía' en el gráfico de porcentajes\\n• Porcentaje de Andalucía: 18,8%\\n• Buscar 'Islas Baleares' en el gráfico de porcentajes\\n• Porcentaje de Islas Baleares: 12,5%\\n\\n📋 Paso 2: Sumar ambos porcentajes\\n• Andalucía + Islas Baleares\\n• 18,8% + 12,5% = 31,3%\\n\\n📋 Paso 3: Verificar la respuesta\\n• El resultado debe coincidir con una de las opciones\\n• 31,3% es la respuesta correcta"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Lectura directa del gráfico circular\\n• Localizar visualmente las dos comunidades\\n• Leer los porcentajes exactos mostrados\\n• Sumar mentalmente: ~19% + ~12% = ~31%\\n\\n📊 Método 2: Verificación por estimación\\n• Andalucía ocupa aproximadamente 1/5 del círculo (≈20%)\\n• Islas Baleares ocupa aproximadamente 1/8 del círculo (≈12%)\\n• Suma estimada: 20% + 12% = 32% (muy cerca de 31,3%)\\n\\n💡 Método 3: Descarte de opciones\\n• Andalucía e Islas Baleares juntas deben ser menos del 50%\\n• Solo las opciones cercanas a 30% son viables\\n• 31,3% es la única que encaja perfectamente"
        }
      ]
    },
    option_a: '31,6',
    option_b: '32',
    option_c: '39',
    option_d: '31,3',
    correct_option: 3, // D = 31,3% (18,8% + 12,5%)
    explanation: "Para obtener el porcentaje conjunto, sumamos los porcentajes individuales del gráfico circular: Andalucía (18,8%) + Islas Baleares (12,5%) = 31,3%.",
    difficulty: 'medium',
    time_limit_seconds: 120, // 2 minutos
    cognitive_skills: ['mathematical_reasoning', 'chart_reading', 'percentage_calculation', 'data_extraction'],
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

    console.log('✅ Pregunta de turistas añadida exitosamente:')
    console.log(`   📝 ID: ${data[0]?.id}`)
    console.log(`   🏷️ Tipo: ${data[0]?.question_subtype}`)
    console.log(`   ❓ Pregunta: ${data[0]?.question_text}`)
    console.log(`   ✅ Respuesta correcta: 31,3% (18,8% + 12,5%)`)

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
addTouristsPercentageQuestion()