// Script para encontrar TODOS los usuarios con UUIDs en target_oposicion
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function findAllUUIDOposiciones() {
  try {
    console.log('🔍 Buscando TODOS los usuarios con UUIDs en target_oposicion...\n')

    // Obtener todos los user_profiles
    let allUsers = []
    let page = 0
    const pageSize = 1000

    while (true) {
      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, target_oposicion, created_at')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (error) {
        console.error('❌ Error:', error)
        return
      }

      if (!users || users.length === 0) break

      allUsers = allUsers.concat(users)
      page++

      if (users.length < pageSize) break
    }

    console.log(`📊 Total usuarios analizados: ${allUsers.length}\n`)

    // Filtrar usuarios con UUIDs
    const usersWithUUID = allUsers.filter(user => {
      if (!user.target_oposicion) return false
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.target_oposicion)
    })

    console.log(`⚠️ Usuarios con UUID en target_oposicion: ${usersWithUUID.length}\n`)

    if (usersWithUUID.length === 0) {
      console.log('✅ No hay más usuarios con este problema')
      return
    }

    console.log('📋 LISTA DE USUARIOS CON UUID:\n')
    usersWithUUID.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.full_name} (${user.email})`)
      console.log(`   ID: ${user.id}`)
      console.log(`   target_oposicion: ${user.target_oposicion}`)
      console.log(`   Creado: ${user.created_at}`)
      console.log('---')
    })

    // Contar por tipo de UUID (podría haber diferentes UUIDs representando diferentes oposiciones)
    const uuidCount = {}
    usersWithUUID.forEach(user => {
      uuidCount[user.target_oposicion] = (uuidCount[user.target_oposicion] || 0) + 1
    })

    console.log('\n📊 RESUMEN POR UUID:')
    Object.entries(uuidCount).forEach(([uuid, count]) => {
      console.log(`  ${uuid}: ${count} usuarios`)
    })

  } catch (err) {
    console.error('❌ Error inesperado:', err)
  }
}

findAllUUIDOposiciones()
