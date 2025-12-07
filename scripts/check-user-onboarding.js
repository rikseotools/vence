// Script para verificar el estado del onboarding de cualquier usuario
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkUserOnboarding(email) {
  console.log(`🔍 VERIFICANDO ONBOARDING DE: ${email}\n`)
  console.log('=' .repeat(70))

  try {
    // 1. Buscar usuario por email
    const { data: { users }, error: searchError } = await supabase.auth.admin.listUsers()

    if (searchError) {
      console.error('❌ Error buscando usuarios:', searchError)
      return
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!user) {
      console.log(`❌ Usuario con email ${email} no encontrado`)
      return
    }

    const userId = user.id
    console.log('✅ Usuario encontrado:')
    console.log(`   Email: ${user.email}`)
    console.log(`   User ID: ${userId}`)
    console.log(`   Creado: ${new Date(user.created_at).toLocaleDateString('es-ES')}\n`)

    // 2. Obtener perfil de user_profiles
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.log('❌ No se encontró perfil en user_profiles')
      console.log('   Esto significa que el usuario nunca ha iniciado sesión')
      console.log('   El perfil se crea automáticamente en el primer login')
      return
    }

    // 3. Analizar campos de onboarding
    console.log('📊 ESTADO DE CAMPOS DE ONBOARDING:')
    console.log('-'.repeat(70))

    const campos = {
      'target_oposicion': profile.target_oposicion,
      'target_oposicion_data': profile.target_oposicion_data,
      'age': profile.age,
      'gender': profile.gender,
      'daily_study_hours': profile.daily_study_hours,
      'ciudad': profile.ciudad,
      'onboarding_completed_at': profile.onboarding_completed_at,
      'onboarding_skip_count': profile.onboarding_skip_count,
      'onboarding_last_skip_at': profile.onboarding_last_skip_at
    }

    let camposCriticosFaltantes = []
    let camposOpcionales = []

    Object.entries(campos).forEach(([field, value]) => {
      const status = value ? '✅' : '❌'
      const displayValue = value ?
        (typeof value === 'object' ? JSON.stringify(value, null, 2) : value) :
        'NULL/undefined'

      // Determinar si es crítico o no
      const esCritico = ['target_oposicion', 'age', 'gender', 'ciudad', 'onboarding_completed_at'].includes(field)
      const label = esCritico ? '(CRÍTICO)' : '(opcional)'

      console.log(`${status} ${field.padEnd(25)} ${label}: ${displayValue}`)

      if (!value && esCritico) {
        camposCriticosFaltantes.push(field)
      } else if (!value && !esCritico) {
        camposOpcionales.push(field)
      }
    })

    console.log('\n' + '='.repeat(70))

    // 4. Verificar la lógica del hook useOnboarding
    console.log('\n🔍 VERIFICACIÓN DE LÓGICA useOnboarding.js:')
    console.log('-'.repeat(70))

    // Lógica actualizada (daily_study_hours es opcional)
    const needsOnboarding = !profile.target_oposicion ||
                           !profile.onboarding_completed_at ||
                           !profile.age ||
                           !profile.gender ||
                           // !profile.daily_study_hours || // OPCIONAL
                           !profile.ciudad

    console.log(`needsOnboarding = ${needsOnboarding ? 'TRUE ❌' : 'FALSE ✅'}`)

    if (needsOnboarding) {
      console.log('\n⚠️  EL MODAL DEBERÍA APARECER porque falta(n):')
      camposCriticosFaltantes.forEach(field => {
        console.log(`   - ${field}`)
      })
    } else {
      console.log('\n✅ EL MODAL NO DEBERÍA APARECER')
      console.log('   Todos los campos obligatorios están completos')
    }

    // 5. Análisis adicional
    console.log('\n' + '='.repeat(70))
    console.log('\n📅 INFORMACIÓN ADICIONAL:')
    console.log('-'.repeat(70))

    // Verificar si se ha saltado el onboarding
    if (profile.onboarding_skip_count > 0) {
      console.log(`⏭️  El usuario ha saltado el onboarding ${profile.onboarding_skip_count} veces`)
      if (profile.onboarding_last_skip_at) {
        console.log(`   Último skip: ${new Date(profile.onboarding_last_skip_at).toLocaleString('es-ES')}`)
      }

      // Verificar si ha alcanzado el límite de skips
      const MAX_SKIP_COUNT = 3
      const HOURS_BETWEEN_PROMPTS = 24

      if (profile.onboarding_skip_count >= MAX_SKIP_COUNT) {
        const lastSkip = new Date(profile.onboarding_last_skip_at)
        const now = new Date()
        const hoursSinceLastSkip = (now - lastSkip) / (1000 * 60 * 60)

        if (hoursSinceLastSkip < HOURS_BETWEEN_PROMPTS) {
          console.log(`\n⏸️  MODAL PAUSADO TEMPORALMENTE`)
          console.log(`   Ha saltado ${MAX_SKIP_COUNT} veces`)
          console.log(`   Debe esperar ${Math.round(HOURS_BETWEEN_PROMPTS - hoursSinceLastSkip)} horas más`)
          console.log(`   El modal volverá a aparecer después de 24h desde el último skip`)
        }
      }
    }

    // 6. Verificar perfil público
    const { data: publicProfile } = await supabase
      .from('public_user_profiles')
      .select('display_name')
      .eq('id', userId)
      .single()

    if (publicProfile?.display_name) {
      console.log(`\n👤 Display name: @${publicProfile.display_name}`)
    }

    // 7. Verificar actividad reciente
    const { data: recentTests } = await supabase
      .from('tests')
      .select('id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (recentTests && recentTests.length > 0) {
      const lastTest = recentTests[0]
      console.log(`\n📝 Último test: ${new Date(lastTest.created_at).toLocaleString('es-ES')}`)
    } else {
      console.log('\n📝 Sin tests realizados')
    }

    // 8. Diagnóstico final
    console.log('\n' + '='.repeat(70))
    console.log('\n💡 DIAGNÓSTICO FINAL:')
    console.log('='.repeat(70))

    if (!needsOnboarding) {
      console.log('\n✅ TODO CORRECTO')
      console.log('   El modal NO debe aparecer porque:')
      console.log('   - Todos los campos obligatorios están completos')
      console.log('   - El onboarding está marcado como completado')

      if (!profile.daily_study_hours) {
        console.log('   - daily_study_hours es NULL pero es OPCIONAL')
      }
    } else {
      console.log('\n🔴 EL MODAL DEBE APARECER')
      console.log('   Razón: Faltan campos obligatorios')

      if (camposCriticosFaltantes.includes('onboarding_completed_at')) {
        console.log('   → El usuario nunca completó el proceso')
      }

      if (camposCriticosFaltantes.includes('target_oposicion')) {
        console.log('   → No ha seleccionado oposición')
      }

      if (camposCriticosFaltantes.includes('age') || camposCriticosFaltantes.includes('gender')) {
        console.log('   → Faltan datos demográficos básicos')
      }

      if (camposCriticosFaltantes.includes('ciudad')) {
        console.log('   → No ha indicado su ciudad')
      }

      console.log('\n📝 PRÓXIMOS PASOS:')
      console.log('   1. El usuario debería ver el modal al iniciar sesión')
      console.log('   2. Completar los campos faltantes')
      console.log('   3. Hacer clic en "Finalizar" (no "Omitir")')
    }

    // Si el usuario cree que debería ver el modal pero no lo ve
    if (needsOnboarding) {
      console.log('\n🔍 Si NO ves el modal pero deberías:')
      console.log('   1. Limpia caché del navegador (Ctrl+F5)')
      console.log('   2. Prueba en modo incógnito')
      console.log('   3. Revisa la consola del navegador por errores')
      console.log('   4. Asegúrate de estar logueado correctamente')
    }

    console.log('\n' + '='.repeat(70))

  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

// Ejecutar con el email proporcionado
const email = process.argv[2] || 'rikseotools@gmail.com'
checkUserOnboarding(email)