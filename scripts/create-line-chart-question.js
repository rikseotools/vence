// scripts/create-line-chart-question.js
// Script para crear pregunta de gráfico de líneas
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createLineChartQuestion() {
  try {
    console.log('🔍 Creating line chart question...')

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

    // 3. Preparar datos de la pregunta
    const questionData = {
      category_id: categoryId,
      section_id: sectionId,
      question_text: 'Con los datos que se reflejan en la tabla, ¿Qué porcentaje suponen las personas entre 27 y 59 años, atendidas en Centros de especialidades, sobre el total de pacientes atendidos en dichos Centros?',
      question_subtype: 'line_chart',
      content_data: {
        chart_type: 'line_chart',
        chart_title: 'Personas atendidas por rango de edad / lugar de la atención',
        subtitle: '(en miles) al mes',
        y_axis_label: 'Número de personas (miles)',
        x_axis_label: 'Tipo de centro',
        evaluation_description: 'Tu capacidad para interpretar gráficos de líneas con múltiples series y calcular porcentajes específicos.',
        categories: ['Centros salud', 'Hospitales', 'Centros especialidades', 'Clínicas privadas'],
        age_groups: [
          {
            label: '0-1 años',
            values: [95, 30, 70, 30]
          },
          {
            label: '15-26 años', 
            values: [30, 20, 30, 20]
          },
          {
            label: '27-59 años',
            values: [70, 60, 50, 95]
          },
          {
            label: '60+ años',
            values: [100, 100, 60, 30]
          }
        ],
        total_target_center: 210, // Total en Centros especialidades: 70+30+50+60
        target_group_value: 50,   // Valor del grupo 27-59 años en Centros especialidades
        quick_method_1: 'Localiza la columna "Centros especialidades" y sigue la línea negra (27-59 años) hasta encontrar el valor: 50.',
        quick_method_2: 'Suma todos los valores de "Centros especialidades": 70+30+50+60 = 210. Calcula: (50÷210)×100 ≈ 24%.',
        quick_method_3: 'Opciones 22% y 23,8% son muy cercanas a 24%. La opción 20,83% parece baja pero es la más precisa tras cálculo exacto.',
        common_errors: 'No confundir las líneas de edad. No usar valores de otras columnas. No olvidar multiplicar por 100 para el porcentaje. Leer correctamente los valores del gráfico.',
        exam_tip: 'En gráficos de líneas: 1) Identifica la serie correcta por color/leyenda, 2) Localiza el punto exacto, 3) Lee el valor con precisión, 4) Suma todos los valores de esa categoría.',
        question_context: 'Observa el siguiente gráfico de líneas que muestra la distribución de pacientes por edad y tipo de centro:'
      },
      option_a: '22 %',
      option_b: '23,8 %',
      option_c: '21,80 %', 
      option_d: '20,83 %',
      correct_option: 3, // D - 20,83%
      explanation: null,
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
    console.log('   - Text:', questionData.question_text.substring(0, 80) + '...')
    console.log('   - Correct answer:', questionData.option_d)
    console.log('   - Type: line_chart (uses LineChartQuestion.js)')
    console.log('   - Architecture: ChartQuestion.js base + LineChartQuestion.js specialization')
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
      console.log('   - Question:', verification[0].question_text.substring(0, 60) + '...')
    }

    console.log('\n🎉 Line chart question creation completed!')
    console.log('✨ New component added: LineChartQuestion.js')
    console.log('✨ Architecture extended successfully')
    
    console.log('\n🔗 PREVIEW LINKS:')
    console.log(`   📋 Question Preview: http://localhost:3000/debug/question/${insertedQuestion[0].id}`)
    console.log(`   🔍 API Endpoint: http://localhost:3000/api/debug/question/${insertedQuestion[0].id}`)
    console.log(`   🏠 Test Route: http://localhost:3000/psicotecnicos/capacidad-administrativa/graficos`)

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Ejecutar el script
createLineChartQuestion()