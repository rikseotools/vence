#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function verifyQuestionCounts() {
  try {
    console.log('🔍 VERIFICANDO CONTEO DE PREGUNTAS PSICOTÉCNICAS\n')

    // 1. Ver todas las preguntas de capacidad administrativa
    console.log('📊 TODAS LAS PREGUNTAS DE CAPACIDAD ADMINISTRATIVA:')
    const { data: allQuestions, error: allError } = await supabase
      .from('psychometric_questions')
      .select(`
        id,
        question_text,
        question_subtype,
        is_active,
        psychometric_sections!inner(
          section_key,
          display_name,
          psychometric_categories!inner(
            category_key,
            display_name
          )
        )
      `)
      .eq('psychometric_sections.psychometric_categories.category_key', 'capacidad-administrativa')
      .eq('is_active', true)

    if (allError) {
      console.error('❌ Error:', allError)
      return
    }

    console.log(`Total encontradas: ${allQuestions.length}`)
    allQuestions.forEach((q, index) => {
      console.log(`${index + 1}. ${q.question_subtype} - ${q.psychometric_sections.display_name}`)
      console.log(`   Text: ${q.question_text.substring(0, 80)}...`)
      console.log(`   Section: ${q.psychometric_sections.section_key}`)
      console.log(`   Active: ${q.is_active}`)
      console.log('')
    })

    // 2. Conteo por sección
    console.log('📋 CONTEO POR SECCIÓN:')
    const sectionCounts = {}
    allQuestions.forEach(q => {
      const sectionKey = q.psychometric_sections.section_key
      const sectionName = q.psychometric_sections.display_name
      if (!sectionCounts[sectionKey]) {
        sectionCounts[sectionKey] = {
          name: sectionName,
          count: 0,
          questions: []
        }
      }
      sectionCounts[sectionKey].count++
      sectionCounts[sectionKey].questions.push({
        type: q.question_subtype,
        text: q.question_text.substring(0, 50) + '...'
      })
    })

    Object.entries(sectionCounts).forEach(([key, data]) => {
      console.log(`${data.name} (${key}): ${data.count} pregunta(s)`)
      data.questions.forEach((q, i) => {
        console.log(`  ${i + 1}. ${q.type}: ${q.text}`)
      })
      console.log('')
    })

    // 3. Verificar específicamente lo que carga el test
    console.log('🎯 LO QUE CARGA EL TEST (simulando la query):')
    const { data: testQuestions, error: testError } = await supabase
      .from('psychometric_questions')
      .select(`
        *,
        psychometric_categories!inner(category_key, display_name),
        psychometric_sections!inner(section_key, display_name)
      `)
      .eq('psychometric_categories.category_key', 'capacidad-administrativa')
      .eq('is_active', true)

    if (testError) {
      console.error('❌ Error:', testError)
      return
    }

    console.log(`Total que carga el test: ${testQuestions.length}`)
    testQuestions.forEach((q, index) => {
      console.log(`${index + 1}. [${q.question_subtype}] ${q.psychometric_sections.display_name}`)
      console.log(`   ID: ${q.id}`)
      console.log(`   Text: ${q.question_text.substring(0, 60)}...`)
      console.log('')
    })

    // 4. SQL directo para verificar
    console.log('💾 SQL PARA VERIFICACIÓN MANUAL:')
    console.log(`
SELECT 
  pq.id,
  pq.question_text,
  pq.question_subtype,
  pq.is_active,
  ps.section_key,
  ps.display_name as section_name,
  pc.category_key,
  pc.display_name as category_name
FROM psychometric_questions pq
JOIN psychometric_sections ps ON pq.section_id = ps.id
JOIN psychometric_categories pc ON ps.category_id = pc.id
WHERE pc.category_key = 'capacidad-administrativa'
  AND pq.is_active = true
ORDER BY ps.section_key, pq.created_at;
    `)

    console.log('\n🎉 VERIFICACIÓN COMPLETADA')

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

verifyQuestionCounts()