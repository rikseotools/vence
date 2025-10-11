// scripts/create-question-template.js
// Template genérico para crear cualquier tipo de pregunta psicotécnica
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createQuestion(questionConfig) {
  try {
    console.log(`🔍 Creating ${questionConfig.type} question...`)

    // 1. Obtener category_id
    const { data: categories, error: catError } = await supabase
      .from('psychometric_categories')
      .select('id')
      .eq('category_key', questionConfig.category_key)
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
      .eq('section_key', questionConfig.section_key)
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
      question_text: questionConfig.question_text,
      question_subtype: questionConfig.question_subtype,
      content_data: questionConfig.content_data,
      option_a: questionConfig.option_a,
      option_b: questionConfig.option_b,
      option_c: questionConfig.option_c,
      option_d: questionConfig.option_d,
      correct_option: questionConfig.correct_option,
      explanation: questionConfig.explanation || null,
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
    console.log('   - Text:', questionConfig.question_text)
    console.log('   - Correct answer:', questionConfig[`option_${['a','b','c','d'][questionConfig.correct_option]}`])
    console.log('   - Type:', questionConfig.question_subtype)
    console.log('   - Category:', questionConfig.category_key, '>', questionConfig.section_key)

    console.log('\n🔗 PREVIEW LINKS:')
    console.log(`   📋 Question Preview: http://localhost:3000/debug/question/${insertedQuestion[0].id}`)
    console.log(`   🔍 API Endpoint: http://localhost:3000/api/debug/question/${insertedQuestion[0].id}`)
    console.log(`   🏠 Test Route: http://localhost:3000/psicotecnicos/${questionConfig.category_key}/${questionConfig.section_key}`)

    return insertedQuestion[0]

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return null
  }
}

// Función de ejemplo para usar el template
async function createExampleQuestion() {
  const questionConfig = {
    type: 'bar_chart',
    category_key: 'capacidad-administrativa',
    section_key: 'graficos',
    question_text: '¿Cuál sería la diferencia por persona entre el total de frutas y verduras consumida?',
    question_subtype: 'bar_chart',
    content_data: {
      chart_type: 'bar_chart',
      chart_title: 'Consumo de alimentos frescos por persona expresado en Kg/mes',
      // ... más datos específicos
    },
    option_a: '5 kg/mes',
    option_b: '15 kg/mes',
    option_c: '10 kg/mes', 
    option_d: '20 kg/mes',
    correct_option: 1, // B
    explanation: null
  }

  return await createQuestion(questionConfig)
}

// Exportar funciones para uso en otros scripts
export { createQuestion, createExampleQuestion }

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  createExampleQuestion()
}