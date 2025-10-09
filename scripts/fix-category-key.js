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

async function fixCategoryKey() {
  try {
    console.log('🔧 Fixing category key mismatch...')

    // 1. Get the correct category ID for 'capacidad-administrativa' (with hyphen)
    const { data: correctCategory } = await supabase
      .from('psychometric_categories')
      .select('id')
      .eq('category_key', 'capacidad-administrativa')
      .single()

    if (!correctCategory) {
      console.error('❌ Correct category not found')
      return
    }

    console.log('✅ Found correct category ID:', correctCategory.id)

    // 2. Get the section in the correct category
    const { data: correctSection } = await supabase
      .from('psychometric_sections')
      .select('id')
      .eq('category_id', correctCategory.id)
      .eq('section_key', 'graficos')
      .single()

    if (!correctSection) {
      console.error('❌ Correct section not found')
      return
    }

    console.log('✅ Found correct section ID:', correctSection.id)

    // 3. Update the question to use the correct category and section
    const { data: updatedQuestion, error } = await supabase
      .from('psychometric_questions')
      .update({
        category_id: correctCategory.id,
        section_id: correctSection.id
      })
      .eq('question_text', '¿Cuánto suman las ventas de "poemas" y "ciencia ficción"?')
      .select()

    if (error) {
      console.error('❌ Error updating question:', error)
      return
    }

    console.log('✅ Question updated successfully!')
    console.log('📋 Updated question:', updatedQuestion[0]?.id)

    // 4. Delete the duplicate category we created by mistake
    const { error: deleteError } = await supabase
      .from('psychometric_categories')
      .delete()
      .eq('category_key', 'capacidad_administrativa')

    if (deleteError) {
      console.error('⚠️ Warning: Could not delete duplicate category:', deleteError)
    } else {
      console.log('🗑️ Deleted duplicate category')
    }

    // 5. Delete the duplicate section
    const { error: deleteSectionError } = await supabase
      .from('psychometric_sections')
      .delete()
      .eq('section_key', 'graficos')
      .eq('category_id', '67bed11d-3ad9-414c-9616-5bc2d44094b9') // The incorrect category ID

    if (deleteSectionError) {
      console.error('⚠️ Warning: Could not delete duplicate section:', deleteSectionError)
    } else {
      console.log('🗑️ Deleted duplicate section')
    }

    console.log('\n🎉 Fix completed! The question should now be accessible.')

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

fixCategoryKey()