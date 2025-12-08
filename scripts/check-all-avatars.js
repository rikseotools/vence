import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkAllAvatars() {
  console.log('🔍 INVESTIGACIÓN COMPLETA DE AVATARES\n')
  console.log('=' .repeat(60))

  // 1. Obtener TODOS los usuarios
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  console.log('\nTotal usuarios en auth.users:', authUsers?.users?.length || 0)

  // 2. Ver cuántos tienen algún tipo de avatar
  let avatarStats = {
    predefined: 0,
    uploaded: 0,
    google: 0,
    none: 0
  }

  let usersWithPredefinedAvatar = []

  for (const user of authUsers?.users || []) {
    const meta = user.user_metadata

    if (meta?.avatar_type === 'predefined' && meta?.avatar_emoji) {
      avatarStats.predefined++
      usersWithPredefinedAvatar.push({
        id: user.id,
        email: user.email,
        name: meta.full_name || user.email?.split('@')[0],
        emoji: meta.avatar_emoji,
        color: meta.avatar_color
      })
    } else if (meta?.avatar_type === 'uploaded' && meta?.avatar_url) {
      avatarStats.uploaded++
    } else if (meta?.avatar_url || meta?.picture) {
      avatarStats.google++
    } else {
      avatarStats.none++
    }
  }

  console.log('\n📊 ESTADÍSTICAS DE AVATARES EN USER_METADATA:')
  console.log('  - Avatares predefinidos (animales):', avatarStats.predefined)
  console.log('  - Avatares subidos:', avatarStats.uploaded)
  console.log('  - Avatares de Google:', avatarStats.google)
  console.log('  - Sin avatar:', avatarStats.none)

  // 3. Verificar Nila específicamente
  const nilaId = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd'
  const nilaUser = authUsers?.users?.find(u => u.id === nilaId)

  console.log('\n🔍 CASO ESPECÍFICO - NILA:')
  if (nilaUser) {
    console.log('  Email:', nilaUser.email)
    console.log('  Metadata completa:')
    console.log(JSON.stringify(nilaUser.user_metadata, null, 2))
  } else {
    console.log('  ⚠️ Usuario Nila no encontrado!')
  }

  // 4. Ver si hay avatares en public_user_profiles
  const { data: profilesWithAvatar } = await supabase
    .from('public_user_profiles')
    .select('id, display_name, avatar_emoji, avatar_type')
    .not('avatar_emoji', 'is', null)

  console.log('\n📊 AVATARES EN PUBLIC_USER_PROFILES:')
  console.log('  Total perfiles con avatar:', profilesWithAvatar?.length || 0)

  if (profilesWithAvatar?.length > 0) {
    console.log('\n  Ejemplos:')
    profilesWithAvatar.slice(0, 5).forEach(p => {
      console.log(`    - ${p.display_name}: ${p.avatar_emoji}`)
    })
  }

  // 5. Usuarios con avatar predefinido pero sin sincronizar
  if (usersWithPredefinedAvatar.length > 0) {
    console.log('\n⚠️ USUARIOS CON AVATAR PREDEFINIDO:')
    for (const user of usersWithPredefinedAvatar) {
      const { data: profile } = await supabase
        .from('public_user_profiles')
        .select('id, avatar_emoji')
        .eq('id', user.id)
        .single()

      if (!profile?.avatar_emoji) {
        console.log(`  - ${user.name} (${user.emoji}) - NO SINCRONIZADO`)
      }
    }
  }
}

checkAllAvatars().catch(console.error)