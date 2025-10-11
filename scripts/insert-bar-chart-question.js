// scripts/insert-bar-chart-question.js
// Script para insertar nueva pregunta de gráfico de barras - consumo de alimentos

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function insertBarChartQuestion() {
  try {
    console.log('🔍 Starting insertion of bar chart question...')

    // 1. Buscar la categoría capacidad-administrativa
    const { data: categories } = await supabase
      .from('psychometric_categories')
      .select('id, category_key')
      .eq('category_key', 'capacidad-administrativa')

    if (!categories || categories.length === 0) {
      console.error('❌ Category capacidad-administrativa not found')
      return
    }

    const categoryId = categories[0].id
    console.log('✅ Found category ID:', categoryId)

    // 2. Buscar la sección graficos
    const { data: sections } = await supabase
      .from('psychometric_sections')
      .select('id, section_key')
      .eq('category_id', categoryId)
      .eq('section_key', 'graficos')

    if (!sections || sections.length === 0) {
      console.error('❌ Section graficos not found')
      return
    }

    const sectionId = sections[0].id
    console.log('✅ Found section ID:', sectionId)

    // 3. Preparar datos de la pregunta
    const questionData = {
      category_id: categoryId,
      section_id: sectionId,
      question_text: '¿Cuál sería la diferencia por persona entre el total de frutas y verduras consumida?',
      content_data: {
        chart_type: 'bar_chart',
        chart_data: [
          {
            year: '2019',
            categories: [
              { label: 'Frutas', value: 15, color: '#e91e63' },
              { label: 'Pescado', value: 10, color: '#424242' },
              { label: 'Verdura', value: 20, color: '#ff9800' }
            ]
          },
          {
            year: '2020', 
            categories: [
              { label: 'Frutas', value: 20, color: '#e91e63' },
              { label: 'Pescado', value: 10, color: '#424242' },
              { label: 'Verdura', value: 20, color: '#ff9800' }
            ]
          },
          {
            year: '2021',
            categories: [
              { label: 'Frutas', value: 10, color: '#e91e63' },
              { label: 'Pescado', value: 5, color: '#424242' },
              { label: 'Verdura', value: 15, color: '#ff9800' }
            ]
          },
          {
            year: '2022',
            categories: [
              { label: 'Frutas', value: 5, color: '#e91e63' },
              { label: 'Pescado', value: 5, color: '#424242' },
              { label: 'Verdura', value: 10, color: '#ff9800' }
            ]
          }
        ],
        chart_title: 'Consumo de alimentos frescos por persona expresado en Kg/mes',
        y_axis_label: 'Kg/mes',
        x_axis_label: 'Años',
        calculation_method: 'difference_total',
        question_context: 'Observa el siguiente gráfico de barras que muestra el consumo de alimentos frescos por persona durante varios años:'
      },
      option_a: '5 kg/mes',
      option_b: '15 kg/mes',
      option_c: '10 kg/mes', 
      option_d: '20 kg/mes',
      correct_option: 1, // B - 15 kg/mes
      explanation: 'Para resolver esta pregunta:\n\n1. **Calcular total de frutas**: 2019(15) + 2020(20) + 2021(10) + 2022(5) = 50 kg/mes\n\n2. **Calcular total de verduras**: 2019(20) + 2020(20) + 2021(15) + 2022(10) = 65 kg/mes\n\n3. **Calcular diferencia**: Verduras - Frutas = 65 - 50 = 15 kg/mes\n\n**Técnica sin calculadora:** Observar que las verduras siempre superan a las frutas en cada año. Sumando mentalmente: verduras tienen 15 kg/mes más en total.\n\n**Respuesta correcta: B) 15 kg/mes**',
      is_active: true,
      question_subtype: 'bar_chart'
    }

    // 4. Insertar pregunta
    console.log('📝 Inserting question data...')
    const { data: insertedQuestion, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert(questionData)
      .select()

    if (insertError) {
      console.error('❌ Error inserting question:', insertError)
      return
    }

    console.log('✅ Question inserted successfully!')
    console.log('📋 Question details:')
    console.log('   - ID:', insertedQuestion[0].id)
    console.log('   - Text:', questionData.question_text)
    console.log('   - Correct answer:', questionData.option_b)
    console.log('   - Type: bar_chart')
    console.log('   - Category: capacidad-administrativa > graficos')

    // 5. Verificar la inserción
    const { data: verification } = await supabase
      .from('psychometric_questions')
      .select(`
        id,
        question_text,
        option_b,
        psychometric_sections!inner(section_key),
        psychometric_categories!inner(category_key)
      `)
      .eq('id', insertedQuestion[0].id)

    if (verification && verification.length > 0) {
      console.log('🔍 Verification successful:')
      console.log('   - Category:', verification[0].psychometric_categories.category_key)
      console.log('   - Section:', verification[0].psychometric_sections.section_key)
      console.log('   - Question:', verification[0].question_text)
    }

    console.log('\n🎉 Bar chart question insertion completed!')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Ejecutar el script
insertBarChartQuestion()