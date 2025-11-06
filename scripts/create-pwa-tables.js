#!/usr/bin/env node

// Script para crear tablas PWA tracking
// Ejecutar: npm run create-pwa-tables

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

async function createPWATables() {
  console.log('🚀 Creando tablas PWA tracking...')
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, '../database/migrations/create_pwa_tracking_tables.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')

    console.log('📄 SQL cargado, ejecutando migración...')

    // Dividir el SQL en statements individuales
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`📊 Ejecutando ${statements.length} statements...`)

    for (const [index, statement] of statements.entries()) {
      try {
        const { error } = await supabase.rpc('exec_sql', { 
          sql: statement + ';' 
        })
        
        if (error) {
          // Intentar método directo
          console.log(`⚠️ RPC falló para statement ${index + 1}, intentando método directo...`)
        } else {
          console.log(`✅ Statement ${index + 1} ejecutado`)
        }
      } catch (err) {
        console.log(`⚠️ Statement ${index + 1} error:`, err.message)
      }
    }

    // Verificar que las tablas se crearon
    console.log('🔍 Verificando tablas creadas...')
    
    const { data: events } = await supabase
      .from('pwa_events')
      .select('count')
      .limit(1)
    
    const { data: sessions } = await supabase
      .from('pwa_sessions')
      .select('count')
      .limit(1)

    if (events !== null && sessions !== null) {
      console.log('🎉 ¡Tablas PWA creadas exitosamente!')
      console.log('✅ pwa_events: Accesible')
      console.log('✅ pwa_sessions: Accesible')
      console.log('')
      console.log('🔄 Ahora recarga /admin/pwa para ver datos reales')
    } else {
      console.log('❌ Las tablas no están accesibles')
      console.log('💡 Ejecuta manualmente el SQL en Supabase Dashboard')
    }

  } catch (error) {
    console.error('❌ Error general:', error.message)
    console.log('')
    console.log('💡 Solución alternativa:')
    console.log('1. Ir a Supabase Dashboard → SQL Editor')
    console.log('2. Copiar y ejecutar: database/migrations/create_pwa_tracking_tables.sql')
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  createPWATables()
}

module.exports = { createPWATables }