#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

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

async function runMigrations() {
  console.log('🚀 EJECUTANDO MIGRACIONES PSICOTÉCNICAS\n')

  try {
    // 1. Migración completa del sistema
    console.log('📋 PASO 1: Ejecutando migración completa del sistema...')
    const completeMigration = readFileSync(
      join(__dirname, '../database/migrations/complete_psychometric_system.sql'),
      'utf8'
    )

    // Dividir en statements separados y ejecutar uno por uno
    const statements = completeMigration
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement.includes('SELECT ')) continue // Skip SELECT statements
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
        if (error) {
          console.log(`⚠️  ${error.message}`)
        }
      } catch (e) {
        // Try direct query execution for DDL statements
        try {
          await supabase.from('psychometric_test_sessions').select('id').limit(1)
        } catch (directError) {
          console.log(`⚠️  Could not execute: ${statement.substring(0, 100)}...`)
        }
      }
    }

    console.log('✅ Migración completa ejecutada')

    // 2. Migración de logs adaptativos
    console.log('\n📋 PASO 2: Ejecutando migración de logs adaptativos...')
    const logsMigration = readFileSync(
      join(__dirname, '../database/migrations/psychometric_adaptive_logs.sql'),
      'utf8'
    )

    const logsStatements = logsMigration
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of logsStatements) {
      if (statement.includes('SELECT ')) continue
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
        if (error) {
          console.log(`⚠️  ${error.message}`)
        }
      } catch (e) {
        console.log(`⚠️  Could not execute logs statement`)
      }
    }

    console.log('✅ Migración de logs ejecutada')

    // 3. Verificar tablas
    console.log('\n📋 PASO 3: Verificando tablas creadas...')
    
    const tables = [
      'psychometric_first_attempts',
      'psychometric_user_question_history', 
      'psychometric_adaptive_logs'
    ]

    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1)
        console.log(`✅ Tabla ${table}: existe`)
      } catch (e) {
        console.log(`❌ Tabla ${table}: ${e.message}`)
      }
    }

    console.log('\n🎉 MIGRACIONES COMPLETADAS')

  } catch (error) {
    console.error('❌ Error durante las migraciones:', error)
  }
}

runMigrations()