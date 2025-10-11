// scripts/list-all-sections.js
// Script para listar todas las secciones y contar preguntas
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function listAllSections() {
  try {
    console.log('📋 Listing all psychometric sections...')

    // 1. Obtener todas las secciones con conteos
    const { data: sections, error: sectionsError } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, section_name')
      .order('section_key')

    if (sectionsError) {
      console.error('❌ Error getting sections:', sectionsError)
      return
    }

    console.log(`\n📊 Found ${sections.length} sections:`)

    for (const section of sections) {
      // Contar preguntas en cada sección
      const { data: questions, error: questionsError } = await supabase
        .from('psychometric_questions')
        .select('id, question_subtype')
        .eq('section_id', section.id)

      const count = questions?.length || 0
      
      console.log(`\n📁 ${section.section_key} (${section.section_name})`)
      console.log(`   ID: ${section.id}`)
      console.log(`   Questions: ${count}`)
      
      if (questions && questions.length > 0) {
        const subtypes = {}
        questions.forEach(q => {
          subtypes[q.question_subtype] = (subtypes[q.question_subtype] || 0) + 1
        })
        console.log(`   Types:`, subtypes)
      }
    }

    // 2. Buscar preguntas que podrían estar mal clasificadas
    console.log('\n🔍 Looking for potential misclassifications...')
    
    const { data: allQuestions, error: allError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, question_subtype, section_id')

    if (allError) {
      console.error('❌ Error getting all questions:', allError)
      return
    }

    const chartQuestions = allQuestions.filter(q => 
      q.question_subtype === 'pie_chart' || 
      q.question_subtype === 'bar_chart' || 
      q.question_subtype === 'line_chart'
    )

    console.log(`\n📊 Found ${chartQuestions.length} chart questions:`)
    chartQuestions.forEach(q => {
      const section = sections.find(s => s.id === q.section_id)
      console.log(`   ${q.question_subtype} in "${section?.section_key}" - ${q.question_text.substring(0, 50)}...`)
      
      if (section?.section_key !== 'graficos') {
        console.log(`     🚨 This should be in graficos!`)
      }
    })

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Ejecutar el script
listAllSections()