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

async function checkTableStructures() {
  try {
    console.log('🔍 Checking psychometric table structures...\n')

    const tables = [
      'psychometric_categories',
      'psychometric_sections', 
      'psychometric_questions'
    ]

    for (const tableName of tables) {
      console.log(`📋 Table: ${tableName}`)
      console.log('─'.repeat(50))

      // Query the information schema to get column details
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = '${tableName}'
          ORDER BY ordinal_position;
        `
      })

      if (error) {
        console.error(`❌ Error querying ${tableName}:`, error)
        continue
      }

      if (data && data.length > 0) {
        console.table(data)
      } else {
        console.log(`⚠️  No columns found for ${tableName}`)
      }
      
      console.log('\n')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkTableStructures()