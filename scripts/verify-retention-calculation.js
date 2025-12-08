// Script para verificar el cálculo de retention rate
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyRetentionCalculation() {
  console.log('🔍 VERIFICANDO CÁLCULO DE RETENTION RATE')
  console.log('=' . repeat(60))

  try {
    // 1. Obtener usuarios y tests
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(500)

    const { data: completedTests } = await supabase
      .from('tests')
      .select('user_id, completed_at')
      .eq('is_completed', true)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(5000)

    console.log(`Usuarios: ${users?.length || 0}`)
    console.log(`Tests completados: ${completedTests?.length || 0}`)

    // 2. Tomar una cohorte de ejemplo (usuarios registrados hace 30-40 días)
    const now = new Date()
    const cohortStart = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000)
    const cohortEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const cohortUsers = users?.filter(u => {
      const createdAt = new Date(u.created_at)
      return createdAt >= cohortStart && createdAt < cohortEnd
    }) || []

    console.log(`\nCohorte de ejemplo (registrados hace 30-40 días): ${cohortUsers.length} usuarios`)

    if (cohortUsers.length === 0) {
      console.log('No hay usuarios en esta cohorte')
      return
    }

    // 3. Analizar retención con diferentes métodos
    console.log('\n' + '='.repeat(60))
    console.log('COMPARACIÓN DE MÉTODOS DE CÁLCULO:')
    console.log('='.repeat(60))

    // Método actual (INCORRECTO)
    console.log('\n📊 MÉTODO ACTUAL (Rangos amplios):')
    console.log('-'.repeat(40))
    let currentMethod = {
      day1: 0,  // Día 1-2
      day7: 0,  // Día 2-7
      day30: 0  // Día 7-30
    }

    cohortUsers.forEach(user => {
      const registrationDate = new Date(user.created_at)
      const userTests = completedTests?.filter(t => t.user_id === user.id) || []

      // Day 1: día 1-2
      const day1Start = new Date(registrationDate.getTime() + 24 * 60 * 60 * 1000)
      const day1End = new Date(registrationDate.getTime() + 2 * 24 * 60 * 60 * 1000)
      const hasDay1 = userTests.some(t => {
        const testDate = new Date(t.completed_at)
        return testDate >= day1Start && testDate <= day1End
      })
      if (hasDay1) currentMethod.day1++

      // Day 7: día 2-7 (INCORRECTO)
      const day7Start = new Date(registrationDate.getTime() + 2 * 24 * 60 * 60 * 1000)
      const day7End = new Date(registrationDate.getTime() + 7 * 24 * 60 * 60 * 1000)
      const hasDay7 = userTests.some(t => {
        const testDate = new Date(t.completed_at)
        return testDate >= day7Start && testDate <= day7End
      })
      if (hasDay7) currentMethod.day7++

      // Day 30: día 7-30 (INCORRECTO)
      const day30Start = new Date(registrationDate.getTime() + 7 * 24 * 60 * 60 * 1000)
      const day30End = new Date(registrationDate.getTime() + 30 * 24 * 60 * 60 * 1000)
      const hasDay30 = userTests.some(t => {
        const testDate = new Date(t.completed_at)
        return testDate >= day30Start && testDate <= day30End
      })
      if (hasDay30) currentMethod.day30++
    })

    console.log(`Day 1 (actividad día 1-2): ${currentMethod.day1}/${cohortUsers.length} = ${Math.round(currentMethod.day1/cohortUsers.length*100)}%`)
    console.log(`Day 7 (actividad día 2-7): ${currentMethod.day7}/${cohortUsers.length} = ${Math.round(currentMethod.day7/cohortUsers.length*100)}%`)
    console.log(`Day 30 (actividad día 7-30): ${currentMethod.day30}/${cohortUsers.length} = ${Math.round(currentMethod.day30/cohortUsers.length*100)}%`)

    // Método correcto (ventanas específicas)
    console.log('\n✅ MÉTODO CORRECTO (Ventanas específicas):')
    console.log('-'.repeat(40))
    let correctMethod = {
      day1: 0,   // Día 1 (±0 días)
      day7: 0,   // Día 7 (±1 día)
      day30: 0   // Día 30 (±3 días)
    }

    cohortUsers.forEach(user => {
      const registrationDate = new Date(user.created_at)
      const userTests = completedTests?.filter(t => t.user_id === user.id) || []

      // Day 1: exactamente día 1
      const day1Start = new Date(registrationDate.getTime() + 1 * 24 * 60 * 60 * 1000)
      const day1End = new Date(registrationDate.getTime() + 2 * 24 * 60 * 60 * 1000)
      const hasDay1 = userTests.some(t => {
        const testDate = new Date(t.completed_at)
        return testDate >= day1Start && testDate < day1End
      })
      if (hasDay1) correctMethod.day1++

      // Day 7: día 6-8
      const day7Start = new Date(registrationDate.getTime() + 6 * 24 * 60 * 60 * 1000)
      const day7End = new Date(registrationDate.getTime() + 9 * 24 * 60 * 60 * 1000)
      const hasDay7 = userTests.some(t => {
        const testDate = new Date(t.completed_at)
        return testDate >= day7Start && testDate < day7End
      })
      if (hasDay7) correctMethod.day7++

      // Day 30: día 27-33
      const day30Start = new Date(registrationDate.getTime() + 27 * 24 * 60 * 60 * 1000)
      const day30End = new Date(registrationDate.getTime() + 33 * 24 * 60 * 60 * 1000)
      const hasDay30 = userTests.some(t => {
        const testDate = new Date(t.completed_at)
        return testDate >= day30Start && testDate < day30End
      })
      if (hasDay30) correctMethod.day30++
    })

    console.log(`Day 1 (día exacto 1): ${correctMethod.day1}/${cohortUsers.length} = ${Math.round(correctMethod.day1/cohortUsers.length*100)}%`)
    console.log(`Day 7 (días 6-8): ${correctMethod.day7}/${cohortUsers.length} = ${Math.round(correctMethod.day7/cohortUsers.length*100)}%`)
    console.log(`Day 30 (días 27-33): ${correctMethod.day30}/${cohortUsers.length} = ${Math.round(correctMethod.day30/cohortUsers.length*100)}%`)

    // Método clásico (rolling retention)
    console.log('\n📈 MÉTODO ROLLING (Cualquier actividad después del día X):')
    console.log('-'.repeat(40))
    let rollingMethod = {
      day1Plus: 0,   // Cualquier actividad después del día 1
      day7Plus: 0,   // Cualquier actividad después del día 7
      day30Plus: 0   // Cualquier actividad después del día 30
    }

    cohortUsers.forEach(user => {
      const registrationDate = new Date(user.created_at)
      const userTests = completedTests?.filter(t => t.user_id === user.id) || []

      // Day 1+: cualquier actividad después del día 1
      const day1Plus = new Date(registrationDate.getTime() + 1 * 24 * 60 * 60 * 1000)
      const hasDay1Plus = userTests.some(t => {
        const testDate = new Date(t.completed_at)
        return testDate >= day1Plus
      })
      if (hasDay1Plus) rollingMethod.day1Plus++

      // Day 7+: cualquier actividad después del día 7
      const day7Plus = new Date(registrationDate.getTime() + 7 * 24 * 60 * 60 * 1000)
      const hasDay7Plus = userTests.some(t => {
        const testDate = new Date(t.completed_at)
        return testDate >= day7Plus
      })
      if (hasDay7Plus) rollingMethod.day7Plus++

      // Day 30+: cualquier actividad después del día 30
      const day30Plus = new Date(registrationDate.getTime() + 30 * 24 * 60 * 60 * 1000)
      const hasDay30Plus = userTests.some(t => {
        const testDate = new Date(t.completed_at)
        return testDate >= day30Plus
      })
      if (hasDay30Plus) rollingMethod.day30Plus++
    })

    console.log(`Day 1+ (cualquier actividad después): ${rollingMethod.day1Plus}/${cohortUsers.length} = ${Math.round(rollingMethod.day1Plus/cohortUsers.length*100)}%`)
    console.log(`Day 7+ (cualquier actividad después): ${rollingMethod.day7Plus}/${cohortUsers.length} = ${Math.round(rollingMethod.day7Plus/cohortUsers.length*100)}%`)
    console.log(`Day 30+ (cualquier actividad después): ${rollingMethod.day30Plus}/${cohortUsers.length} = ${Math.round(rollingMethod.day30Plus/cohortUsers.length*100)}%`)

    // Resumen
    console.log('\n' + '='.repeat(60))
    console.log('📊 RESUMEN:')
    console.log('='.repeat(60))
    console.log('El método actual está mal porque:')
    console.log('- Day 7 busca en días 2-7 (no en el día 7 específico)')
    console.log('- Day 30 busca en días 7-30 (no en el día 30 específico)')
    console.log('- Esto infla artificialmente los números de retención')
    console.log('\nRecomendación: Usar el método CORRECTO con ventanas específicas')

  } catch (err) {
    console.error('❌ Error:', err)
  }
}

verifyRetentionCalculation()