// scripts/add-chocolate-total-2022-question.js
// Añadir pregunta psicotécnica de chocolatinas - total año 2022

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addChocolateTotal2022Question() {
  console.log('🍫 Añadiendo pregunta de total chocolatinas 2022...')

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
    question_text: '¿Cuántas chocolatinas se vendieron en el año 2022?',
    content_data: {
      chart_type: 'mixed_chart',
      chart_title: 'Chocolatinas vendidas',
      description: 'Una tienda de barrio se dedica a la venta de golosinas y quiere saber si les compensa o no seguir vendiendo chocolatinas comparando las que se vendieron en el 2022 con las que se vendieron en 2023. Contesta las preguntas relacionadas con el gráfico:',
      chart_data: {
        title: 'CHOCOLATINAS VENDIDAS',
        bar_chart: {
          title: 'Ventas por trimestre',
          bars: [
            {
              name: 'PRIMER TRIMESTRE',
              categories: [
                { value: 24, color: '#ff9800', name: 'Año 2022' },
                { value: 89, color: '#8d6e63', name: 'Año 2023' }
              ]
            },
            {
              name: 'SEGUNDO TRIMESTRE', 
              categories: [
                { value: 36, color: '#ff9800', name: 'Año 2022' },
                { value: 24, color: '#8d6e63', name: 'Año 2023' }
              ]
            },
            {
              name: 'TERCER TRIMESTRE',
              categories: [
                { value: 12, color: '#ff9800', name: 'Año 2022' },
                { value: 37, color: '#8d6e63', name: 'Año 2023' }
              ]
            },
            {
              name: 'CUARTO TRIMESTRE',
              categories: [
                { value: 38, color: '#ff9800', name: 'Año 2022' },
                { value: 63, color: '#8d6e63', name: 'Año 2023' }
              ]
            }
          ]
        },
        data_table: {
          title: 'LEYENDA',
          headers: ['', 'AÑO 2022', 'AÑO 2023'],
          rows: [
            { label: 'PRIMER TRIMESTRE', values: [24, 89] },
            { label: 'SEGUNDO TRIMESTRE', values: [36, 24] },
            { label: 'TERCER TRIMESTRE', values: [12, 37] },
            { label: 'CUARTO TRIMESTRE', values: [38, 63] }
          ]
        }
      },
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de interpretar gráficos de barras y sumar valores específicos de un año determinado."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Paso 1: Identificar las barras del año 2022\\n• Buscar las barras de color naranja claro\\n• Corresponden a todos los trimestres de 2022\\n\\n📋 Paso 2: Leer los valores de cada trimestre 2022\\n• Primer trimestre: 24 chocolatinas\\n• Segundo trimestre: 36 chocolatinas\\n• Tercer trimestre: 12 chocolatinas\\n• Cuarto trimestre: 38 chocolatinas\\n\\n📋 Paso 3: Sumar todos los trimestres\\n• Total 2022: 24 + 36 + 12 + 38 = 110 chocolatinas"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Suma visual rápida\\n• 24 + 36 = 60\\n• 12 + 38 = 50\\n• Total: 60 + 50 = 110\\n\\n📊 Método 2: Verificación por tabla\\n• Usar la leyenda para confirmar valores\\n• Sumar fila por fila del año 2022\\n\\n💡 Método 3: Descarte por estimación\\n• Los valores rondan entre 10-40 por trimestre\\n• Total debe estar entre 80-160\\n• Solo 110 encaja con la suma exacta"
        }
      ]
    },
    option_a: '110',
    option_b: '130',
    option_c: '140',
    option_d: '120',
    correct_option: 0, // A = 110 (24 + 36 + 12 + 38)
    explanation: "Para obtener el total de 2022, sumamos todas las barras naranjas: 24 + 36 + 12 + 38 = 110 chocolatinas.",
    difficulty: 'medium',
    time_limit_seconds: 120, // 2 minutos
    cognitive_skills: ['mathematical_reasoning', 'chart_reading', 'data_extraction', 'addition'],
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

    console.log('✅ Pregunta de chocolatinas 2022 añadida exitosamente:')
    console.log(`   📝 ID: ${data[0]?.id}`)
    console.log(`   🏷️ Tipo: ${data[0]?.question_subtype}`)
    console.log(`   ❓ Pregunta: ${data[0]?.question_text}`)
    console.log(`   ✅ Respuesta correcta: 110 (24 + 36 + 12 + 38)`)

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
addChocolateTotal2022Question()