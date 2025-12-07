// Script para verificar el estado del onboarding de Nila
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkNilaOnboarding() {
  console.log('🔍 VERIFICANDO ONBOARDING DE NILA\n')
  console.log('=' .repeat(70))

  try {
    // 1. Buscar usuario Nila
    const { data: profiles } = await supabase
      .from('public_user_profiles')
      .select('id, display_name')
      .ilike('display_name', '%nila%')

    const nilaProfile = profiles?.find(p =>
      p.display_name?.toLowerCase().includes('nila')
    )

    if (!nilaProfile) {
      console.log('❌ Usuario Nila no encontrado en public_user_profiles')
      return
    }

    const userId = nilaProfile.id
    console.log('✅ Usuario encontrado:')
    console.log(`   Display name: ${nilaProfile.display_name}`)
    console.log(`   User ID: ${userId}\n`)

    // 2. Obtener datos completos del perfil
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('❌ Error obteniendo perfil:', error)
      return
    }

    // 3. Analizar campos de onboarding
    console.log('📊 ESTADO DE CAMPOS DE ONBOARDING:')
    console.log('-'.repeat(70))

    const requiredFields = {
      'target_oposicion': profile.target_oposicion,
      'target_oposicion_data': profile.target_oposicion_data,
      'age': profile.age,
      'gender': profile.gender,
      'daily_study_hours': profile.daily_study_hours,
      'ciudad': profile.ciudad,
      'onboarding_completed_at': profile.onboarding_completed_at
    }

    let missingFields = []
    let presentFields = []

    Object.entries(requiredFields).forEach(([field, value]) => {
      const status = value ? '✅' : '❌'
      const displayValue = value ?
        (typeof value === 'object' ? JSON.stringify(value) : value) :
        'NULL/undefined'

      console.log(`${status} ${field.padEnd(25)}: ${displayValue}`)

      if (!value) {
        missingFields.push(field)
      } else {
        presentFields.push(field)
      }
    })

    console.log('\n' + '='.repeat(70))

    // 4. Verificar la lógica del hook useOnboarding
    console.log('\n🔍 VERIFICACIÓN DE LÓGICA useOnboarding.js:')
    console.log('-'.repeat(70))

    // Esta es la misma lógica que usa useOnboarding.js línea 50-55
    // ACTUALIZADA: daily_study_hours ya no es obligatorio
    const needsOnboarding = !profile.target_oposicion ||
                           !profile.onboarding_completed_at ||
                           !profile.age ||
                           !profile.gender ||
                           // !profile.daily_study_hours || // OPCIONAL ahora
                           !profile.ciudad

    console.log(`needsOnboarding = ${needsOnboarding ? 'TRUE ❌' : 'FALSE ✅'}`)

    if (needsOnboarding) {
      console.log('\n⚠️  PROBLEMA IDENTIFICADO:')
      console.log('El modal se mostraría porque falta(n):')
      missingFields.forEach(field => {
        console.log(`   - ${field}`)
      })
    } else {
      console.log('\n✅ ONBOARDING COMPLETADO CORRECTAMENTE')
      console.log('El modal NO debería mostrarse')
    }

    // 5. Información adicional
    console.log('\n' + '='.repeat(70))
    console.log('\n📅 INFORMACIÓN ADICIONAL:')
    console.log('-'.repeat(70))

    if (profile.onboarding_completed_at) {
      const completedDate = new Date(profile.onboarding_completed_at)
      console.log(`Onboarding marcado como completado: ${completedDate.toLocaleString('es-ES')}`)

      // Verificar si fue marcado como completado pero faltan campos
      if (missingFields.length > 0) {
        console.log('\n🔴 BUG CRÍTICO DETECTADO:')
        console.log('   onboarding_completed_at está establecido PERO faltan campos obligatorios!')
        console.log('   Esto indica que el guardado falló parcialmente.')
      }
    }

    console.log(`\nCampos presentes: ${presentFields.length}/7`)
    console.log(`Campos faltantes: ${missingFields.length}/7`)

    // 6. Verificar datos de oposición si existen
    if (profile.target_oposicion_data) {
      console.log('\n📋 DATOS DE OPOSICIÓN:')
      console.log('-'.repeat(70))
      const oposData = typeof profile.target_oposicion_data === 'string' ?
        JSON.parse(profile.target_oposicion_data) :
        profile.target_oposicion_data

      console.log(JSON.stringify(oposData, null, 2))
    }

    // 7. Verificar contadores de skip
    console.log('\n🔄 CONTADORES DE SKIP:')
    console.log('-'.repeat(70))
    console.log(`Skip count: ${profile.onboarding_skip_count || 0}`)
    console.log(`Last skip: ${profile.onboarding_last_skip_at || 'Nunca'}`)

    // 8. Resumen y recomendaciones
    console.log('\n' + '='.repeat(70))
    console.log('\n💡 RESUMEN Y DIAGNÓSTICO:')
    console.log('='.repeat(70))

    if (needsOnboarding) {
      console.log('\n🔴 El modal de onboarding SE MOSTRARÁ porque:')

      if (missingFields.includes('onboarding_completed_at')) {
        console.log('   - El campo onboarding_completed_at es NULL')
        console.log('   → El usuario no completó el proceso')
      }

      if (missingFields.includes('target_oposicion')) {
        console.log('   - No se guardó la oposición seleccionada')
        console.log('   → Posible fallo en saveField() asíncrono')
      }

      if (missingFields.includes('age') || missingFields.includes('gender')) {
        console.log('   - Faltan datos demográficos básicos')
        console.log('   → El usuario podría haber saltado pasos')
      }

      if (missingFields.includes('ciudad')) {
        console.log('   - Falta la ciudad')
        console.log('   → Campo añadido recientemente, usuario antiguo')
      }

      console.log('\n🛠️  SOLUCIÓN RECOMENDADA:')
      console.log('   1. El usuario debe completar el modal nuevamente')
      console.log('   2. Verificar que todos los campos se guarden correctamente')
      console.log('   3. Si persiste, actualizar manualmente los campos NULL en BD')

      // Generar comando SQL de fix
      console.log('\n📝 COMANDO SQL PARA FIX MANUAL:')
      console.log('```sql')
      console.log(`UPDATE user_profiles`)
      console.log(`SET`)

      const updates = []
      if (!profile.target_oposicion) updates.push(`  target_oposicion = 'auxiliar-administrativo-estado'`)
      if (!profile.age) updates.push(`  age = 25`)
      if (!profile.gender) updates.push(`  gender = 'female'`)
      if (!profile.daily_study_hours) updates.push(`  daily_study_hours = '1-2'`)
      if (!profile.ciudad) updates.push(`  ciudad = 'Madrid'`)
      if (!profile.onboarding_completed_at) updates.push(`  onboarding_completed_at = NOW()`)

      console.log(updates.join(',\n'))
      console.log(`WHERE id = '${userId}';`)
      console.log('```')

    } else {
      console.log('\n✅ El onboarding está COMPLETO')
      console.log('   Todos los campos obligatorios tienen valores')
      console.log('   El modal NO debería mostrarse')
      console.log('\n   Si el usuario reporta que sigue viendo el modal:')
      console.log('   → Podría ser un problema de cache del navegador')
      console.log('   → Pedir que limpie cache y cookies')
      console.log('   → O usar modo incógnito para verificar')
    }

    console.log('\n' + '='.repeat(70))

  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

checkNilaOnboarding()