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

async function debugTableStructure() {
  try {
    console.log('🔍 Checking psychometric_questions table structure...\n')

    // Ver estructura de la tabla
    const { data, error } = await supabase
      .from('psychometric_questions')
      .select('*')
      .limit(1)

    if (error) {
      console.error('❌ Error:', error)
      return
    }

    if (data && data.length > 0) {
      console.log('✅ Available columns:')
      console.log(Object.keys(data[0]))
    } else {
      console.log('⚠️ No data found, trying to get schema info...')
      
      // Intentar insertar un registro mínimo para ver qué campos acepta
      const { error: insertError } = await supabase
        .from('psychometric_questions')
        .insert({
          question_text: 'Test structure',
          option_a: 'A',
          option_b: 'B', 
          option_c: 'C',
          option_d: 'D',
          correct_option: 0
        })
        .select()

      if (insertError) {
        console.log('❌ Insert error reveals required fields:')
        console.log(insertError)
      }
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

debugTableStructure()