import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function investigateAvatarSync() {
  // Verificar usuarios con avatar en metadata
  const { data: authUsers } = await supabase.auth.admin.listUsers()

  const usersWithAvatar = authUsers?.users?.filter(u =>
    u.user_metadata?.avatar_type === 'predefined' &&
    u.user_metadata?.avatar_emoji
  ) || []

  console.log('📊 ANÁLISIS DE SINCRONIZACIÓN DE AVATARES\n')
  console.log('=' .repeat(60))
  console.log('\nUsuarios con avatar configurado en metadata:', usersWithAvatar.length)

  // Verificar cuáles NO tienen el avatar en public_user_profiles
  let missingAvatars = []

  for (const user of usersWithAvatar) {
    const { data: profile } = await supabase
      .from('public_user_profiles')
      .select('id, display_name, avatar_emoji, avatar_type, ciudad')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.avatar_emoji) {
      missingAvatars.push({
        id: user.id,
        email: user.email,
        name: user.user_metadata.full_name || user.email?.split('@')[0],
        avatar: user.user_metadata.avatar_emoji,
        color: user.user_metadata.avatar_color,
        type: user.user_metadata.avatar_type,
        hasProfile: !!profile
      })
    }
  }

  console.log('\n⚠️ Usuarios con avatar NO sincronizado:', missingAvatars.length)

  if (missingAvatars.length > 0) {
    console.log('\n📝 USUARIOS AFECTADOS:')
    console.log('-'.repeat(60))
    missingAvatars.forEach((u, index) => {
      console.log(`${index + 1}. ${u.name}`)
      console.log(`   Avatar: ${u.avatar}`)
      console.log(`   Color: ${u.color}`)
      console.log(`   Email: ${u.email}`)
      console.log(`   Tiene perfil público: ${u.hasProfile ? 'SÍ (falta sincronizar avatar)' : 'NO'}`)
      console.log('')
    })

    // Generar SQL para actualizar todos
    console.log('\n💾 SQL PARA SINCRONIZAR TODOS LOS AVATARES:')
    console.log('=' .repeat(60))
    console.log('-- Copiar y ejecutar en Supabase:\n')

    missingAvatars.forEach(u => {
      if (u.hasProfile) {
        console.log(`-- Actualizar avatar de ${u.name}`)
        console.log(`UPDATE public_user_profiles SET`)
        console.log(`  avatar_type = '${u.type}',`)
        console.log(`  avatar_emoji = '${u.avatar}',`)
        console.log(`  avatar_color = '${u.color}',`)
        console.log(`  updated_at = NOW()`)
        console.log(`WHERE id = '${u.id}';`)
        console.log('')
      }
    })
  }

  return missingAvatars
}

investigateAvatarSync().catch(console.error)