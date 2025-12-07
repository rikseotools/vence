// Analizar estadísticas de múltiples usuarios para encontrar patrones
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function analyzeAllUsersStats() {
  console.log('📊 ANÁLISIS DE ESTADÍSTICAS DE MÚLTIPLES USUARIOS\n')
  console.log('='.repeat(60))

  // Obtener usuarios con más actividad reciente
  const { data: activeUsers } = await supabase
    .from('tests')
    .select('user_id')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .limit(20)

  if (!activeUsers || activeUsers.length === 0) {
    console.log('No se encontraron usuarios activos')
    return
  }

  // Eliminar duplicados
  const uniqueUserIds = [...new Set(activeUsers.map(u => u.user_id))]
  console.log(`Analizando ${uniqueUserIds.length} usuarios únicos...\n`)

  const userStats = []

  for (const userId of uniqueUserIds.slice(0, 10)) {
    // Obtener información básica del usuario
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()

    const displayName = profile?.display_name || 'Usuario anónimo'

    // Contar tests totales
    const { count: totalTests } = await supabase
      .from('tests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Obtener tests para verificar test_questions
    const { data: userTests } = await supabase
      .from('tests')
      .select('id')
      .eq('user_id', userId)
      .limit(10)

    let totalQuestions = 0
    let testsWithQuestions = 0
    let testsWithoutQuestions = 0

    if (userTests) {
      for (const test of userTests) {
        const { count } = await supabase
          .from('test_questions')
          .select('*', { count: 'exact', head: true })
          .eq('test_id', test.id)

        totalQuestions += count || 0
        if (count > 0) {
          testsWithQuestions++
        } else {
          testsWithoutQuestions++
        }
      }
    }

    // Verificar la función RPC
    const { data: rpcData } = await supabase.rpc('get_user_public_stats', {
      p_user_id: userId
    })

    const rpcStats = rpcData?.[0] || {}

    // Verificar UserAvatar query (simulada)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const { data: weekTests } = await supabase
      .from('tests')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', weekAgo.toISOString())

    let weeklyQuestions = 0
    if (weekTests?.length > 0) {
      const weekTestIds = weekTests.map(t => t.id)
      const { count } = await supabase
        .from('test_questions')
        .select('*', { count: 'exact', head: true })
        .in('test_id', weekTestIds)

      weeklyQuestions = count || 0
    }

    userStats.push({
      userId: userId.substring(0, 8) + '...',
      displayName,
      totalTests,
      totalQuestions,
      testsWithQuestions,
      testsWithoutQuestions,
      weeklyQuestions,
      rpcTotalQuestions: rpcStats.total_questions || 0,
      rpcAccuracy: rpcStats.global_accuracy || 0,
      hasDiscrepancy: (rpcStats.total_questions || 0) !== totalQuestions
    })
  }

  // Mostrar resultados en tabla
  console.log('\n📊 RESUMEN DE USUARIOS:\n')
  console.log('Usuario          | Tests | Q Total | Q Semana | RPC Q | Discrepancia')
  console.log('-'.repeat(70))

  userStats.forEach(user => {
    const disc = user.hasDiscrepancy ? '⚠️ SÍ' : '✅ NO'
    console.log(
      `${user.displayName.padEnd(15).substring(0, 15)} | ` +
      `${String(user.totalTests).padStart(5)} | ` +
      `${String(user.totalQuestions).padStart(7)} | ` +
      `${String(user.weeklyQuestions).padStart(8)} | ` +
      `${String(user.rpcTotalQuestions).padStart(5)} | ` +
      disc
    )
  })

  // Analizar patrones
  console.log('\n📈 ANÁLISIS DE PATRONES:')

  const withDiscrepancy = userStats.filter(u => u.hasDiscrepancy)
  const withoutDiscrepancy = userStats.filter(u => !u.hasDiscrepancy)

  console.log(`\n✅ Usuarios sin discrepancias: ${withoutDiscrepancy.length}`)
  console.log(`⚠️ Usuarios con discrepancias: ${withDiscrepancy.length}`)

  if (withDiscrepancy.length > 0) {
    console.log('\nUsuarios con problemas:')
    withDiscrepancy.forEach(user => {
      console.log(`  - ${user.displayName}: test_questions=${user.totalQuestions}, RPC=${user.rpcTotalQuestions}`)
    })
  }

  // Verificar fechas de migración
  console.log('\n📅 ANÁLISIS TEMPORAL:')

  for (const userId of uniqueUserIds.slice(0, 3)) {
    const { data: oldestTest } = await supabase
      .from('tests')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()

    if (oldestTest) {
      console.log(`${profile?.display_name || 'Anónimo'}: Primer test ${new Date(oldestTest.created_at).toLocaleDateString()}`)
    }
  }

  console.log('\n' + '='.repeat(60))

  // Conclusiones
  console.log('\n💡 CONCLUSIONES GENERALES:')
  console.log('1. Algunos usuarios tienen discrepancias entre test_questions y RPC')
  console.log('2. La RPC parece usar fuentes adicionales de datos')
  console.log('3. El UserAvatar solo usa test_questions, por eso muestra 0')
  console.log('4. Necesitamos sincronizar las fuentes de datos o usar la RPC en UserAvatar')
}

analyzeAllUsersStats().catch(console.error)