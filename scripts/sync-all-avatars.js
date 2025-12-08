import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function syncAllAvatars() {
  console.log('🔄 SINCRONIZACIÓN DE AVATARES\n')
  console.log('=' .repeat(60))

  // Obtener TODOS los usuarios (paginando si es necesario)
  let allUsers = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const { data: authData } = await supabase.auth.admin.listUsers({
      page: page,
      perPage: 1000
    })

    if (authData?.users && authData.users.length > 0) {
      allUsers = [...allUsers, ...authData.users]
      page++
      // Si obtenemos menos de 1000, no hay más páginas
      if (authData.users.length < 1000) {
        hasMore = false
      }
    } else {
      hasMore = false
    }
  }

  console.log('Total usuarios encontrados:', allUsers.length)

  // Filtrar usuarios con avatar predefinido
  const usersWithAvatar = allUsers.filter(u =>
    u.user_metadata?.avatar_type === 'predefined' &&
    u.user_metadata?.avatar_emoji
  )

  console.log('Usuarios con avatar predefinido:', usersWithAvatar.length)

  if (usersWithAvatar.length === 0) {
    console.log('No hay usuarios con avatares predefinidos para sincronizar.')
    return
  }

  // Verificar cuáles necesitan sincronización
  let toSync = []

  for (const user of usersWithAvatar) {
    const { data: profile } = await supabase
      .from('public_user_profiles')
      .select('id, display_name, avatar_emoji')
      .eq('id', user.id)
      .maybeSingle()

    if (profile && !profile.avatar_emoji) {
      // Tiene perfil pero no avatar
      toSync.push({
        id: user.id,
        name: user.user_metadata.full_name || user.email?.split('@')[0],
        email: user.email,
        emoji: user.user_metadata.avatar_emoji,
        color: user.user_metadata.avatar_color,
        type: user.user_metadata.avatar_type,
        avatar_name: user.user_metadata.avatar_name
      })
    } else if (!profile) {
      console.log(`⚠️ ${user.email} no tiene perfil público`)
    }
  }

  console.log('\n📋 Usuarios que necesitan sincronización:', toSync.length)

  if (toSync.length > 0) {
    console.log('\nUsuarios afectados:')
    toSync.forEach((u, i) => {
      console.log(`${i + 1}. ${u.name} - ${u.emoji} (${u.email})`)
    })

    // Generar SQL para actualizar
    console.log('\n💾 SQL PARA SINCRONIZAR:')
    console.log('-'.repeat(60))
    console.log('-- Ejecutar en Supabase SQL Editor:\n')

    toSync.forEach(u => {
      console.log(`-- ${u.name}`)
      console.log(`UPDATE public_user_profiles`)
      console.log(`SET avatar_type = 'predefined',`)
      console.log(`    avatar_emoji = '${u.emoji}',`)
      console.log(`    avatar_color = '${u.color}',`)
      console.log(`    avatar_name = '${u.avatar_name || ''}',`)
      console.log(`    updated_at = NOW()`)
      console.log(`WHERE id = '${u.id}';`)
      console.log('')
    })

    console.log('-- Verificar actualización')
    console.log(`SELECT id, display_name, avatar_emoji`)
    console.log(`FROM public_user_profiles`)
    console.log(`WHERE id IN (${toSync.map(u => `'${u.id}'`).join(', ')});`)
  } else {
    console.log('✅ Todos los avatares están sincronizados!')
  }

  // Verificar específicamente a Nila
  const nilaId = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd'
  const nila = usersWithAvatar.find(u => u.id === nilaId)
  if (nila) {
    console.log('\n🦄 NILA ESPECÍFICAMENTE:')
    console.log('  Tiene avatar en metadata:', nila.user_metadata.avatar_emoji)
    const needsSync = toSync.find(u => u.id === nilaId)
    if (needsSync) {
      console.log('  ⚠️ NECESITA sincronización')
    } else {
      console.log('  ✅ Ya está sincronizada')
    }
  }
}

syncAllAvatars().catch(console.error)