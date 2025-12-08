// Script para verificar el usuario David y su target_oposicion
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkDavidUser() {
  try {
    console.log('🔍 Buscando usuario David de Córdoba...\n')

    // Primero buscar en public_user_profiles con ciudad Córdoba
    const { data: publicProfiles, error: publicError } = await supabase
      .from('public_user_profiles')
      .select('id, display_name, ciudad')
      .ilike('ciudad', '%Córdoba%')

    if (publicError) {
      console.error('❌ Error buscando public_user_profiles:', publicError)
      return
    }

    console.log(`📊 Encontrados ${publicProfiles?.length || 0} usuarios de Córdoba\n`)

    // Para cada perfil público, buscar el perfil completo
    for (const pubProfile of publicProfiles || []) {
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, full_name, target_oposicion, created_at')
        .eq('id', pubProfile.id)
        .single()

      if (profileError) {
        console.error(`❌ Error obteniendo perfil de ${pubProfile.id}:`, profileError)
        continue
      }

      console.log(`Usuario:`)
      console.log(`  ID: ${userProfile.id}`)
      console.log(`  Nombre: ${userProfile.full_name}`)
      console.log(`  Display Name: ${pubProfile.display_name}`)
      console.log(`  Ciudad: ${pubProfile.ciudad}`)
      console.log(`  target_oposicion: ${userProfile.target_oposicion}`)
      console.log(`  Creado: ${userProfile.created_at}`)

      // Verificar si es UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userProfile.target_oposicion)
      console.log(`  ⚠️ Es UUID: ${isUUID ? 'SÍ ❌' : 'NO ✅'}`)
      console.log('---\n')
    }

    // Buscar específicamente usuarios con nombre "David" o que empiecen con D
    console.log('\n🔍 Buscando usuarios con nombre David...\n')

    const { data: davids, error: davidError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        full_name,
        target_oposicion,
        created_at
      `)
      .or('full_name.ilike.%David%,full_name.ilike.D%')
      .order('created_at', { ascending: false })
      .limit(20)

    if (davidError) {
      console.error('❌ Error:', davidError)
      return
    }

    console.log(`📊 Encontrados ${davids?.length || 0} usuarios con nombre David/D:\n`)

    davids?.forEach((user, idx) => {
      console.log(`Usuario ${idx + 1}:`)
      console.log(`  ID: ${user.id}`)
      console.log(`  Nombre: ${user.full_name}`)
      console.log(`  target_oposicion: ${user.target_oposicion}`)

      // Verificar si es UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.target_oposicion)
      console.log(`  ⚠️ Es UUID: ${isUUID ? 'SÍ ❌' : 'NO ✅'}`)
      console.log('---')
    })

  } catch (err) {
    console.error('❌ Error inesperado:', err)
  }
}

checkDavidUser()
