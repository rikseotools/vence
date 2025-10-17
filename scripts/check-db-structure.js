// scripts/check-db-structure.js
// Verificar estructura real de tablas relacionadas con progreso

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yqbpstxowvgipqspqrgo.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
)

async function checkTablesStructure() {
  console.log('🔍 VERIFICANDO ESTRUCTURA DE TABLAS...\n')
  
  const tablesOfInterest = [
    'user_progress',
    'user_sessions',
    'tests',
    'test_questions'
  ]
  
  for (const tableName of tablesOfInterest) {
    try {
      console.log(`📊 TABLA: ${tableName}`)
      console.log('=' .repeat(40))
      
      // Intentar hacer una query simple para ver si existe
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)
      
      if (error) {
        if (error.code === '42P01') {
          console.log('❌ Tabla NO existe')
        } else {
          console.log('❌ Error:', error.message)
        }
      } else {
        console.log(`✅ Tabla existe - ${data?.length || 0} registros encontrados`)
        
        // Intentar obtener estructura de columnas
        if (data && data.length > 0) {
          console.log('📋 Columnas encontradas:')
          Object.keys(data[0]).forEach(col => {
            console.log(`   - ${col}`)
          })
        }
      }
      
      console.log('')
      
    } catch (err) {
      console.log(`❌ Error verificando ${tableName}:`, err.message)
      console.log('')
    }
  }
}

async function checkFunctions() {
  console.log('🔧 VERIFICANDO FUNCIONES RPC...\n')
  
  const functions = ['update_user_progress']
  
  for (const funcName of functions) {
    try {
      console.log(`⚙️  FUNCIÓN: ${funcName}`)
      
      // Intentar llamar la función con parámetros dummy
      const { data, error } = await supabase
        .rpc(funcName, {
          p_user_id: '00000000-0000-0000-0000-000000000000',
          p_test_id: '00000000-0000-0000-0000-000000000000'
        })
      
      if (error) {
        console.log('❌ Error:', error.message)
      } else {
        console.log('✅ Función existe y es ejecutable')
      }
      
    } catch (err) {
      console.log(`❌ Error verificando función ${funcName}:`, err.message)
    }
    
    console.log('')
  }
}

async function main() {
  console.log('🛠️  DIAGNÓSTICO DE BASE DE DATOS')
  console.log('=' .repeat(50))
  
  await checkTablesStructure()
  await checkFunctions()
  
  console.log('✅ Diagnóstico completado')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(() => process.exit(0)).catch(console.error)
}