// scripts/create-bar-chart-question-v2.js
// Script para crear pregunta de gráfico de barras usando nueva arquitectura
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createBarChartQuestionV2() {
  try {
    console.log('🔍 Creating bar chart question with new architecture...')

    // 1. Obtener category_id
    const { data: categories, error: catError } = await supabase
      .from('psychometric_categories')
      .select('id')
      .eq('category_key', 'capacidad-administrativa')
      .single()

    if (catError || !categories) {
      console.error('❌ Error getting category:', catError)
      return
    }

    const categoryId = categories.id
    console.log('✅ Found category ID:', categoryId)

    // 2. Obtener section_id
    const { data: sections, error: sectError } = await supabase
      .from('psychometric_sections')
      .select('id')
      .eq('section_key', 'graficos')
      .eq('category_id', categoryId)
      .single()

    if (sectError || !sections) {
      console.error('❌ Error getting section:', sectError)
      return
    }

    const sectionId = sections.id
    console.log('✅ Found section ID:', sectionId)

    // 3. Preparar datos de la pregunta con nueva estructura
    const questionData = {
      category_id: categoryId,
      section_id: sectionId,
      question_text: '¿Cuál sería la diferencia por persona entre el total de frutas y verduras consumida?',
      question_subtype: 'bar_chart', // Usa BarChartQuestion.js
      content_data: {
        chart_type: 'bar_chart',
        chart_title: 'Consumo de alimentos frescos por persona expresado en Kg/mes',
        y_axis_label: 'Kg/mes',
        x_axis_label: 'Años',
        evaluation_description: 'Tu capacidad para interpretar gráficos de barras y calcular diferencias entre categorías sin calculadora.',
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
        quick_method_1: 'En TODOS los años, Verduras SIEMPRE ≥ Frutas. Busca el patrón visual antes de calcular.',
        quick_method_2: 'Calcula diferencias año por año: 2019(+5) + 2020(0) + 2021(+5) + 2022(+5) = 15',
        quick_method_3: 'Opciones 5 y 10 muy bajas, 20 muy alta. Solo 15 es coherente con patrón observado.',
        common_errors: 'No sumes totales largos: usa diferencias año por año. No ignores años con diferencia 0. Lee valores correctos del gráfico.',
        exam_tip: 'Lee primero los valores del gráfico, identifica el patrón visual, calcula diferencias simples año por año, y verifica con descarte de opciones.',
        question_context: 'Observa el siguiente gráfico de barras que muestra el consumo de alimentos frescos por persona durante varios años:'
      },
      option_a: '5 kg/mes',
      option_b: '15 kg/mes',
      option_c: '10 kg/mes', 
      option_d: '20 kg/mes',
      correct_option: 1, // B - 15 kg/mes
      explanation: null, // La explicación se maneja en el componente
      is_active: true
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
    console.log('   - Type: bar_chart (uses BarChartQuestion.js)')
    console.log('   - Architecture: ChartQuestion.js base + BarChartQuestion.js specialization')
    console.log('   - Category: capacidad-administrativa > graficos')

    // 5. Verificar la inserción
    const { data: verification } = await supabase
      .from('psychometric_questions')
      .select(`
        id,
        question_text,
        question_subtype,
        psychometric_sections!inner(section_key),
        psychometric_categories!inner(category_key)
      `)
      .eq('id', insertedQuestion[0].id)

    if (verification && verification.length > 0) {
      console.log('🔍 Verification successful:')
      console.log('   - Category:', verification[0].psychometric_categories.category_key)
      console.log('   - Section:', verification[0].psychometric_sections.section_key)
      console.log('   - Subtype:', verification[0].question_subtype)
      console.log('   - Question:', verification[0].question_text)
    }

    console.log('\n🎉 Bar chart question creation completed with new architecture!')
    console.log('✨ Benefits:')
    console.log('   - Universal ChartQuestion.js base (shared functionality)')
    console.log('   - Specialized BarChartQuestion.js (specific rendering)')
    console.log('   - Rich explanation format (visual + techniques)')
    console.log('   - Scalable for thousands of questions')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Ejecutar el script
createBarChartQuestionV2()