// scripts/reset-law-status.js - Resetear estado de cambios para probar lógica BOE
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function resetLawChangeStatus() {
  try {
    console.log('🔄 Reseteando estado de cambios en leyes...')
    
    // Resetear todas las leyes que tienen BOE URL a estado "none"
    const { data, error } = await supabase
      .from('laws')
      .update({
        change_status: 'none'
      })
      .not('boe_url', 'is', null)
      .select('id, short_name')
    
    if (error) {
      console.log('❌ Error:', error.message)
      return
    }
    
    console.log('✅ Estado de cambios reseteado para:')
    data.forEach(law => {
      console.log(`   - ${law.short_name}`)
    })
    
    console.log('\n📝 Ahora cuando ejecutes /api/law-changes:')
    console.log('   - Usará lógica BOE (si está la columna last_update_boe)')
    console.log('   - O fallback a hash (si no está la columna)')
    console.log('   - No debería detectar cambios falsos por metadatos HTML')
    
  } catch (error) {
    console.log('❌ Error general:', error.message)
  }
}

resetLawChangeStatus()