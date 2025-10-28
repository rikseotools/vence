// scripts/add-boe-date-column.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addBOEDateColumn() {
  try {
    console.log('🔧 Añadiendo columna last_update_boe a tabla laws...')
    
    // Primero verificar si ya existe
    const { data: testData, error: testError } = await supabase
      .from('laws')
      .select('last_update_boe')
      .limit(1)
    
    if (!testError) {
      console.log('✅ Columna last_update_boe ya existe')
      return
    }
    
    if (!testError?.message?.includes('column "last_update_boe" does not exist')) {
      throw new Error('Error inesperado: ' + testError.message)
    }
    
    console.log('📝 Columna no existe, procediendo a crearla...')
    console.log('\n🚨 IMPORTANTE: Ejecutar manualmente en SQL Editor de Supabase:')
    console.log('ALTER TABLE laws ADD COLUMN last_update_boe TEXT;')
    console.log('\nEste script no puede ejecutar DDL directamente.')
    console.log('Después de ejecutar el ALTER TABLE, ejecuta este script de nuevo para verificar.')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

addBOEDateColumn()