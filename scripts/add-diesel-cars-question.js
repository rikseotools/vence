// scripts/add-diesel-cars-question.js
// Añadir pregunta psicotécnica de gráfico mixto - coches diésel total ambos años

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addDieselCarsQuestion() {
  console.log('🚗 Añadiendo pregunta de coches diésel con gráfico mixto...')

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
    question_text: '¿Cuántos coches diésel se vendieron en total en ambos años?',
    content_data: {
      chart_type: 'mixed_chart',
      chart_title: 'Ventas de coches',
      description: 'A continuación se presentan unas preguntas relacionadas con el siguiente gráfico',
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
          content: "Capacidad de combinar información de múltiples años y tipos de gráficos, requiriendo cálculos separados por período y suma final."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Paso 1: Calcular total de coches por año\\n• 2022: 25 + 45 + 15 + 25 = 110 (en miles = 110,000)\\n• 2023: 35 + 95 + 30 + 55 = 215 (en miles = 215,000)\\n\\n📋 Paso 2: Obtener porcentajes de diésel\\n• 2022: 20% de diésel\\n• 2023: 10% de diésel\\n\\n📋 Paso 3: Calcular diésel por año\\n• 2022: 20% de 110,000 = 22,000\\n• 2023: 10% de 215,000 = 21,500\\n\\n📋 Paso 4: Sumar ambos años\\n• Total: 22,000 + 21,500 = 43,500"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Estimación rápida\\n• 2022: ~100 × 20% = ~20,000\\n• 2023: ~200 × 10% = ~20,000\\n• Total estimado: ~40,000-45,000\\n\\n📊 Método 2: Cálculo mental optimizado\\n• 20% de 110 = 22 (en miles)\\n• 10% de 215 = 21.5 (en miles)\\n• Suma: 22 + 21.5 = 43.5 (en miles)\\n\\n💰 Método 3: Verificación por descarte\\n• El resultado debe estar entre 40,000-50,000\\n• Solo 43,500 encaja perfectamente"
        },
        {
          title: "❌ Errores comunes a evitar",
          content: "• Usar solo un año: calcular solo 2022 o solo 2023\\n• Confundir porcentajes: tomar porcentaje de año incorrecto\\n• No sumar trimestres: usar solo un trimestre por año\\n• Olvidar las unidades: no considerar que están en miles\\n• Mezclar datos: usar porcentaje de un año con total de otro"
        },
        {
          title: "💪 Consejo de oposición",
          content: "En preguntas de múltiples años: 1) Calcula totales por separado, 2) Aplica porcentajes específicos de cada año, 3) Suma resultados finales, 4) Verifica que el orden de magnitud sea lógico."
        }
      ]
    },
    option_a: '45,000',
    option_b: '87,000',
    option_c: '43,500',
    option_d: '97,000',
    correct_option: 2, // C = 43,500 (22,000 + 21,500)
    explanation: "Año 2022: Total 110,000 × 20% diésel = 22,000. Año 2023: Total 215,000 × 10% diésel = 21,500. Total ambos años: 22,000 + 21,500 = 43,500 coches diésel.",
    difficulty: 'hard',
    time_limit_seconds: 240, // 4 minutos
    cognitive_skills: ['mathematical_reasoning', 'chart_reading', 'data_combination', 'percentage_calculation', 'multi_year_analysis'],
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

    console.log('✅ Pregunta de coches diésel añadida exitosamente:')
    console.log(`   📝 ID: ${data[0]?.id}`)
    console.log(`   🏷️ Tipo: ${data[0]?.question_subtype}`)
    console.log(`   ❓ Pregunta: ${data[0]?.question_text}`)
    console.log(`   ✅ Respuesta correcta: 43,500 (22,000 + 21,500)`)

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
addDieselCarsQuestion()