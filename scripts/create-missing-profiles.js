import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createMissingProfiles() {
  console.log('🔧 CREANDO PERFILES PÚBLICOS FALTANTES\n')
  console.log('='.repeat(60))

  // 1. Obtener todos los usuarios
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
      if (authData.users.length < 1000) {
        hasMore = false
      }
    } else {
      hasMore = false
    }
  }

  console.log('Total usuarios en auth:', allUsers.length)

  // 2. Verificar quiénes ya tienen perfil
  const { data: existingProfiles } = await supabase
    .from('public_user_profiles')
    .select('id')

  const existingIds = new Set(existingProfiles?.map(p => p.id) || [])
  console.log('Perfiles públicos existentes:', existingIds.size)

  // 3. Crear perfiles para usuarios que no tienen
  let createdCount = 0
  let errorCount = 0

  for (const user of allUsers) {
    if (!existingIds.has(user.id)) {
      // Determinar display_name
      const displayName = user.user_metadata?.full_name ||
                         user.email?.split('@')[0] ||
                         'Usuario'

      // Determinar avatar si existe
      let avatarData = {}
      const meta = user.user_metadata

      if (meta?.avatar_type === 'predefined' && meta?.avatar_emoji) {
        avatarData = {
          avatar_type: 'predefined',
          avatar_emoji: meta.avatar_emoji,
          avatar_color: meta.avatar_color,
          avatar_name: meta.avatar_name || null
        }
      } else if (meta?.avatar_type === 'uploaded' && meta?.avatar_url) {
        avatarData = {
          avatar_type: 'uploaded',
          avatar_url: meta.avatar_url
        }
      } else if ((meta?.avatar_url || meta?.picture) && !meta?.avatar_type) {
        avatarData = {
          avatar_type: 'google',
          avatar_url: meta.avatar_url || meta.picture
        }
      }

      // Crear el perfil
      const { error } = await supabase
        .from('public_user_profiles')
        .insert({
          id: user.id,
          display_name: displayName,
          ...avatarData,
          created_at: user.created_at,
          updated_at: new Date().toISOString()
        })

      if (error) {
        console.log(`❌ Error creando perfil para ${displayName}:`, error.message)
        errorCount++
      } else {
        createdCount++
        console.log(`✅ Perfil creado para: ${displayName}`)

        // Mostrar progreso cada 10 perfiles
        if (createdCount % 10 === 0) {
          console.log(`   Progreso: ${createdCount} perfiles creados...`)
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 RESUMEN DE CREACIÓN:')
  console.log(`✅ Perfiles creados: ${createdCount}`)
  console.log(`❌ Errores: ${errorCount}`)

  // 4. Verificación final
  const { count: finalCount } = await supabase
    .from('public_user_profiles')
    .select('*', { count: 'exact', head: true })

  console.log('\n📈 ESTADO FINAL:')
  console.log(`Total usuarios: ${allUsers.length}`)
  console.log(`Perfiles públicos: ${finalCount}`)
  console.log(`Diferencia: ${allUsers.length - finalCount}`)

  // 5. Verificar usuarios específicos
  console.log('\n🔍 VERIFICANDO USUARIOS ESPECÍFICOS:')

  const checkUsers = [
    { id: '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f', name: 'Manuel' },
    { id: 'c16c186a-4e70-4b1e-a3bd-c107e13670dd', name: 'Nila' }
  ]

  for (const checkUser of checkUsers) {
    const { data: profile } = await supabase
      .from('public_user_profiles')
      .select('display_name, avatar_type, avatar_emoji, avatar_url, ciudad')
      .eq('id', checkUser.id)
      .single()

    if (profile) {
      console.log(`\n${checkUser.name}:`)
      console.log(`  Display: ${profile.display_name}`)
      console.log(`  Ciudad: ${profile.ciudad || 'No configurada'}`)
      if (profile.avatar_emoji) {
        console.log(`  Avatar: ${profile.avatar_emoji} (${profile.avatar_type})`)
      } else if (profile.avatar_url) {
        console.log(`  Avatar: Imagen (${profile.avatar_type})`)
      } else {
        console.log(`  Avatar: Sin configurar`)
      }
    }
  }

  console.log('\n✨ Proceso completado!')
}

createMissingProfiles().catch(console.error)