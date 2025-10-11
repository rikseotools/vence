// scripts/find-misclassified-questions.js
// Script para encontrar preguntas mal clasificadas
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function findMisclassifiedQuestions() {
  try {
    console.log('🔍 Finding misclassified questions...')

    // 1. Buscar todas las preguntas en "Pruebas de clasificación"
    const { data: clasificacionQuestions, error: clasificacionError } = await supabase
      .from('psychometric_questions')
      .select(`
        id, question_text, question_subtype, created_at,
        psychometric_sections!inner(section_key, section_name),
        psychometric_categories!inner(category_key, category_name)
      `)
      .eq('psychometric_sections.section_key', 'pruebas-clasificacion')
      .order('created_at', { ascending: false })

    if (clasificacionError) {
      console.error('❌ Error getting clasificacion questions:', clasificacionError)
      return
    }

    console.log(`📋 Found ${clasificacionQuestions.length} questions in "Pruebas de clasificación":`)
    clasificacionQuestions.forEach((q, index) => {
      console.log(`\n${index + 1}. ID: ${q.id}`)
      console.log(`   Type: ${q.question_subtype}`)
      console.log(`   Text: ${q.question_text.substring(0, 80)}...`)
      console.log(`   Section: ${q.psychometric_sections.section_name}`)
      console.log(`   Created: ${q.created_at}`)
      
      // Identificar si debería estar en gráficos
      if (q.question_subtype === 'pie_chart' || 
          q.question_subtype === 'bar_chart' || 
          q.question_subtype === 'line_chart' ||
          q.question_text.toLowerCase().includes('gráfico') ||
          q.question_text.toLowerCase().includes('grafico')) {
        console.log(`   🚨 SHOULD BE IN GRÁFICOS: This is a ${q.question_subtype} question!`)
      }
    })

    // 2. Buscar todas las preguntas en "Gráficos" para comparar
    const { data: graficosQuestions, error: graficosError } = await supabase
      .from('psychometric_questions')
      .select(`
        id, question_text, question_subtype, created_at,
        psychometric_sections!inner(section_key, section_name)
      `)
      .eq('psychometric_sections.section_key', 'graficos')
      .order('created_at', { ascending: false })

    if (graficosError) {
      console.error('❌ Error getting graficos questions:', graficosError)
      return
    }

    console.log(`\n📊 Found ${graficosQuestions.length} questions in "Gráficos":`)
    graficosQuestions.forEach((q, index) => {
      console.log(`${index + 1}. ${q.question_subtype} - ${q.question_text.substring(0, 60)}...`)
    })

    // 3. Obtener section_id de graficos para las correcciones
    const { data: graficosSection, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, section_name')
      .eq('section_key', 'graficos')
      .single()

    if (sectionError) {
      console.error('❌ Error getting graficos section:', sectionError)
      return
    }

    console.log(`\n✅ Graficos section ID: ${graficosSection.id}`)

    // 4. Identificar preguntas que necesitan ser movidas
    const questionsToMove = clasificacionQuestions.filter(q => 
      q.question_subtype === 'pie_chart' || 
      q.question_subtype === 'bar_chart' || 
      q.question_subtype === 'line_chart' ||
      q.question_text.toLowerCase().includes('gráfico') ||
      q.question_text.toLowerCase().includes('grafico')
    )

    if (questionsToMove.length > 0) {
      console.log(`\n🚨 Found ${questionsToMove.length} questions that should be moved to Gráficos:`)
      questionsToMove.forEach((q, index) => {
        console.log(`${index + 1}. ${q.id} - ${q.question_subtype} - ${q.question_text.substring(0, 50)}...`)
      })
      
      console.log(`\n💡 To fix these, run the fix script with these IDs.`)
      console.log('   Graficos section ID:', graficosSection.id)
    } else {
      console.log('\n✅ No misclassified questions found!')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Ejecutar el script
findMisclassifiedQuestions()