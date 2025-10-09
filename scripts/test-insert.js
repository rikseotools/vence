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

async function testInserts() {
  try {
    // Test 1: Try to read sections table to see what exists
    console.log('🔍 Checking existing sections...')
    const { data: sections, error: sectionsError } = await supabase
      .from('psychometric_sections')
      .select('*')
      .limit(5)

    if (sectionsError) {
      console.error('❌ Error reading sections:', sectionsError)
    } else {
      console.log('✅ Sections found:', sections)
      
      if (sections.length > 0) {
        console.log('📋 First section structure:')
        console.log(Object.keys(sections[0]))
      }
    }

    // Test 2: Try to read questions table
    console.log('\n🔍 Checking questions table...')
    const { data: questions, error: questionsError } = await supabase
      .from('psychometric_questions')
      .select('*')
      .limit(1)

    if (questionsError) {
      console.error('❌ Error reading questions:', questionsError)
    } else {
      console.log('✅ Questions table accessible:', questions)
    }

    // Test 3: Try minimal insert to see what columns are expected
    console.log('\n🧪 Testing minimal question insert...')
    const { data: testQuestion, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert({
        question_text: 'Test question',
        option_a: 'A',
        option_b: 'B', 
        option_c: 'C',
        option_d: 'D',
        correct_option: 0
      })
      .select()

    if (insertError) {
      console.error('❌ Insert error:', insertError)
    } else {
      console.log('✅ Test insert successful:', testQuestion)
      
      // Clean up test question
      if (testQuestion && testQuestion[0]) {
        await supabase
          .from('psychometric_questions')
          .delete()
          .eq('id', testQuestion[0].id)
        console.log('🗑️ Test question cleaned up')
      }
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testInserts()