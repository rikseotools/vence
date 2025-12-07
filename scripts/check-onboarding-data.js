// Script para verificar datos de onboarding de un usuario
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkOnboardingData(email) {
  try {
    console.log(`\n🔍 Buscando datos de onboarding para: ${email}\n`)

    // 1. Buscar directamente en user_profiles usando una query RPC o join
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')

    if (profileError) {
      console.log('❌ Error buscando perfiles:', profileError.message)
      return
    }

    // Buscar usuario por email en auth.users con paginación
    let allUsers = []
    let page = 1
    let perPage = 1000

    while (true) {
      const { data, error: userError } = await supabase.auth.admin.listUsers({
        page,
        perPage
      })

      if (userError) {
        console.log('⚠️  Error listando usuarios:', userError.message)
        break
      }

      if (!data.users || data.users.length === 0) {
        break
      }

      allUsers = allUsers.concat(data.users)

      if (data.users.length < perPage) {
        break
      }

      page++
    }

    const user = allUsers.find(u => u.email === email)

    if (!user) {
      console.log('❌ Usuario no encontrado en auth.users')
      console.log('📋 Total usuarios en sistema:', allUsers.length)

      // Mostrar usuarios que contienen "rikseo" o "tools" en el email
      console.log('\n🔍 Buscando emails similares...')
      const similar = allUsers.filter(u =>
        u.email?.toLowerCase().includes('rikseo') ||
        u.email?.toLowerCase().includes('tools') ||
        u.email?.toLowerCase().includes('manuel')
      )

      if (similar && similar.length > 0) {
        console.log('\n📧 Emails similares encontrados:')
        similar.forEach(u => {
          console.log(`   - ${u.email} (ID: ${u.id.substring(0, 8)}...)`)
        })
      }

      return
    }

    console.log('✅ Usuario encontrado:')
    console.log(`   ID: ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Creado: ${user.created_at}\n`)

    // 2. Buscar perfil usando el ID
    const profile = profiles?.find(p => p.id === user.id)

    if (!profile) {
      console.log('⚠️  No hay perfil creado para este usuario')
      return
    }

    console.log('📋 DATOS DE ONBOARDING:\n')

    console.log('🎯 Oposición:')
    console.log(`   target_oposicion: ${profile.target_oposicion || '❌ No definido'}`)
    if (profile.target_oposicion_data) {
      console.log(`   Datos completos:`, profile.target_oposicion_data)
    }

    console.log('\n👤 Datos personales:')
    console.log(`   Edad: ${profile.age || '❌ No definido'}`)
    console.log(`   Género: ${profile.gender || '❌ No definido'}`)
    console.log(`   Horas de estudio: ${profile.daily_study_hours || '❌ No definido'}`)
    console.log(`   Ciudad: ${profile.ciudad || '❌ No definido'}`)

    console.log('\n📅 Estado:')
    console.log(`   Onboarding completado: ${profile.onboarding_completed_at ? '✅ ' + profile.onboarding_completed_at : '❌ No completado'}`)
    console.log(`   Veces saltado: ${profile.onboarding_skip_count || 0}`)
    console.log(`   Último salto: ${profile.onboarding_last_skip_at || 'Nunca'}`)

    // Verificar si necesita onboarding
    const needsOnboarding = !profile.target_oposicion ||
                           !profile.onboarding_completed_at ||
                           !profile.age ||
                           !profile.gender ||
                           !profile.daily_study_hours ||
                           !profile.ciudad

    console.log('\n🎯 Necesita completar onboarding:', needsOnboarding ? '❌ SÍ' : '✅ NO')

    if (needsOnboarding) {
      console.log('\n⚠️  Campos faltantes:')
      if (!profile.target_oposicion) console.log('   - Oposición')
      if (!profile.age) console.log('   - Edad')
      if (!profile.gender) console.log('   - Género')
      if (!profile.daily_study_hours) console.log('   - Horas de estudio')
      if (!profile.ciudad) console.log('   - Ciudad')
      if (!profile.onboarding_completed_at) console.log('   - Marcar como completado')
    }

    console.log('\n')

  } catch (err) {
    console.error('❌ Error:', err.message)
    console.error(err)
  }
}

// Función para listar todos los emails con paginación
async function listAllEmails() {
  try {
    let allUsers = []
    let page = 1
    let perPage = 1000

    console.log('\n🔍 Obteniendo todos los usuarios...\n')

    // Obtener todos los usuarios con paginación
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage
      })

      if (error) {
        console.log('❌ Error:', error.message)
        break
      }

      if (!data.users || data.users.length === 0) {
        break
      }

      allUsers = allUsers.concat(data.users)
      console.log(`   Página ${page}: ${data.users.length} usuarios`)

      if (data.users.length < perPage) {
        break
      }

      page++
    }

    console.log(`\n📧 Total usuarios: ${allUsers.length}\n`)
    allUsers.forEach((u, i) => {
      console.log(`${i + 1}. ${u.email}`)
    })
  } catch (err) {
    console.error('❌ Error:', err.message)
  }
}

// Ejecutar
const command = process.argv[2]

if (command === 'list') {
  listAllEmails()
} else {
  const email = command || 'rikseotools@gmail.com'
  checkOnboardingData(email)
}
