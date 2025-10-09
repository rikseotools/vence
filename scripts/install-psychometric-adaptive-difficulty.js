#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
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

async function installAdaptiveDifficulty() {
  try {
    console.log('🚀 INSTALANDO SISTEMA DE DIFICULTAD ADAPTATIVA PSICOTÉCNICA\n')

    // 1. Leer el archivo SQL
    console.log('📖 Leyendo migración SQL...')
    const sqlPath = join(__dirname, '../database/migrations/psychometric_adaptive_difficulty.sql')
    const sqlContent = readFileSync(sqlPath, 'utf8')
    
    // 2. Dividir en statements individuales (por punto y coma seguido de salto de línea)
    const statements = sqlContent
      .split(';\n')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`✅ ${statements.length} statements SQL encontrados\n`)

    // 3. Ejecutar cada statement individualmente
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      
      // Skip comentarios de SQL
      if (stmt.startsWith('COMMENT') || stmt.includes('-- ===')) {
        continue
      }
      
      console.log(`⚙️ Ejecutando statement ${i + 1}/${statements.length}...`)
      
      try {
        // Para CREATE FUNCTION y similares, usar rpc
        if (stmt.includes('CREATE OR REPLACE FUNCTION') || stmt.includes('CREATE TABLE')) {
          const { error } = await supabase.rpc('exec_sql', { sql: stmt })
          if (error) {
            console.log(`❌ Error en statement ${i + 1}:`, error.message)
            errorCount++
          } else {
            console.log(`✅ Statement ${i + 1} ejecutado`)
            successCount++
          }
        } else {
          // Para statements simples
          console.log(`⏭️ Skipping statement ${i + 1} (no executable via RPC)`)
        }
      } catch (e) {
        console.log(`❌ Error ejecutando statement ${i + 1}:`, e.message)
        errorCount++
      }
    }

    console.log(`\n📊 RESULTADOS:`)
    console.log(`✅ Exitosos: ${successCount}`)
    console.log(`❌ Con errores: ${errorCount}`)

    // 4. Verificar instalación
    console.log('\n🔍 VERIFICANDO INSTALACIÓN...')
    
    // Verificar tabla
    try {
      const { data: tableCheck, error: tableError } = await supabase
        .from('psychometric_first_attempts')
        .select('user_id')
        .limit(1)
      
      if (tableError && !tableError.message.includes('0 rows')) {
        console.log('❌ Tabla psychometric_first_attempts no creada:', tableError.message)
      } else {
        console.log('✅ Tabla psychometric_first_attempts creada correctamente')
      }
    } catch (e) {
      console.log('❌ Error verificando tabla:', e.message)
    }

    // Verificar columnas en psychometric_questions
    try {
      const { data: questions, error: questionsError } = await supabase
        .from('psychometric_questions')
        .select('id, global_difficulty, difficulty_sample_size')
        .limit(1)
      
      if (questionsError) {
        console.log('❌ Columnas de dificultad no agregadas:', questionsError.message)
      } else {
        console.log('✅ Columnas de dificultad agregadas a psychometric_questions')
        if (questions.length > 0) {
          console.log('📊 Ejemplo:', questions[0])
        }
      }
    } catch (e) {
      console.log('❌ Error verificando columnas:', e.message)
    }

    console.log('\n🎉 INSTALACIÓN COMPLETADA')
    console.log('\n🔧 Para aplicar manualmente la migración completa:')
    console.log('1. Ve a Supabase Dashboard > SQL Editor')
    console.log('2. Pega el contenido de database/migrations/psychometric_adaptive_difficulty.sql')
    console.log('3. Ejecuta el script completo')

  } catch (error) {
    console.error('❌ Error durante instalación:', error)
  }
}

installAdaptiveDifficulty()