#!/usr/bin/env node

// Script to insert the pie chart psychometric question
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function insertPieChartQuestion() {
  try {
    console.log('🔍 Starting psychometric question insertion...')

    // 1. Find the existing "graficos" section in "capacidad_administrativa"
    console.log('📊 Looking for existing "graficos" section...')
    
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('*, psychometric_categories!inner(category_key, display_name)')
      .eq('section_key', 'graficos')
      .eq('psychometric_categories.category_key', 'capacidad_administrativa')
      .single()

    if (sectionError) {
      console.error('❌ Error finding graficos section:', sectionError)
      console.log('📋 Available sections:')
      
      const { data: allSections } = await supabase
        .from('psychometric_sections')
        .select('section_key, display_name, psychometric_categories(category_key)')
        .limit(10)
      
      console.table(allSections)
      return
    }

    console.log('✅ Found graficos section:', section.id)
    console.log('📂 Category:', section.psychometric_categories.display_name)

    // 2. Get the category ID from the section
    const categoryId = section.category_id

    // 3. Insert the question
    console.log('📝 Inserting pie chart question...')

    const questionData = {
      category_id: categoryId, // Based on actual schema
      section_id: section.id,
      question_subtype: 'pie_chart',
      question_text: '¿Cuánto suman las ventas de "poemas" y "ciencia ficción"?',
      content_data: {
        chart_data: [
          { label: 'POEMAS', value: 811.25, percentage: 34.5 },
          { label: 'CIENCIA FICCIÓN', value: 512.3, percentage: 21.8 },
          { label: 'POLICIACA', value: 768.45, percentage: 32.7 },
          { label: 'ROMÁNTICA', value: 256.15, percentage: 10.9 }
        ],
        total_value: 2350,
        chart_title: 'LIBROS VENDIDOS EN EL AÑO 2023',
        chart_type: 'pie_chart',
        calculation_note: 'Total de libros vendidos durante el 2023 fue de 2350 libros',
        question_context: 'A continuación se presenta una gráfica y unas preguntas relacionadas con la misma. Tenga en cuenta que el total de libros vendidos durante el 2023 fue de 2350 libros.'
      },
      option_a: '1543',
      option_b: '1221', 
      option_c: '1432',
      option_d: '1323',
      correct_option: 3 // D = 1323 (index 3, 0-based)
    }

    const { data: question, error: questionError } = await supabase
      .from('psychometric_questions')
      .insert(questionData)
      .select()
      .single()

    if (questionError) {
      console.error('❌ Error inserting question:', questionError)
      return
    }

    console.log('✅ Question inserted successfully!')
    console.log('📋 Question ID:', question.id)
    console.log('📊 Category:', section.psychometric_categories.display_name)
    console.log('📈 Section:', section.display_name)
    console.log('❓ Question:', question.question_text)
    console.log('✅ Correct Answer:', question.option_d, '(Option D)')

    console.log('\n🎉 Pie chart question successfully added to the psychometric system!')
    console.log('🌐 You can now test it at: http://localhost:3000/auxiliar-administrativo-estado/test')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the script
insertPieChartQuestion()