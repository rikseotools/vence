// app/admin/page.js - Dashboard con cálculos corregidos
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'
import AdminNotificationBadge from '@/components/AdminNotificationBadge'
import AdminActivityChart from '@/components/AdminActivityChart'

export default function AdminDashboard() {
  const { supabase } = useAuth()
  const adminNotifications = useAdminNotifications()
  const [stats, setStats] = useState(null)
  const [emailStats, setEmailStats] = useState(null)
  const [users, setUsers] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Cargar estadísticas principales
  useEffect(() => {
    async function loadDashboardData() {
      if (!supabase) return

      try {
        setLoading(true)
        console.log('📊 Cargando datos del dashboard...')

        // 1. Estadísticas generales de usuarios - CORREGIDO: usar vista admin
        const { data: generalStats, error: generalStatsError } = await supabase
          .from('admin_users_with_roles')
          .select('user_id, is_active_student, user_created_at, registration_source')

        if (generalStatsError) throw generalStatsError

        // 2. Tests completados últimos 30 días - Ordenados por fecha
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const { data: recentTests, error: testsError } = await supabase
          .from('tests')
          .select('id, is_completed, created_at, completed_at, user_id, score, total_questions, test_type, test_url, tema_number')
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false }) // Más recientes primero
          .limit(5000) // Obtener hasta 5000 tests

        if (testsError) throw testsError

        // 2c. Tests completados últimos 15 días - Para comparar tendencias
        const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
        const { data: recentTests15Days, error: tests15Error } = await supabase
          .from('tests')
          .select('id, is_completed, created_at, completed_at, user_id, score, total_questions, test_type, test_url, tema_number')
          .gte('created_at', fifteenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(5000)

        if (tests15Error) throw tests15Error

        // 2b. NUEVO: Usar RPC para obtener estadísticas reales sin límites
        console.log('🔍 FETCH: Obteniendo estadísticas del dashboard vía RPC...')
        const { data: dashboardStats, error: dashboardRpcError } = await supabase
          .rpc('get_dashboard_stats')

        if (dashboardRpcError) {
          console.error('❌ Error obteniendo estadísticas:', dashboardRpcError)
          throw dashboardRpcError
        }

        console.log('✅ Estadísticas del dashboard:', dashboardStats)

        // Para mantener compatibilidad, crear un array fake con los user_ids
        // (solo para que el resto del código funcione)
        const allCompletedTests = dashboardStats?.[0]?.users_with_tests ?
          Array(dashboardStats[0].users_with_tests).fill({}).map((_, i) => ({
            user_id: `user_${i}`
          })) : []

        // 3. Estadísticas de emails de esta semana (desde el lunes)
        const now = new Date()
        const currentDayOfWeek = now.getDay() // 0 = domingo, 1 = lunes, etc.
        const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1 // Convertir domingo a 6
        const thisMonday = new Date(now)
        thisMonday.setDate(now.getDate() - daysFromMonday)
        thisMonday.setHours(0, 0, 0, 0) // Inicio del lunes
        
        const { data: emailData, error: emailError } = await supabase
          .from('email_logs')
          .select('email_type, status, sent_at, opened_at, clicked_at')
          .gte('sent_at', thisMonday.toISOString())

        if (emailError) throw emailError

        // 4. Usuarios con roles y actividad reciente (solo primeros 10)
        const { data: usersData, error: usersError } = await supabase
          .from('admin_users_with_roles')
          .select('*')
          .order('user_created_at', { ascending: false })
          .limit(10)

        if (usersError) throw usersError

        // 5. Tests completados HOY - Usar zona horaria de Madrid
        console.log('🕐 Consultando tests de hoy...')

        // Calcular inicio del día en Madrid (00:00:00 Madrid = 23:00:00 UTC del día anterior)
        const nowMadrid = new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' })
        const madridDate = new Date(nowMadrid)
        const startOfDayMadrid = new Date(madridDate)
        startOfDayMadrid.setHours(0, 0, 0, 0)

        console.log('📅 Fecha Madrid:', madridDate.toLocaleDateString('es-ES'))
        console.log('🕐 Inicio día Madrid (UTC):', startOfDayMadrid.toISOString())

        const { data: todayTests, error: todayTestsError } = await supabase
          .from('tests')
          .select('id, completed_at, score, total_questions, user_id, created_at')
          .eq('is_completed', true)
          .gte('created_at', startOfDayMadrid.toISOString())
          .order('completed_at', { ascending: false })

        if (todayTestsError) {
          console.error('❌ Error consultando tests de hoy:', todayTestsError)
          throw todayTestsError
        }

        // 6. Hacer JOIN con user_profiles (TODOS los usuarios, no solo admins)
        let finalTodayActivity = []

        if (todayTests && todayTests.length > 0) {
          const userIds = [...new Set(todayTests.map(t => t.user_id))]
          console.log('🔍 Buscando perfiles de usuario para:', userIds)

          const { data: userProfiles, error: userProfilesError } = await supabase
            .from('user_profiles')
            .select('id, full_name, email')
            .in('id', userIds)

          if (userProfilesError) {
            console.error('❌ Error cargando perfiles:', userProfilesError)
            finalTodayActivity = todayTests.map(test => ({ ...test, user_profiles: null }))
          } else {
            console.log('✅ Perfiles encontrados:', userProfiles?.length)
            finalTodayActivity = todayTests.map(test => {
              const profile = userProfiles?.find(p => p.id === test.user_id)
              return {
                ...test,
                user_profiles: profile ? { full_name: profile.full_name, email: profile.email } : null
              }
            })
          }
        } else {
          finalTodayActivity = []
        }
        console.log('🔍 DEBUG: Final activity array length:', finalTodayActivity.length)
        console.log('🔍 DEBUG: Final activity estructura completa:', finalTodayActivity)
        
        const processedStats = processStatistics(generalStats, recentTests, finalTodayActivity, allCompletedTests, dashboardStats, recentTests15Days)
        const processedEmailStats = processEmailStatistics(emailData)

        setStats(processedStats)
        setEmailStats(processedEmailStats)
        setUsers(usersData || [])
        setRecentActivity(finalTodayActivity)

        console.log('✅ Dashboard cargado:', processedStats)
        console.log('📅 Tests hoy encontrados:', finalTodayActivity?.length || 0)
        console.log('🔍 Raw finalTodayActivity data:', finalTodayActivity)
        console.log('📅 Fecha de hoy calculada:', new Date().toISOString().split('T')[0])
        console.log('👥 Usuarios encontrados:', generalStats?.length || 0)
        
        // 🔍 DEBUG: Ver estructura de cada test de hoy DESPUÉS de combinar
        if (finalTodayActivity?.length > 0) {
          console.log('🔍 DEBUG: Estructura del primer test FINAL:', finalTodayActivity[0])
          console.log('🔍 DEBUG: user_profiles del primer test FINAL:', finalTodayActivity[0]?.user_profiles)
          console.log('🔍 DEBUG: Full name encontrado FINAL:', finalTodayActivity[0]?.user_profiles?.full_name)
        }

      } catch (err) {
        console.error('❌ Error cargando dashboard:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [supabase])

  function processStatistics(users, tests, todayTests, allCompletedTests, dashboardStats, tests15Days) {
    console.log('🔍 Procesando estadísticas RAW:')
    console.log('- users array:', users)
    console.log('- tests array:', tests)
    console.log('- todayTests array:', todayTests)
    console.log('- allCompletedTests array:', allCompletedTests?.length)
    console.log('- dashboardStats:', dashboardStats)
    console.log('- tests15Days array:', tests15Days?.length)

    // Usar datos del RPC para estadísticas principales
    const totalUsers = dashboardStats?.[0]?.total_users || users?.length || 0
    const usersWhoCompletedTests = dashboardStats?.[0]?.users_with_tests || 0
    const engagementRate = dashboardStats?.[0]?.engagement_percentage || 0

    const activeUsers = users?.filter(u => u.is_active_student).length || 0

    // Filtrar solo tests válidos y completados - CORREGIDO PARA SCORES COMO PORCENTAJE
    const validCompletedTests = (tests || []).filter(t =>
      t.is_completed === true &&
      t.completed_at &&
      t.score !== null &&
      t.total_questions > 0 &&
      !isNaN(t.score) &&
      !isNaN(t.total_questions) &&
      t.score >= 0  // Solo verificamos que score sea positivo, no que sea <= total_questions
    )

    console.log('✅ Tests válidos completados:', validCompletedTests.length)
    console.log('📊 Sample test:', validCompletedTests[0])

    // Para estadísticas de 30 días (mantener para otras métricas)
    const existingUserIds = new Set(users.map(u => u.user_id)) // CORREGIDO: usar user_id de la vista admin
    const userIdsFromRecentTests = new Set(validCompletedTests.map(t => t.user_id))
    
    console.log(`🎯 Engagement CORREGIDO (desde RPC):`)
    console.log(`- Usuarios únicos en últimos 30 días: ${userIdsFromRecentTests.size}`)
    console.log(`- Usuarios existentes: ${existingUserIds.size}`)
    console.log(`- Usuarios que completaron tests (desde RPC): ${usersWhoCompletedTests}`)
    console.log(`- Total usuarios (desde RPC): ${totalUsers}`)
    console.log(`- Engagement final (desde RPC): ${engagementRate}%`)
    
    // Cálculo de semana actual (lunes a domingo)
    const now = new Date()
    const weekDayOfWeek = now.getDay() // 0 = domingo, 1 = lunes, etc.
    const daysFromMonday = weekDayOfWeek === 0 ? 6 : weekDayOfWeek - 1 // Convertir domingo a 6
    const thisMonday = new Date(now)
    thisMonday.setDate(now.getDate() - daysFromMonday)
    thisMonday.setHours(0, 0, 0, 0) // Inicio del lunes
    
    // Usuarios nuevos en la semana actual (desde el lunes)
    const newUsersThisWeek = users?.filter(u => {
      const userDate = new Date(u.user_created_at)
      return userDate >= thisMonday
    }).length || 0

    // 📊 NUEVO: Desglose por fuente de registro (esta semana)
    const usersThisWeek = users?.filter(u => {
      const userDate = new Date(u.user_created_at)
      return userDate >= thisMonday
    }) || []
    
    console.log('🔍 DEBUG - Usuarios esta semana:', usersThisWeek.length)
    console.log('🔍 DEBUG - Primer usuario esta semana:', usersThisWeek[0])
    
    const newUsersThisWeekBySource = usersThisWeek.reduce((acc, user) => {
      const source = user.registration_source || 'unknown'
      acc[source] = (acc[source] || 0) + 1
      return acc
    }, {})
    
    console.log('🔍 DEBUG - newUsersThisWeekBySource calculado:', newUsersThisWeekBySource)

    // Análisis de tests
    const abandonedTests = tests?.filter(t => !t.is_completed) || []
    
    // Tests completados HOY (ya filtrados en la query)
    const testsCompletedToday = todayTests?.length || 0

    // Tests de esta semana (desde el lunes)
    const testsThisWeek = validCompletedTests.filter(t => {
      const testDate = new Date(t.completed_at)
      return testDate >= thisMonday
    }).length

    const testsLast30Days = validCompletedTests.length

    // 📊 NUEVO: Desglose por modo (práctica vs examen) y tipo (aleatorio vs tema)
    const testsByMode = {
      practice: validCompletedTests.filter(t => t.test_type === 'practice').length,
      exam: validCompletedTests.filter(t => t.test_type === 'exam').length
    }

    // Desglose por tipo de estudio (usando test_url y tema_number)
    const testsByStudyType = {
      aleatorio: validCompletedTests.filter(t =>
        t.test_url?.includes('/test-aleatorio') ||
        t.test_url?.includes('/test/rapido')
      ).length,
      porTema: validCompletedTests.filter(t =>
        t.tema_number !== null && t.tema_number !== undefined
      ).length,
      porLey: validCompletedTests.filter(t =>
        t.test_url?.includes('/leyes/')
      ).length,
      personalizado: validCompletedTests.filter(t =>
        t.test_url?.includes('/test-personalizado') &&
        !t.tema_number
      ).length
    }

    console.log('📊 Desglose por modo (30 días):', testsByMode)
    console.log('📊 Desglose por tipo de estudio (30 días):', testsByStudyType)

    // 📊 NUEVO: Desglose para últimos 15 días (para comparar tendencias)
    const validCompletedTests15Days = (tests15Days || []).filter(t =>
      t.is_completed === true &&
      t.completed_at &&
      t.score !== null &&
      t.total_questions > 0 &&
      !isNaN(t.score) &&
      !isNaN(t.total_questions) &&
      Number(t.total_questions) > 0
    )

    const testsLast15Days = validCompletedTests15Days.length

    const testsByMode15Days = {
      practice: validCompletedTests15Days.filter(t => t.test_type === 'practice').length,
      exam: validCompletedTests15Days.filter(t => t.test_type === 'exam').length
    }

    const testsByStudyType15Days = {
      aleatorio: validCompletedTests15Days.filter(t =>
        t.test_url?.includes('/test-aleatorio') ||
        t.test_url?.includes('/test/rapido')
      ).length,
      porTema: validCompletedTests15Days.filter(t =>
        t.tema_number !== null && t.tema_number !== undefined
      ).length,
      porLey: validCompletedTests15Days.filter(t =>
        t.test_url?.includes('/leyes/')
      ).length,
      personalizado: validCompletedTests15Days.filter(t =>
        t.test_url?.includes('/test-personalizado') &&
        !t.tema_number
      ).length
    }

    console.log('📊 Desglose por modo (15 días):', testsByMode15Days)
    console.log('📊 Desglose por tipo de estudio (15 días):', testsByStudyType15Days)

    // Análisis de rendimiento SUPER CORREGIDO - SCORE ES PORCENTAJE
    let averageAccuracy = 0
    if (validCompletedTests.length > 0) {
      console.log('📊 Calculando precisión de', validCompletedTests.length, 'tests válidos')
      console.log('🚨 IMPORTANTE: score parece ser PORCENTAJE, no número de respuestas correctas')
      
      let totalAccuracy = 0
      let validTestsCount = 0
      
      validCompletedTests.forEach((test, index) => {
        const score = Number(test.score)
        const totalQuestions = Number(test.total_questions)
        
        // NUEVA LÓGICA: Si score > total_questions, asumimos que score ES EL PORCENTAJE
        if (totalQuestions > 0 && score >= 0) {
          let accuracy
          
          if (score <= totalQuestions) {
            // Score es número de respuestas correctas
            accuracy = (score / totalQuestions) * 100
          } else {
            // Score es porcentaje (como 72, 88, 95, etc.)
            accuracy = score
          }
          
          // Clamp accuracy entre 0-100%
          accuracy = Math.min(100, Math.max(0, accuracy))
          
          totalAccuracy += accuracy
          validTestsCount++
          
          if (index < 3) { // Log primeros 3 para debug
            console.log(`Test ${index + 1}: score=${score}, total=${totalQuestions} → ${accuracy.toFixed(1)}%`)
          }
        } else {
          console.warn(`❌ Test inválido: score=${score}, total=${totalQuestions}`)
        }
      })
      
      if (validTestsCount > 0) {
        averageAccuracy = Math.round(totalAccuracy / validTestsCount)
        averageAccuracy = Math.min(100, Math.max(0, averageAccuracy)) // Clamp final
      }
      
      console.log(`🏆 Precisión final: ${averageAccuracy}% (de ${validTestsCount} tests válidos)`)
    }

    // Tasa de finalización
    const totalAttempts = tests?.length || 0
    const completionRate = totalAttempts > 0 ? 
      Math.min(100, Math.max(0, Math.round((validCompletedTests.length / totalAttempts) * 100))) : 0

    // Usuarios únicos activos esta semana - CORREGIDO
    const activeUsersThisWeekIds = new Set(
      validCompletedTests
        .filter(t => {
          const testDate = new Date(t.completed_at)
          return testDate >= thisMonday
        })
        .map(t => t.user_id)
        .filter(userId => existingUserIds.has(userId)) // Solo usuarios que existen
    )
    
    const activeUsersLast30DaysIds = new Set(
      validCompletedTests
        .map(t => t.user_id)
        .filter(userId => existingUserIds.has(userId)) // Solo usuarios que existen
    )

    const activeUsersThisWeek = activeUsersThisWeekIds.size
    const activeUsersLast30Days = activeUsersLast30DaysIds.size

    // 📊 CÁLCULO DAU/MAU para engagement
    // DAU = Promedio de usuarios únicos que completaron tests en los últimos 7 días
    const last7DaysTests = validCompletedTests.filter(t => {
      const testDate = new Date(t.completed_at)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      return testDate >= sevenDaysAgo
    })
    
    // Calcular usuarios únicos por día en los últimos 7 días
    const dailyActiveUsers = {}
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateKey = date.toISOString().split('T')[0]
      dailyActiveUsers[dateKey] = new Set()
    }
    
    last7DaysTests.forEach(test => {
      const testDate = new Date(test.completed_at)
      const dateKey = testDate.toISOString().split('T')[0]
      if (dailyActiveUsers[dateKey] && existingUserIds.has(test.user_id)) {
        dailyActiveUsers[dateKey].add(test.user_id)
      }
    })
    
    // Promedio de DAU en los últimos 7 días
    const dailyActiveUsersArray = Object.values(dailyActiveUsers).map(set => set.size)
    const averageDAU = dailyActiveUsersArray.length > 0 ? 
      Math.round(dailyActiveUsersArray.reduce((sum, dau) => sum + dau, 0) / dailyActiveUsersArray.length) : 0
    
    // MAU = Usuarios activos en los últimos 30 días
    const MAU = activeUsersLast30Days
    
    // Ratio DAU/MAU como porcentaje
    const dauMauRatio = MAU > 0 ? Math.round((averageDAU / MAU) * 100) : 0

    // 📊 DATOS HISTÓRICOS DAU/MAU (últimos 30 días)
    const dauMauHistory = []
    const today = new Date()
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      const dateKey = date.toISOString().split('T')[0]
      
      // DAU para este día específico
      const dayTests = validCompletedTests.filter(t => {
        const testDate = new Date(t.completed_at)
        return testDate.toISOString().split('T')[0] === dateKey
      })
      const dayActiveUsers = new Set(dayTests.map(t => t.user_id)).size
      
      // MAU para este período (30 días hacia atrás desde esta fecha)
      const mauStartDate = new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000)
      const periodTests = validCompletedTests.filter(t => {
        const testDate = new Date(t.completed_at)
        return testDate >= mauStartDate && testDate <= date
      })
      const periodMAU = new Set(periodTests.map(t => t.user_id)).size
      
      // Calcular ratio para este día
      const dayDauMauRatio = periodMAU > 0 ? Math.round((dayActiveUsers / periodMAU) * 100) : 0
      
      dauMauHistory.push({
        date: dateKey,
        dau: dayActiveUsers,
        mau: periodMAU,
        ratio: dayDauMauRatio,
        formattedDate: date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
      })
    }

    // 📈 PROYECCIÓN ANUAL basada en crecimiento semanal CORREGIDO
    const currentDate = new Date()
    const projectionDayOfWeek = currentDate.getDay() // 0 = domingo, 1 = lunes, etc.
    const daysPassedThisWeek = projectionDayOfWeek === 0 ? 7 : projectionDayOfWeek // Domingo cuenta como 7
    
    // Calcular promedio diario de esta semana parcial
    const averageUsersPerDay = daysPassedThisWeek > 0 ? newUsersThisWeek / daysPassedThisWeek : 0
    
    // Proyectar a semana completa (7 días) y luego a año (52 semanas)
    const projectedUsersPerWeek = averageUsersPerDay * 7
    const projectedUsersNextYear = projectedUsersPerWeek > 0 ? 
      totalUsers + Math.round(projectedUsersPerWeek * 52) : totalUsers

    const result = {
      totalUsers,
      activeUsers,
      engagementRate,
      testsCompletedToday,
      testsThisWeek,
      testsLast30Days,
      averageAccuracy,
      completionRate,
      activeUsersThisWeek,
      activeUsersLast30Days,
      newUsersThisWeek,
      newUsersThisWeekBySource, // 📊 NUEVO: Desglose por fuente
      abandonedTests: abandonedTests.length,
      totalTestsAttempted: totalAttempts,
      usersWhoCompletedTests,
      // 📊 NUEVO: Métricas DAU/MAU
      averageDAU,
      MAU,
      dauMauRatio,
      dauMauHistory,
      // 📈 NUEVO: Proyección anual
      projectedUsersNextYear,
      averageUsersPerDay,
      projectedUsersPerWeek,
      daysPassedThisWeek,
      // 📊 NUEVO: Desglose por modo de test (30 días)
      testsByMode,
      testsByStudyType,
      // 📊 NUEVO: Desglose para comparar tendencias (15 días)
      testsLast15Days,
      testsByMode15Days,
      testsByStudyType15Days
    }

    console.log('📊 ESTADÍSTICAS FINALES:', result)
    console.log('📊 DEBUG - newUsersThisWeekBySource:', newUsersThisWeekBySource)
    
    // Validación final
    if (result.engagementRate > 100 || result.averageAccuracy > 100) {
      console.error('❌ ESTADÍSTICAS INVÁLIDAS DETECTADAS:', result)
    }
    
    return result
  }

  function processEmailStatistics(emails) {
    if (!emails || emails.length === 0) {
      return {
        totalSent: 0,
        totalOpened: 0,
        totalClicked: 0,
        openRate: 0,
        clickRate: 0,
        byType: {}
      }
    }

    const totalSent = emails.length
    const totalOpened = emails.filter(e => e.opened_at).length
    const totalClicked = emails.filter(e => e.clicked_at).length
    
    const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0
    const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0

    // Estadísticas por tipo
    const byType = {}
    emails.forEach(email => {
      const type = email.email_type
      if (!byType[type]) {
        byType[type] = {
          sent: 0,
          opened: 0,
          clicked: 0,
          name: getEmailTypeName(type)
        }
      }
      byType[type].sent++
      if (email.opened_at) byType[type].opened++
      if (email.clicked_at) byType[type].clicked++
    })

    // Calcular tasas por tipo
    Object.keys(byType).forEach(type => {
      const stats = byType[type]
      stats.openRate = stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0
      stats.clickRate = stats.sent > 0 ? Math.round((stats.clicked / stats.sent) * 100) : 0
    })

    return {
      totalSent,
      totalOpened,
      totalClicked,
      openRate,
      clickRate,
      byType
    }
  }

  function getEmailTypeName(type) {
    const names = {
      'bienvenida_inmediato': 'Bienvenida',
      'reactivacion': 'Reactivación',
      'urgente': 'Urgente',
      'bienvenida_motivacional': 'Motivacional'
    }
    return names[type] || type
  }

  function formatTimeAgo(dateString) {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now - date) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Ahora'
    if (diffInMinutes < 60) return `${diffInMinutes}m`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h`
    
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays}d`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">📊 Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          Error cargando dashboard
        </h3>
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        <p className="text-red-500 dark:text-red-300 text-xs mt-2">
          💡 Desliza hacia abajo para actualizar
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            📊 Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
            Resumen de la plataforma Vence
          </p>
        </div>
        <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Actualizado: {new Date().toLocaleString('es-ES', { 
            day: '2-digit', 
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>

      {/* Métricas principales - Mobile responsive */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          
          {/* Total de usuarios */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 border">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
                  Total Usuarios
                </p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.totalUsers}</p>
                <div className="text-xs text-green-600 mt-1">
                  <div>+{stats.newUsersThisWeek} esta semana</div>
                  <div className="text-xs text-gray-700 dark:text-gray-300 mt-1 font-medium">
                    🌱 {stats.newUsersThisWeekBySource?.organic || 0} Orgánico • 💰 {stats.newUsersThisWeekBySource?.google_ads || 0} Google • 📘 {stats.newUsersThisWeekBySource?.meta_ads || 0} Meta
                  </div>
                  {stats.newUsersThisWeek > 0 && (
                    <div className="text-xs text-purple-600 mt-2 font-medium">
                      📈 Proyección a un año: ~{stats.projectedUsersNextYear.toLocaleString()} usuarios
                      <br />
                      <span className="text-xs text-gray-500">
                        ({stats.averageUsersPerDay.toFixed(1)}/día × 365 días)
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg sm:text-2xl">👥</span>
              </div>
            </div>
          </div>

          {/* Engagement Rate - CON EXPLICACIÓN */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 border">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
                  Usuarios Activos
                </p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.engagementRate}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.usersWhoCompletedTests}/{stats.totalUsers} han completado algún test
                </p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg sm:text-2xl">🎯</span>
              </div>
            </div>
          </div>

          {/* Tests hoy - CORREGIDO: Mostrar actividad coherente */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 border">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
                  Tests Completos Hoy
                </p>
                <p className="text-xl sm:text-2xl font-bold text-purple-600">{stats.testsCompletedToday}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.testsCompletedToday > 0
                    ? (() => {
                        const activeUsers = recentActivity.map(a => a.user_profiles?.full_name?.split(' ')[0] || a.user_profiles?.email?.split('@')[0] || 'Usuario anónimo')
                        const uniqueUsers = [...new Set(activeUsers)]
                        const first2 = uniqueUsers.slice(0, 2).join(', ')
                        const remaining = uniqueUsers.length - 2
                        return remaining > 0 ? `Por ${first2} y ${remaining} más` : `Por ${first2}`
                      })()
                    : 'Ninguno completado'
                  }
                </p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg sm:text-2xl">✅</span>
              </div>
            </div>
          </div>

          {/* Precisión promedio - CORREGIDA */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 border">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
                  Precisión Promedio
                </p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.averageAccuracy}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.completionRate}% de los tests iniciados se completan
                </p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg sm:text-2xl">🏆</span>
              </div>
            </div>
          </div>


        </div>
      )}


      {/* Métricas de actividad y emails - Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Actividad de usuarios */}
        {stats && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📈 Actividad de Usuarios
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Usuarios con tests (total histórico):</span>
                <span className="text-base sm:text-lg font-semibold text-blue-600">{stats.usersWhoCompletedTests}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Activos esta semana:</span>
                <span className="text-base sm:text-lg font-semibold text-green-600">{stats.activeUsersThisWeek}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tests completados (30 días):</span>
                <span className="text-base sm:text-lg font-semibold text-purple-600">{stats.testsLast30Days}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tests abandonados:</span>
                <span className="text-base sm:text-lg font-semibold text-red-600">{stats.abandonedTests}</span>
              </div>
            </div>

            {/* Desglose de tests completados - Comparación 15 vs 30 días */}
            {stats.testsByMode && stats.testsByStudyType && stats.testsByMode15Days && stats.testsByStudyType15Days && (
              <div className="mt-4 space-y-3">
                {/* Modo de tests - Comparación */}
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-xs font-semibold text-green-800 dark:text-green-200 mb-2">
                    📝 Modo de tests completados:
                  </p>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs text-green-700 dark:text-green-300">
                      <div className="text-center font-semibold pb-1 border-b border-green-300 dark:border-green-700">15 días</div>
                      <div className="text-center font-semibold pb-1 border-b border-green-300 dark:border-green-700">30 días</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-xs text-green-700 dark:text-green-300">
                        <div className="flex justify-between">
                          <span>Práctica:</span>
                          <span className="font-semibold">{stats.testsByMode15Days.practice} ({stats.testsLast15Days > 0 ? Math.round((stats.testsByMode15Days.practice / stats.testsLast15Days) * 100) : 0}%)</span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span>Examen:</span>
                          <span className="font-semibold">{stats.testsByMode15Days.exam} ({stats.testsLast15Days > 0 ? Math.round((stats.testsByMode15Days.exam / stats.testsLast15Days) * 100) : 0}%)</span>
                        </div>
                      </div>
                      <div className="text-xs text-green-700 dark:text-green-300">
                        <div className="flex justify-between">
                          <span>Práctica:</span>
                          <span className="font-semibold">{stats.testsByMode.practice} ({Math.round((stats.testsByMode.practice / stats.testsLast30Days) * 100)}%)</span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span>Examen:</span>
                          <span className="font-semibold">{stats.testsByMode.exam} ({Math.round((stats.testsByMode.exam / stats.testsLast30Days) * 100)}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tipo de estudio - Comparación */}
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-xs font-semibold text-purple-800 dark:text-purple-200 mb-2">
                    📚 Tipo de estudio:
                  </p>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs text-purple-700 dark:text-purple-300">
                      <div className="text-center font-semibold pb-1 border-b border-purple-300 dark:border-purple-700">15 días</div>
                      <div className="text-center font-semibold pb-1 border-b border-purple-300 dark:border-purple-700">30 días</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-xs text-purple-700 dark:text-purple-300 space-y-1">
                        <div className="flex justify-between">
                          <span>Por tema:</span>
                          <span className="font-semibold">{stats.testsByStudyType15Days.porTema} ({stats.testsLast15Days > 0 ? Math.round((stats.testsByStudyType15Days.porTema / stats.testsLast15Days) * 100) : 0}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Aleatorio:</span>
                          <span className="font-semibold">{stats.testsByStudyType15Days.aleatorio} ({stats.testsLast15Days > 0 ? Math.round((stats.testsByStudyType15Days.aleatorio / stats.testsLast15Days) * 100) : 0}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Por ley:</span>
                          <span className="font-semibold">{stats.testsByStudyType15Days.porLey} ({stats.testsLast15Days > 0 ? Math.round((stats.testsByStudyType15Days.porLey / stats.testsLast15Days) * 100) : 0}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Personalizado:</span>
                          <span className="font-semibold">{stats.testsByStudyType15Days.personalizado} ({stats.testsLast15Days > 0 ? Math.round((stats.testsByStudyType15Days.personalizado / stats.testsLast15Days) * 100) : 0}%)</span>
                        </div>
                      </div>
                      <div className="text-xs text-purple-700 dark:text-purple-300 space-y-1">
                        <div className="flex justify-between">
                          <span>Por tema:</span>
                          <span className="font-semibold">{stats.testsByStudyType.porTema} ({Math.round((stats.testsByStudyType.porTema / stats.testsLast30Days) * 100)}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Aleatorio:</span>
                          <span className="font-semibold">{stats.testsByStudyType.aleatorio} ({Math.round((stats.testsByStudyType.aleatorio / stats.testsLast30Days) * 100)}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Por ley:</span>
                          <span className="font-semibold">{stats.testsByStudyType.porLey} ({Math.round((stats.testsByStudyType.porLey / stats.testsLast30Days) * 100)}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Personalizado:</span>
                          <span className="font-semibold">{stats.testsByStudyType.personalizado} ({Math.round((stats.testsByStudyType.personalizado / stats.testsLast30Days) * 100)}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
                📊 <strong>Tasa de finalización:</strong> {stats.completionRate}% de tests se completan
              </p>
            </div>
          </div>
        )}

        {/* Estadísticas de emails - Responsive */}
        {emailStats && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📧 Emails (esta semana)
            </h3>
            
            {emailStats.totalSent > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg sm:text-2xl font-bold text-blue-600">{emailStats.totalSent}</div>
                    <div className="text-xs text-gray-600">Enviados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg sm:text-2xl font-bold text-green-600">{emailStats.openRate}%</div>
                    <div className="text-xs text-gray-600">Abiertos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg sm:text-2xl font-bold text-purple-600">{emailStats.clickRate}%</div>
                    <div className="text-xs text-gray-600">Clicks</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {Object.entries(emailStats.byType).map(([type, stats]) => (
                    <div key={type} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <span className="text-sm font-medium mb-1 sm:mb-0">{stats.name}</span>
                      <div className="flex space-x-2 sm:space-x-3 text-xs sm:text-sm">
                        <span className="text-blue-600">{stats.sent} env.</span>
                        <span className="text-green-600">{stats.openRate}% ab.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="text-3xl sm:text-4xl mb-2">📭</div>
                <p className="text-gray-500 text-sm">Sin emails esta semana</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Gráfico de evolución temporal - Ancho completo */}
      <AdminActivityChart />

      {/* Gestión de Feedback e Impugnaciones - Movido arriba para mayor visibilidad */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
          💬 Feedback e Impugnaciones
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <AdminNotificationBadge count={adminNotifications?.feedback}>
            <a 
              href="/admin/feedback"
              className={`block bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-3 sm:p-4 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors ${
                adminNotifications?.feedback > 0 ? 'ring-2 ring-red-400 ring-opacity-50 animate-pulse' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl sm:text-2xl">💬</span>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-cyan-900 dark:text-cyan-100 text-sm sm:text-base">Feedback</h4>
                    {adminNotifications?.feedback > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                        {adminNotifications?.feedback} pendientes
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-cyan-600 dark:text-cyan-400">Gestionar comentarios</p>
                </div>
              </div>
            </a>
          </AdminNotificationBadge>

          <AdminNotificationBadge count={adminNotifications?.impugnaciones}>
            <a 
              href="/admin/impugnaciones"
              className={`block bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 sm:p-4 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors ${
                adminNotifications?.impugnaciones > 0 ? 'ring-2 ring-red-400 ring-opacity-50 animate-pulse' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl sm:text-2xl">📋</span>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-orange-900 dark:text-orange-100 text-sm sm:text-base">Impugnaciones</h4>
                    {adminNotifications?.impugnaciones > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                        {adminNotifications?.impugnaciones} pendientes
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-orange-600 dark:text-orange-400">Gestionar disputas</p>
                </div>
              </div>
            </a>
          </AdminNotificationBadge>
        </div>
      </div>

      {/* Actividad reciente - CORREGIDA: Solo mostrar si hay actividad */}
      {recentActivity.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
            ⚡ Actividad Reciente (Hoy)
          </h3>
          
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 text-sm sm:text-lg">✅</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base truncate">
                      {activity.user_profiles?.full_name?.split(' ')[0] || activity.user_profiles?.email?.split('@')[0] || 'Usuario anónimo'}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500">
                      {activity.score}/{activity.total_questions} preguntas
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="text-sm sm:text-lg font-semibold text-green-600">
                    {Math.round((activity.score / activity.total_questions) * 100)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTimeAgo(activity.completed_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Si no hay actividad hoy, mostrar mensaje diferente */}
      {recentActivity.length === 0 && stats && stats.testsCompletedToday === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
            ⚡ Actividad de Hoy
          </h3>
          <div className="text-center py-6 sm:py-8">
            <div className="text-3xl sm:text-4xl mb-4">😴</div>
            <p className="text-gray-500 text-sm sm:text-base">No hay tests completados hoy</p>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Los tests completados hoy aparecerán aquí
            </p>
          </div>
        </div>
      )}

      {/* Tabla de usuarios - Responsive */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                👥 Usuarios Recientes
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                Últimos registros y actividad
              </p>
            </div>
            <a 
              href="/admin/usuarios" 
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Ver todos →
            </a>
          </div>
        </div>


        {/* Vista móvil - Tarjetas */}
        <div className="block sm:hidden space-y-3 p-4">
          {users.slice(0, 5).map((user, index) => (
            <div key={user.user_id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-1 min-w-0">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                  </div>
                  <div className="ml-3 min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user.full_name || 'Sin nombre'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user.email}
                    </div>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ml-2 ${
                  user.is_active_student 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}>
                  {user.is_active_student ? '✅' : '❌'}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                📅 {new Date(user.user_created_at).toLocaleString('es-ES', { 
                  day: '2-digit', 
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Vista desktop - Tabla */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Registro
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.slice(0, 5).map((user, index) => (
                <tr key={user.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                      </div>
                      <div className="ml-4 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {user.full_name || 'Sin nombre'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.is_active_student 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {user.is_active_student ? '✅' : '❌'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(user.user_created_at).toLocaleString('es-ES', { 
                      day: '2-digit', 
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-6 sm:py-8">
            <p className="text-gray-500 dark:text-gray-400 text-sm">No hay usuarios registrados</p>
          </div>
        )}
      </div>


      {/* Acciones rápidas - Mobile responsive */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
          ⚡ Acciones Rápidas
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <a 
            href="/admin/usuarios"
            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl sm:text-2xl">👥</span>
              <div className="min-w-0">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 text-sm sm:text-base">Usuarios</h4>
                <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">Gestionar roles</p>
              </div>
            </div>
          </a>

          <a 
            href="/admin/analytics"
            className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 sm:p-4 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl sm:text-2xl">📈</span>
              <div className="min-w-0">
                <h4 className="font-medium text-green-900 dark:text-green-100 text-sm sm:text-base">Analytics</h4>
                <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">Métricas detalladas</p>
              </div>
            </div>
          </a>

          <a 
            href="/admin/configuracion"
            className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 sm:p-4 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl sm:text-2xl">📧</span>
              <div className="min-w-0">
                <h4 className="font-medium text-purple-900 dark:text-purple-100 text-sm sm:text-base">Emails</h4>
                <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-400">Campañas automáticas</p>
              </div>
            </div>
          </a>

          <a
            href="/admin/notificaciones"
            className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 sm:p-4 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl sm:text-2xl">🔔</span>
              <div className="min-w-0">
                <h4 className="font-medium text-orange-900 dark:text-orange-100 text-sm sm:text-base">Notificaciones</h4>
                <p className="text-xs sm:text-sm text-orange-600 dark:text-orange-400">Tracking Push & Email</p>
              </div>
            </div>
          </a>

          <a
            href="/admin/ai"
            className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 sm:p-4 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl sm:text-2xl">🤖</span>
              <div className="min-w-0">
                <h4 className="font-medium text-emerald-900 dark:text-emerald-100 text-sm sm:text-base">Configurar IA</h4>
                <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">APIs, modelos y uso</p>
              </div>
            </div>
          </a>

          <a
            href="/admin/monitoreo"
            className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 sm:p-4 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl sm:text-2xl">📋</span>
              <div className="min-w-0">
                <h4 className="font-medium text-indigo-900 dark:text-indigo-100 text-sm sm:text-base">Verificar Leyes</h4>
                <p className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400">Comparar con BOE</p>
              </div>
            </div>
          </a>
        </div>
      </div>

    </div>
  )
}

