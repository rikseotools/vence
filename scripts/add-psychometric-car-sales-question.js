// scripts/add-psychometric-car-sales-question.js
// Añadir pregunta psicotécnica de gráfico de barras - coches vendidos por trimestre

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addCarSalesQuestion() {
  console.log('🚗 Añadiendo pregunta de coches vendidos por trimestre...')

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
    question_text: '¿Cuántos coches se vendieron en total?',
    content_data: {
      chart_type: 'bar_chart',
      chart_title: 'COCHES VENDIDOS POR TRIMESTRE EN EL AÑO 2023',
      x_axis_label: 'Trimestres',
      y_axis_label: 'Número de coches',
      chart_data: {
        type: 'bar_chart',
        title: 'COCHES VENDIDOS POR TRIMESTRE EN EL AÑO 2023',
        quarters: [
          {
            name: 'Trimestre 1',
            modelA: 24,
            modelB: 89
          },
          {
            name: 'Trimestre 2', 
            modelA: 36,
            modelB: 24
          },
          {
            name: 'Trimestre 3',
            modelA: 12,
            modelB: 37
          },
          {
            name: 'Trimestre 4',
            modelA: 38,
            modelB: 63
          }
        ],
        legend: {
          modelA: 'Modelo A',
          modelB: 'Modelo B'
        }
      },
      explanation_sections: [
        {
          title: "📊 CAPACIDAD ADMINISTRATIVA: GRÁFICOS",
          content: "En este tipo de pruebas, se nos presenta un gráfico (barras, quesito,...) con datos numéricos y se nos plantean, en la mayoría de los casos cuestiones de índole matemático que hay que resolver con la información que nos aparece en dichos gráficos."
        },
        {
          title: "💡 SOLUCIÓN:",
          content: "El total de ventas del modelo A es de 110 y del modelo B 213 por lo que sumamos 110+213=323\n\nDesglose por trimestres:\n• Trimestre 1: 24 + 89 = 113\n• Trimestre 2: 36 + 24 = 60\n• Trimestre 3: 12 + 37 = 49\n• Trimestre 4: 38 + 63 = 101\n\nTotal: 113 + 60 + 49 + 101 = 323 coches"
        }
      ]
    },
    option_a: '289',
    option_b: '323', 
    option_c: '429',
    option_d: '110',
    correct_option: 1, // B = 323
    explanation: "El total de ventas del modelo A es de 110 y del modelo B 213 por lo que sumamos 110+213=323. Desglose por trimestres: Trimestre 1: 24 + 89 = 113, Trimestre 2: 36 + 24 = 60, Trimestre 3: 12 + 37 = 49, Trimestre 4: 38 + 63 = 101. Total: 113 + 60 + 49 + 101 = 323 coches",
    difficulty: 'medium', // medium, easy, hard
    time_limit_seconds: 120, // 2 minutos
    cognitive_skills: ['mathematical_reasoning', 'data_interpretation', 'chart_reading'],
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

    console.log('✅ Pregunta de coches vendidos añadida exitosamente:')
    console.log(`   📝 ID: ${data[0]?.id}`)
    console.log(`   🏷️ Tipo: ${data[0]?.question_type} - ${data[0]?.question_subtype}`)
    console.log(`   📊 Sección: ${data[0]?.section} > ${data[0]?.subsection}`)
    console.log(`   ❓ Pregunta: ${data[0]?.question_text}`)
    console.log(`   ✅ Respuesta correcta: 323`)

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

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

// Ejecutar
addCarSalesQuestion()