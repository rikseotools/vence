import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function syncAllAvatars() {
  console.log('🔄 SINCRONIZANDO TODOS LOS AVATARES\n')
  console.log('='.repeat(60))

  // Obtener TODOS los usuarios
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

  console.log('Total usuarios:', allUsers.length)

  let syncCount = 0
  let errorCount = 0

  for (const user of allUsers) {
    const meta = user.user_metadata
    let updateData = null

    // Determinar qué tipo de avatar tiene el usuario
    if (meta?.avatar_type === 'predefined' && meta?.avatar_emoji) {
      // Avatar predefinido (animales, etc.)
      updateData = {
        id: user.id,
        avatar_type: 'predefined',
        avatar_emoji: meta.avatar_emoji,
        avatar_color: meta.avatar_color,
        avatar_name: meta.avatar_name || null,
        avatar_url: null
      }
    } else if (meta?.avatar_type === 'uploaded' && meta?.avatar_url) {
      // Avatar subido
      updateData = {
        id: user.id,
        avatar_type: 'uploaded',
        avatar_url: meta.avatar_url,
        avatar_emoji: null,
        avatar_color: null,
        avatar_name: null
      }
    } else if ((meta?.avatar_url || meta?.picture) && !meta?.avatar_type) {
      // Foto de Google/proveedor
      updateData = {
        id: user.id,
        avatar_type: 'google',
        avatar_url: meta.avatar_url || meta.picture,
        avatar_emoji: null,
        avatar_color: null,
        avatar_name: null
      }
    }

    // Si el usuario tiene avatar, sincronizarlo
    if (updateData) {
      try {
        // Primero verificar si el perfil existe
        const { data: existingProfile } = await supabase
          .from('public_user_profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        if (!existingProfile) {
          // Si no existe el perfil, no podemos actualizar
          console.log(`⚠️  Sin perfil público: ${user.email}`)
        } else {
          // Si existe, actualizar SOLO los campos de avatar
          const updateFields = {}
          if (updateData.avatar_type !== undefined) updateFields.avatar_type = updateData.avatar_type
          if (updateData.avatar_emoji !== undefined) updateFields.avatar_emoji = updateData.avatar_emoji
          if (updateData.avatar_color !== undefined) updateFields.avatar_color = updateData.avatar_color
          if (updateData.avatar_name !== undefined) updateFields.avatar_name = updateData.avatar_name
          if (updateData.avatar_url !== undefined) updateFields.avatar_url = updateData.avatar_url
          updateFields.updated_at = new Date().toISOString()

          const { error } = await supabase
            .from('public_user_profiles')
            .update(updateFields)
            .eq('id', user.id)

          if (error) {
            console.log(`❌ Error con ${user.email}:`, error.message)
            errorCount++
          } else {
            syncCount++

            // Mostrar progreso cada 10 usuarios
            if (syncCount % 10 === 0) {
              console.log(`✅ ${syncCount} usuarios sincronizados...`)
            }
          }
        }
      } catch (err) {
        console.log(`❌ Error inesperado con ${user.email}:`, err.message)
        errorCount++
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 RESUMEN DE SINCRONIZACIÓN:')
  console.log(`✅ Avatares sincronizados: ${syncCount}`)
  console.log(`❌ Errores: ${errorCount}`)

  // Verificar algunos usuarios específicos
  console.log('\n🔍 VERIFICANDO USUARIOS ESPECÍFICOS:')

  const checkUsers = [
    { id: '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f', name: 'Manuel' },
    { id: 'c16c186a-4e70-4b1e-a3bd-c107e13670dd', name: 'Nila' }
  ]

  for (const checkUser of checkUsers) {
    const { data: profile } = await supabase
      .from('public_user_profiles')
      .select('display_name, avatar_type, avatar_emoji, avatar_url')
      .eq('id', checkUser.id)
      .single()

    if (profile) {
      if (profile.avatar_emoji) {
        console.log(`${checkUser.name}: ${profile.avatar_emoji} (${profile.avatar_type})`)
      } else if (profile.avatar_url) {
        console.log(`${checkUser.name}: Imagen (${profile.avatar_type})`)
      } else {
        console.log(`${checkUser.name}: Sin avatar`)
      }
    }
  }

  console.log('\n✅ Sincronización completada!')
}

syncAllAvatars().catch(console.error)