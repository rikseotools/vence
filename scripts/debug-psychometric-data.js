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

async function debugPsychometricData() {
  try {
    console.log('🔍 Debugging psychometric data...\n')

    // 1. Check all categories
    console.log('📋 CATEGORIES:')
    const { data: categories, error: catError } = await supabase
      .from('psychometric_categories')
      .select('*')
      .order('created_at')

    if (catError) {
      console.error('❌ Error fetching categories:', catError)
      return
    }

    console.table(categories)

    // 2. Check all sections
    console.log('\n📂 SECTIONS:')
    const { data: sections, error: secError } = await supabase
      .from('psychometric_sections')
      .select('*, psychometric_categories(category_key, display_name)')
      .order('created_at')

    if (secError) {
      console.error('❌ Error fetching sections:', secError)
      return
    }

    console.table(sections.map(s => ({
      id: s.id,
      category_key: s.psychometric_categories?.category_key,
      category_name: s.psychometric_categories?.display_name,
      section_key: s.section_key,
      section_name: s.display_name
    })))

    // 3. Check all questions
    console.log('\n❓ QUESTIONS:')
    const { data: questions, error: qError } = await supabase
      .from('psychometric_questions')
      .select(`
        id,
        question_text,
        question_subtype,
        psychometric_categories(category_key, display_name),
        psychometric_sections(section_key, display_name)
      `)
      .order('created_at')

    if (qError) {
      console.error('❌ Error fetching questions:', qError)
      return
    }

    console.table(questions.map(q => ({
      id: q.id,
      category_key: q.psychometric_categories?.category_key,
      section_key: q.psychometric_sections?.section_key,
      subtype: q.question_subtype,
      question: q.question_text.substring(0, 50) + '...'
    })))

    // 4. Count questions by category and section
    console.log('\n📊 QUESTION COUNTS BY SECTION:')
    const { data: counts, error: countError } = await supabase
      .from('psychometric_questions')
      .select(`
        psychometric_categories(category_key, display_name),
        psychometric_sections(section_key, display_name)
      `)

    if (countError) {
      console.error('❌ Error fetching counts:', countError)
      return
    }

    const countMap = {}
    counts.forEach(q => {
      const catKey = q.psychometric_categories?.category_key
      const secKey = q.psychometric_sections?.section_key
      
      if (!countMap[catKey]) countMap[catKey] = {}
      if (!countMap[catKey][secKey]) countMap[catKey][secKey] = 0
      countMap[catKey][secKey]++
    })

    console.log('Question counts:', JSON.stringify(countMap, null, 2))

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

debugPsychometricData()