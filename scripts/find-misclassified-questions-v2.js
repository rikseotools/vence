// scripts/find-misclassified-questions-v2.js
// Script para encontrar preguntas mal clasificadas (simplificado)
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

    // 1. Primero obtener IDs de secciones
    const { data: sections, error: sectionsError } = await supabase
      .from('psychometric_sections')
      .select('id, section_key')
      .in('section_key', ['pruebas-clasificacion', 'graficos'])

    if (sectionsError) {
      console.error('❌ Error getting sections:', sectionsError)
      return
    }

    const clasificacionSection = sections.find(s => s.section_key === 'pruebas-clasificacion')
    const graficosSection = sections.find(s => s.section_key === 'graficos')

    console.log('📋 Section IDs:')
    console.log('   Pruebas clasificación:', clasificacionSection?.id)
    console.log('   Gráficos:', graficosSection?.id)

    // 2. Buscar preguntas en "pruebas-clasificacion"
    const { data: clasificacionQuestions, error: clasificacionError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, question_subtype, created_at')
      .eq('section_id', clasificacionSection.id)
      .order('created_at', { ascending: false })

    if (clasificacionError) {
      console.error('❌ Error getting clasificacion questions:', clasificacionError)
      return
    }

    console.log(`\n📋 Found ${clasificacionQuestions.length} questions in "Pruebas de clasificación":`)
    clasificacionQuestions.forEach((q, index) => {
      console.log(`\n${index + 1}. ID: ${q.id}`)
      console.log(`   Type: ${q.question_subtype}`)
      console.log(`   Text: ${q.question_text.substring(0, 80)}...`)
      console.log(`   Created: ${q.created_at}`)
      
      // Identificar si debería estar en gráficos
      const isChart = q.question_subtype === 'pie_chart' || 
                      q.question_subtype === 'bar_chart' || 
                      q.question_subtype === 'line_chart'
      const hasGraphText = q.question_text.toLowerCase().includes('gráfico') ||
                           q.question_text.toLowerCase().includes('grafico')
      
      if (isChart || hasGraphText) {
        console.log(`   🚨 SHOULD BE IN GRÁFICOS!`)
      }
    })

    // 3. Buscar preguntas en "graficos"
    const { data: graficosQuestions, error: graficosError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, question_subtype, created_at')
      .eq('section_id', graficosSection.id)
      .order('created_at', { ascending: false })

    if (graficosError) {
      console.error('❌ Error getting graficos questions:', graficosError)
      return
    }

    console.log(`\n📊 Found ${graficosQuestions.length} questions in "Gráficos":`)
    graficosQuestions.forEach((q, index) => {
      console.log(`${index + 1}. ${q.question_subtype} - ${q.question_text.substring(0, 60)}...`)
    })

    // 4. Identificar preguntas que necesitan ser movidas
    const questionsToMove = clasificacionQuestions.filter(q => {
      const isChart = q.question_subtype === 'pie_chart' || 
                      q.question_subtype === 'bar_chart' || 
                      q.question_subtype === 'line_chart'
      const hasGraphText = q.question_text.toLowerCase().includes('gráfico') ||
                           q.question_text.toLowerCase().includes('grafico')
      return isChart || hasGraphText
    })

    if (questionsToMove.length > 0) {
      console.log(`\n🚨 Found ${questionsToMove.length} questions that should be moved to Gráficos:`)
      questionsToMove.forEach((q, index) => {
        console.log(`${index + 1}. ${q.id} - ${q.question_subtype}`)
        console.log(`   Text: ${q.question_text.substring(0, 80)}...`)
      })
      
      console.log(`\n💡 To fix: UPDATE psychometric_questions SET section_id = '${graficosSection.id}' WHERE id IN (${questionsToMove.map(q => `'${q.id}'`).join(', ')})`)
    } else {
      console.log('\n✅ No misclassified questions found!')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Ejecutar el script
findMisclassifiedQuestions()