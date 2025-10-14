'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function EngagementPage() {
  const { supabase } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showDAUModal, setShowDAUModal] = useState(false)
  const [showActivationModal, setShowActivationModal] = useState(false)
  const [showCohortModal, setShowCohortModal] = useState(false)
  const [showMAUModal, setShowMAUModal] = useState(false)
  const [showRetentionModal, setShowRetentionModal] = useState(false)
  const [showEngagementModal, setShowEngagementModal] = useState(false)
  const [showHabitModal, setShowHabitModal] = useState(false)

  useEffect(() => {
    async function fetchEngagementStats() {
      if (!supabase) {
        console.log('❌ No supabase instance available')
        return
      }
      
      console.log('🔍 Starting engagement stats fetch...')
      
      try {
        
        // Crear cliente con service role para bypass RLS
        const { createClient } = await import('@supabase/supabase-js')
        const adminSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
        )

        // Obtener todos los tests completados (bypass RLS)
        const { data: completedTests, error: testsError } = await adminSupabase
          .from('tests')
          .select('user_id, completed_at, is_completed')
          .eq('is_completed', true)
          .not('completed_at', 'is', null)
        
        if (testsError) {
          console.error('❌ Error en tests:', testsError)
          throw testsError
        }
        
        console.log('🧪 Tests query result (admin):', { 
          count: completedTests?.length || 0, 
          error: testsError,
          sampleTests: completedTests?.slice(0, 3) 
        })

        // Obtener usuarios registrados (bypass RLS)
        const { data: users, error: usersError } = await adminSupabase
          .from('user_profiles')
          .select('id, created_at')
        
        if (usersError) {
          console.error('❌ Error en user_profiles:', usersError)
          throw usersError
        }
        
        console.log('👥 Users query result (admin):', { 
          count: users?.length || 0, 
          error: usersError,
          sampleUsers: users?.slice(0, 3) 
        })

        const totalUsers = users.length
        const now = new Date()

        // Filtrar tests válidos (existen usuarios)
        const existingUserIds = new Set(users.map(u => u.id))
        const validCompletedTests = completedTests.filter(t => existingUserIds.has(t.user_id))

        // 📊 CÁLCULO DAU/MAU 
        const last7DaysTests = validCompletedTests.filter(t => {
          const testDate = new Date(t.completed_at)
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          return testDate >= sevenDaysAgo
        })
        
        const dailyActiveUsers = {}
        for (let i = 0; i < 7; i++) {
          const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
          const dateKey = date.toISOString().split('T')[0]
          dailyActiveUsers[dateKey] = new Set()
        }
        
        last7DaysTests.forEach(test => {
          const testDate = new Date(test.completed_at)
          const dateKey = testDate.toISOString().split('T')[0]
          if (dailyActiveUsers[dateKey]) {
            dailyActiveUsers[dateKey].add(test.user_id)
          }
        })
        
        const dailyActiveUsersArray = Object.values(dailyActiveUsers).map(set => set.size)
        const averageDAU = dailyActiveUsersArray.length > 0 ? 
          Math.round(dailyActiveUsersArray.reduce((sum, dau) => sum + dau, 0) / dailyActiveUsersArray.length) : 0
        
        // MAU = Usuarios activos en los últimos 30 días
        const last30DaysTests = validCompletedTests.filter(t => {
          const testDate = new Date(t.completed_at)
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          return testDate >= thirtyDaysAgo
        })
        const MAU = new Set(last30DaysTests.map(t => t.user_id)).size
        
        const dauMauRatio = MAU > 0 ? Math.round((averageDAU / MAU) * 100) : 0

        // 📈 MÉTRICA ESPECÍFICA PARA APPS PEQUEÑAS: % Usuarios Registrados Activos
        const registeredActiveRatio = totalUsers > 0 ? Math.round((MAU / totalUsers) * 100) : 0

        // 📊 DATOS HISTÓRICOS - Buscar el período con datos más reciente
        const dauMauHistory = []
        const today = new Date()
        
        // Encontrar la fecha del test más reciente para ajustar el rango
        const mostRecentTest = validCompletedTests.reduce((latest, test) => {
          const testDate = new Date(test.completed_at)
          return testDate > latest ? testDate : latest
        }, new Date(0))
        
        // Si no hay tests recientes, usar el test más reciente como punto de referencia
        const referenceDate = mostRecentTest > new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000) 
          ? today 
          : mostRecentTest
        
        // Calcular MAU desde el punto de referencia
        const thirtyDaysFromReference = new Date(referenceDate.getTime() - 30 * 24 * 60 * 60 * 1000)
        const fixedMAU = new Set(
          validCompletedTests
            .filter(t => new Date(t.completed_at) >= thirtyDaysFromReference)
            .map(t => t.user_id)
        ).size
        
        for (let i = 13; i >= 0; i--) {
          const date = new Date(referenceDate.getTime() - i * 24 * 60 * 60 * 1000)
          const dateKey = date.toISOString().split('T')[0]
          
          // DAU para este día específico
          const dayActiveUsers = new Set(
            validCompletedTests
              .filter(t => {
                if (!t.completed_at) return false
                const testDate = new Date(t.completed_at)
                const testDateKey = testDate.toISOString().split('T')[0]
                return testDateKey === dateKey
              })
              .map(t => t.user_id)
          ).size
          
          // Usar MAU fijo para mejor rendimiento
          const dayDauMauRatio = fixedMAU > 0 ? Math.round((dayActiveUsers / fixedMAU) * 100) : 0
          
          dauMauHistory.push({
            date: dateKey,
            dau: dayActiveUsers,
            mau: fixedMAU,
            ratio: dayDauMauRatio,
            formattedDate: date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
          })
        }

        // 📈 EVOLUCIÓN USUARIOS REGISTRADOS ACTIVOS (últimos 6 meses)
        const activationHistory = []
        for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
          const monthStart = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1)
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 0)
          
          // Usuarios registrados hasta esa fecha
          const usersUntilMonth = users.filter(u => new Date(u.created_at) <= monthEnd).length
          
          // Usuarios activos en ese mes
          const monthActiveUsers = new Set(
            validCompletedTests
              .filter(t => {
                const testDate = new Date(t.completed_at)
                return testDate >= monthStart && testDate <= monthEnd
              })
              .map(t => t.user_id)
          ).size
          
          const activationRate = usersUntilMonth > 0 ? Math.round((monthActiveUsers / usersUntilMonth) * 100) : 0
          
          activationHistory.unshift({
            month: monthStart.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
            totalUsers: usersUntilMonth,
            activeUsers: monthActiveUsers,
            activationRate: activationRate
          })
        }

        // 🎯 TRUE RETENTION RATE (Day 1, 7, 30)
        const retentionAnalysis = []
        
        // Analizar usuarios registrados en las últimas 4 semanas
        for (let weekOffset = 1; weekOffset <= 4; weekOffset++) {
          const weekStart = new Date(now.getTime() - weekOffset * 7 * 24 * 60 * 60 * 1000)
          const weekEnd = new Date(now.getTime() - (weekOffset - 1) * 7 * 24 * 60 * 60 * 1000)
          
          const cohortUsers = users.filter(u => {
            const createdAt = new Date(u.created_at)
            return createdAt >= weekStart && createdAt < weekEnd
          })
          
          if (cohortUsers.length === 0) {
            retentionAnalysis.push({
              week: `Semana ${weekOffset}`,
              registered: 0,
              day1Retention: 0,
              day7Retention: 0,
              day30Retention: 0
            })
            continue
          }
          
          // Calcular retención por días
          let day1Retained = 0
          let day7Retained = 0
          let day30Retained = 0
          
          cohortUsers.forEach(user => {
            const registrationDate = new Date(user.created_at)
            
            // Day 1: ¿Hizo test entre día 1-2 después del registro?
            const day1Start = new Date(registrationDate.getTime() + 24 * 60 * 60 * 1000)
            const day1End = new Date(registrationDate.getTime() + 2 * 24 * 60 * 60 * 1000)
            const hasDay1Activity = validCompletedTests.some(t => {
              const testDate = new Date(t.completed_at)
              return t.user_id === user.id && testDate >= day1Start && testDate <= day1End
            })
            if (hasDay1Activity) day1Retained++
            
            // Day 7: ¿Hizo test entre día 2-7 después del registro?
            const day7Start = new Date(registrationDate.getTime() + 2 * 24 * 60 * 60 * 1000)
            const day7End = new Date(registrationDate.getTime() + 7 * 24 * 60 * 60 * 1000)
            const hasDay7Activity = validCompletedTests.some(t => {
              const testDate = new Date(t.completed_at)
              return t.user_id === user.id && testDate >= day7Start && testDate <= day7End
            })
            if (hasDay7Activity) day7Retained++
            
            // Day 30: ¿Hizo test entre día 7-30 después del registro?
            const day30Start = new Date(registrationDate.getTime() + 7 * 24 * 60 * 60 * 1000)
            const day30End = new Date(registrationDate.getTime() + 30 * 24 * 60 * 60 * 1000)
            const hasDay30Activity = validCompletedTests.some(t => {
              const testDate = new Date(t.completed_at)
              return t.user_id === user.id && testDate >= day30Start && testDate <= day30End
            })
            if (hasDay30Activity) day30Retained++
          })
          
          retentionAnalysis.push({
            week: `Semana ${weekOffset}`,
            weekLabel: weekStart.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
            registered: cohortUsers.length,
            day1Retention: cohortUsers.length > 0 ? Math.round((day1Retained / cohortUsers.length) * 100) : 0,
            day7Retention: cohortUsers.length > 0 ? Math.round((day7Retained / cohortUsers.length) * 100) : 0,
            day30Retention: cohortUsers.length > 0 ? Math.round((day30Retained / cohortUsers.length) * 100) : 0
          })
        }

        // 📈 ENGAGEMENT DEPTH (calidad vs cantidad)
        const engagementDepth = {
          testsPerActiveUser: 0,
          avgDaysActivePerMonth: 0,
          avgLongestStreak: 0,
          distributionDaysActive: {},
          userEngagementLevels: {
            casual: 0,    // 1-3 tests/month
            regular: 0,   // 4-10 tests/month  
            power: 0      // 11+ tests/month
          }
        }

        if (MAU > 0) {
          // Tests por usuario activo
          engagementDepth.testsPerActiveUser = Math.round(last30DaysTests.length / MAU * 10) / 10

          // Días activos por mes para cada usuario activo
          const userDaysActive = {}
          last30DaysTests.forEach(test => {
            const testDate = new Date(test.completed_at).toISOString().split('T')[0]
            if (!userDaysActive[test.user_id]) {
              userDaysActive[test.user_id] = new Set()
            }
            userDaysActive[test.user_id].add(testDate)
          })

          const daysActiveArray = Object.values(userDaysActive).map(daysSet => daysSet.size)
          engagementDepth.avgDaysActivePerMonth = daysActiveArray.length > 0 ? 
            Math.round(daysActiveArray.reduce((sum, days) => sum + days, 0) / daysActiveArray.length * 10) / 10 : 0

          // Distribución de días activos
          daysActiveArray.forEach(days => {
            engagementDepth.distributionDaysActive[days] = (engagementDepth.distributionDaysActive[days] || 0) + 1
          })

          // Calcular longest streak promedio
          const userStreaks = []
          Object.keys(userDaysActive).forEach(userId => {
            const userTests = validCompletedTests
              .filter(t => t.user_id === userId)
              .map(t => new Date(t.completed_at))
              .sort((a, b) => a - b)

            let longestStreak = 0
            let currentStreak = 1
            
            for (let i = 1; i < userTests.length; i++) {
              const daysDiff = Math.floor((userTests[i] - userTests[i-1]) / (24 * 60 * 60 * 1000))
              
              if (daysDiff === 1) {
                currentStreak++
              } else if (daysDiff <= 3) {
                // Permitir hasta 3 días de gap (fines de semana)
                currentStreak++
              } else {
                longestStreak = Math.max(longestStreak, currentStreak)
                currentStreak = 1
              }
            }
            longestStreak = Math.max(longestStreak, currentStreak)
            userStreaks.push(longestStreak)
          })

          engagementDepth.avgLongestStreak = userStreaks.length > 0 ?
            Math.round(userStreaks.reduce((sum, streak) => sum + streak, 0) / userStreaks.length * 10) / 10 : 0

          // Niveles de engagement por tests/mes
          const activeUserIds = new Set(last30DaysTests.map(t => t.user_id))
          activeUserIds.forEach(userId => {
            const userTestCount = last30DaysTests.filter(t => t.user_id === userId).length
            
            if (userTestCount >= 11) {
              engagementDepth.userEngagementLevels.power++
            } else if (userTestCount >= 4) {
              engagementDepth.userEngagementLevels.regular++
            } else {
              engagementDepth.userEngagementLevels.casual++
            }
          })
        }

        // 💪 HABIT FORMATION (formación de hábitos)
        const habitFormation = {
          powerUsers: 0,           // 3+ días/semana
          powerUsersPercentage: 0,
          weeklyActiveUsers: 0,    // 7+ sesiones en 30 días
          weeklyActivePercentage: 0,
          habitDistribution: {
            occasional: 0,         // 1-2 días/semana
            regular: 0,           // 3-4 días/semana  
            habitual: 0           // 5+ días/semana
          },
          avgSessionsPerWeek: 0
        }

        if (MAU > 0) {
          const activeUserIds = new Set(last30DaysTests.map(t => t.user_id))
          
          activeUserIds.forEach(userId => {
            const userTests = last30DaysTests.filter(t => t.user_id === userId)
            const uniqueDays = new Set(userTests.map(t => new Date(t.completed_at).toISOString().split('T')[0]))
            
            const daysActiveInMonth = uniqueDays.size
            const avgDaysPerWeek = (daysActiveInMonth / 30) * 7

            // Power users (3+ días/semana promedio)
            if (avgDaysPerWeek >= 3) {
              habitFormation.powerUsers++
            }

            // Weekly active users (7+ tests en 30 días)
            if (userTests.length >= 7) {
              habitFormation.weeklyActiveUsers++
            }

            // Distribución de hábitos
            if (avgDaysPerWeek >= 5) {
              habitFormation.habitDistribution.habitual++
            } else if (avgDaysPerWeek >= 3) {
              habitFormation.habitDistribution.regular++
            } else {
              habitFormation.habitDistribution.occasional++
            }
          })

          habitFormation.powerUsersPercentage = Math.round((habitFormation.powerUsers / MAU) * 100)
          habitFormation.weeklyActivePercentage = Math.round((habitFormation.weeklyActiveUsers / MAU) * 100)
          
          // Promedio de sesiones por semana
          const totalSessions = last30DaysTests.length
          const weeksInMonth = 30 / 7
          habitFormation.avgSessionsPerWeek = Math.round((totalSessions / weeksInMonth) * 10) / 10
        }

        // 📈 EVOLUCIÓN ENGAGEMENT DEPTH (últimos 6 meses)
        const engagementDepthHistory = []
        for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
          const monthStart = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1)
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 0)
          
          // Tests en ese mes
          const monthTests = validCompletedTests.filter(t => {
            const testDate = new Date(t.completed_at)
            return testDate >= monthStart && testDate <= monthEnd
          })
          
          // Usuarios activos en ese mes
          const monthActiveUsers = new Set(monthTests.map(t => t.user_id)).size
          
          // Calcular métricas del mes
          const testsPerUser = monthActiveUsers > 0 ? Math.round((monthTests.length / monthActiveUsers) * 10) / 10 : 0
          
          // Días activos promedio
          const userDaysActive = {}
          monthTests.forEach(test => {
            const testDate = new Date(test.completed_at).toISOString().split('T')[0]
            if (!userDaysActive[test.user_id]) {
              userDaysActive[test.user_id] = new Set()
            }
            userDaysActive[test.user_id].add(testDate)
          })
          
          const daysActiveArray = Object.values(userDaysActive).map(daysSet => daysSet.size)
          const avgDaysActive = daysActiveArray.length > 0 ? 
            Math.round(daysActiveArray.reduce((sum, days) => sum + days, 0) / daysActiveArray.length * 10) / 10 : 0
          
          engagementDepthHistory.unshift({
            month: monthStart.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
            testsPerUser: testsPerUser,
            avgDaysActive: avgDaysActive,
            activeUsers: monthActiveUsers
          })
        }

        // 💪 EVOLUCIÓN HABIT FORMATION (últimos 6 meses) 
        const habitFormationHistory = []
        for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
          const monthStart = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1)
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 0)
          
          // Tests en ese mes
          const monthTests = validCompletedTests.filter(t => {
            const testDate = new Date(t.completed_at)
            return testDate >= monthStart && testDate <= monthEnd
          })
          
          const monthActiveUsers = new Set(monthTests.map(t => t.user_id))
          let powerUsers = 0
          let weeklyActiveUsers = 0
          
          if (monthActiveUsers.size > 0) {
            monthActiveUsers.forEach(userId => {
              const userTests = monthTests.filter(t => t.user_id === userId)
              const uniqueDays = new Set(userTests.map(t => new Date(t.completed_at).toISOString().split('T')[0]))
              
              const daysInMonth = new Date(monthEnd.getFullYear(), monthEnd.getMonth() + 1, 0).getDate()
              const avgDaysPerWeek = (uniqueDays.size / daysInMonth) * 7
              
              if (avgDaysPerWeek >= 3) powerUsers++
              if (userTests.length >= 7) weeklyActiveUsers++
            })
          }
          
          const powerUsersPercent = monthActiveUsers.size > 0 ? Math.round((powerUsers / monthActiveUsers.size) * 100) : 0
          const weeklyActivePercent = monthActiveUsers.size > 0 ? Math.round((weeklyActiveUsers / monthActiveUsers.size) * 100) : 0
          
          habitFormationHistory.unshift({
            month: monthStart.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
            powerUsersPercent: powerUsersPercent,
            weeklyActivePercent: weeklyActivePercent,
            activeUsers: monthActiveUsers.size
          })
        }

        // 🎯 EVOLUCIÓN TRUE RETENTION RATE (últimos 8-10 períodos)
        const retentionRateHistory = []
        
        // Analizar por períodos de 2 semanas para tener suficientes datos
        for (let periodOffset = 1; periodOffset <= 8; periodOffset++) {
          const periodWeeks = 2 // Períodos de 2 semanas
          const periodStart = new Date(now.getTime() - (periodOffset + periodWeeks - 1) * 7 * 24 * 60 * 60 * 1000)
          const periodEnd = new Date(now.getTime() - periodOffset * 7 * 24 * 60 * 60 * 1000)
          
          const periodUsers = users.filter(u => {
            const createdAt = new Date(u.created_at)
            return createdAt >= periodStart && createdAt < periodEnd
          })
          
          if (periodUsers.length === 0) {
            retentionRateHistory.unshift({
              period: `${Math.ceil(periodOffset/2)}`,
              periodLabel: periodStart.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
              registered: 0,
              day1Retention: 0,
              day7Retention: 0,
              day30Retention: 0
            })
            continue
          }
          
          let day1Retained = 0
          let day7Retained = 0
          let day30Retained = 0
          
          periodUsers.forEach(user => {
            const registrationDate = new Date(user.created_at)
            
            // Day 1: ¿Hizo test entre día 1-2 después del registro?
            const day1Start = new Date(registrationDate.getTime() + 24 * 60 * 60 * 1000)
            const day1End = new Date(registrationDate.getTime() + 2 * 24 * 60 * 60 * 1000)
            const hasDay1Activity = validCompletedTests.some(t => {
              const testDate = new Date(t.completed_at)
              return t.user_id === user.id && testDate >= day1Start && testDate <= day1End
            })
            if (hasDay1Activity) day1Retained++
            
            // Day 7: ¿Hizo test entre día 2-7 después del registro?
            const day7Start = new Date(registrationDate.getTime() + 2 * 24 * 60 * 60 * 1000)
            const day7End = new Date(registrationDate.getTime() + 7 * 24 * 60 * 60 * 1000)
            const hasDay7Activity = validCompletedTests.some(t => {
              const testDate = new Date(t.completed_at)
              return t.user_id === user.id && testDate >= day7Start && testDate <= day7End
            })
            if (hasDay7Activity) day7Retained++
            
            // Day 30: ¿Hizo test entre día 7-30 después del registro?
            const day30Start = new Date(registrationDate.getTime() + 7 * 24 * 60 * 60 * 1000)
            const day30End = new Date(registrationDate.getTime() + 30 * 24 * 60 * 60 * 1000)
            const hasDay30Activity = validCompletedTests.some(t => {
              const testDate = new Date(t.completed_at)
              return t.user_id === user.id && testDate >= day30Start && testDate <= day30End
            })
            if (hasDay30Activity) day30Retained++
          })
          
          retentionRateHistory.unshift({
            period: `P${periodOffset}`,
            periodLabel: periodStart.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
            registered: periodUsers.length,
            day1Retention: periodUsers.length > 0 ? Math.round((day1Retained / periodUsers.length) * 100) : 0,
            day7Retention: periodUsers.length > 0 ? Math.round((day7Retained / periodUsers.length) * 100) : 0,
            day30Retention: periodUsers.length > 0 ? Math.round((day30Retained / periodUsers.length) * 100) : 0
          })
        }

        // 📊 ANÁLISIS DE COHORTES (usuarios por semanas de registro)
        const cohortAnalysis = []
        for (let weekOffset = 0; weekOffset < 8; weekOffset++) {
          const weekStart = new Date(now.getTime() - (weekOffset + 1) * 7 * 24 * 60 * 60 * 1000)
          const weekEnd = new Date(now.getTime() - weekOffset * 7 * 24 * 60 * 60 * 1000)
          
          const weekUsers = users.filter(u => {
            const createdAt = new Date(u.created_at)
            return createdAt >= weekStart && createdAt < weekEnd
          })
          
          const weekActiveUsers = weekUsers.filter(u => {
            return last30DaysTests.some(t => t.user_id === u.id)
          })
          
          cohortAnalysis.push({
            week: `Semana ${weekOffset + 1}`,
            registered: weekUsers.length,
            active: weekActiveUsers.length,
            retentionRate: weekUsers.length > 0 ? Math.round((weekActiveUsers.length / weekUsers.length) * 100) : 0
          })
        }

        console.log('📊 Engagement Stats Debug:')
        console.table({
          totalUsers,
          averageDAU,
          MAU,
          dauMauRatio,
          dauMauHistoryLength: dauMauHistory.length,
          sampleDay: dauMauHistory[dauMauHistory.length - 1],
          validCompletedTestsCount: validCompletedTests.length,
          rawCompletedTestsCount: completedTests.length,
          usersCount: users.length,
          existingUserIdsSize: existingUserIds.size,
          mostRecentTest: validCompletedTests.length > 0 ? mostRecentTest.toISOString() : 'No tests',
          referenceDate: referenceDate.toISOString(),
          usingRecentData: referenceDate === today,
          firstFewRawTests: completedTests.slice(0, 3).map(t => ({
            user_id: t.user_id,
            completed_at: t.completed_at,
            completed_at_type: typeof t.completed_at
          })),
          firstFewValidTests: validCompletedTests.slice(0, 3).map(t => ({
            user_id: t.user_id,
            completed_at: t.completed_at,
            completed_at_type: typeof t.completed_at
          })),
          dauMauHistorySample: dauMauHistory.slice(-3),
          last30DaysTestsCount: last30DaysTests.length,
          last7DaysTestsCount: last7DaysTests.length
        })
        console.log('🔍 First few raw tests:', completedTests.slice(0, 5))
        console.log('🔍 First few valid tests:', validCompletedTests.slice(0, 5))
        console.log('🔍 Users sample:', users.slice(0, 3))

        setStats({
          totalUsers,
          averageDAU,
          MAU,
          dauMauRatio,
          dauMauHistory,
          registeredActiveRatio,
          cohortAnalysis,
          activationHistory,
          retentionAnalysis,
          engagementDepth,
          habitFormation,
          engagementDepthHistory,
          habitFormationHistory,
          retentionRateHistory
        })
        
      } catch (err) {
        console.error('Error fetching engagement stats:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchEngagementStats()
  }, [supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando métricas de engagement...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Error al cargar datos</h3>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          📊 Engagement & Retención
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Análisis profundo del compromiso y participación de usuarios en Vence
        </p>
      </div>

      {/* Métricas principales específicas para apps pequeñas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Usuarios Registrados Activos */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Activation Rate (30d)
                </p>
                <button 
                  onClick={() => setShowActivationModal(true)}
                  className="w-4 h-4 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 rounded-full flex items-center justify-center transition-colors"
                  title="Ver información detallada"
                >
                  <span className="text-xs text-blue-600 dark:text-blue-400">❓</span>
                </button>
              </div>
              <p className="text-3xl font-bold text-green-600">{stats.registeredActiveRatio}%</p>
              <p className="text-sm text-gray-500 mt-1">
                {stats.MAU} de {stats.totalUsers} usuarios activos últimos 30 días
              </p>
              <div className="mt-2">
                <div className="text-xs text-gray-600">
                  {stats.registeredActiveRatio >= 50 && <span className="text-green-600">🚀 Excelente activación</span>}
                  {stats.registeredActiveRatio >= 30 && stats.registeredActiveRatio < 50 && <span className="text-yellow-600">📈 Buena activación</span>}
                  {stats.registeredActiveRatio < 30 && <span className="text-orange-600">📊 Mejorable activación</span>}
                </div>
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        {/* DAU/MAU Ratio */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  DAU/MAU Ratio
                </p>
                <button 
                  onClick={() => setShowDAUModal(true)}
                  className="w-4 h-4 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 rounded-full flex items-center justify-center transition-colors"
                  title="Ver información detallada"
                >
                  <span className="text-xs text-blue-600 dark:text-blue-400">❓</span>
                </button>
              </div>
              <p className="text-3xl font-bold text-purple-600">{stats.dauMauRatio}%</p>
              <p className="text-sm text-gray-500 mt-1">
                {stats.averageDAU} usuarios usan Vence a diario
              </p>
              <div className="mt-2">
                <div className="text-xs">
                  {stats.dauMauRatio < 10 && <span className="text-orange-600">📊 Engagement bajo</span>}
                  {stats.dauMauRatio >= 10 && stats.dauMauRatio < 20 && <span className="text-yellow-600">📈 Engagement medio</span>}
                  {stats.dauMauRatio >= 20 && stats.dauMauRatio < 50 && <span className="text-green-600">🚀 Engagement bueno</span>}
                  {stats.dauMauRatio >= 50 && <span className="text-purple-600">⭐ Engagement excepcional</span>}
                </div>
              </div>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>

        {/* Usuarios Absolutos */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  MAU (Monthly Active Users)
                </p>
                <button 
                  onClick={() => setShowMAUModal(true)}
                  className="w-4 h-4 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 rounded-full flex items-center justify-center transition-colors"
                  title="Ver información detallada"
                >
                  <span className="text-xs text-blue-600 dark:text-blue-400">❓</span>
                </button>
              </div>
              <p className="text-3xl font-bold text-blue-600">{stats.MAU}</p>
              <p className="text-sm text-gray-500 mt-1">
                {stats.MAU} usuarios hicieron tests este mes
              </p>
              <div className="mt-2">
                <div className="text-xs text-gray-600">
                  {stats.MAU >= 100 && <span className="text-green-600">🎯 Base sólida</span>}
                  {stats.MAU >= 50 && stats.MAU < 100 && <span className="text-yellow-600">📈 Creciendo</span>}
                  {stats.MAU < 50 && <span className="text-orange-600">🌱 Fase inicial</span>}
                </div>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🎯</span>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas avanzadas: Engagement Depth y Habit Formation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Engagement Depth */}
        {stats.engagementDepth && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                📈 Engagement Depth
              </h3>
              <button 
                onClick={() => setShowEngagementModal(true)}
                className="w-4 h-4 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 rounded-full flex items-center justify-center transition-colors"
                title="Ver información detallada"
              >
                <span className="text-xs text-blue-600 dark:text-blue-400">❓</span>
              </button>
            </div>
            
            {/* Análisis dinámico de profundidad de engagement */}
            {(() => {
              if (!stats.engagementDepth || stats.MAU === 0) {
                return (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      📊 No hay suficientes usuarios activos para análisis de engagement
                    </p>
                  </div>
                )
              }
              
              const { testsPerActiveUser, avgDaysActivePerMonth, avgLongestStreak } = stats.engagementDepth
              const { casual, regular, power } = stats.engagementDepth.userEngagementLevels
              
              let insights = []
              let recommendations = []
              let alertLevel = "info"
              
              // Análisis global coherente
              const engagementScore = (testsPerActiveUser/15) + (avgDaysActivePerMonth/10) + (avgLongestStreak/7)
              const averageScore = engagementScore / 3
              
              // Diagnóstico principal basado en el score global
              if (averageScore >= 0.8) {
                insights.push("🚀 Engagement excepcional - usuarios muy comprometidos")
                alertLevel = "success"
              } else if (averageScore >= 0.6) {
                insights.push("📈 Engagement sólido con áreas de mejora")
                alertLevel = "warning"
              } else if (averageScore >= 0.4) {
                insights.push("⚠️ Engagement moderado - necesita optimización")
                alertLevel = "warning"
              } else {
                insights.push("❌ CRÍTICO: Engagement superficial")
                alertLevel = "error"
              }
              
              // Análisis específico de cada dimensión (solo si es significativo)
              if (testsPerActiveUser >= 10 && avgDaysActivePerMonth < 4) {
                insights.push("🎯 Paradoja: Usuarios intensos pero esporádicos (sesiones largas pero infrecuentes)")
              } else if (testsPerActiveUser < 5 && avgDaysActivePerMonth >= 6) {
                insights.push("🔄 Patrón: Usuarios frecuentes pero superficiales (muchas visitas cortas)")
              } else if (avgLongestStreak >= 5 && avgDaysActivePerMonth < 4) {
                insights.push("⚡ Contradicción: Buenos streaks pero baja frecuencia general")
              }
              
              // Identificar el punto débil principal
              if (testsPerActiveUser < 5) {
                insights.push("🎯 Punto débil: Intensidad de uso baja")
              } else if (avgDaysActivePerMonth < 3) {
                insights.push("🎯 Punto débil: Frecuencia de regreso baja")
              } else if (avgLongestStreak < 3) {
                insights.push("🎯 Punto débil: Consistencia baja (no forman hábitos)")
              }
              
              // Análisis distribución de usuarios
              const totalUsers = casual + regular + power
              if (totalUsers > 0) {
                const powerPercent = Math.round((power / totalUsers) * 100)
                const casualPercent = Math.round((casual / totalUsers) * 100)
                
                if (powerPercent >= 30) {
                  insights.push("🎯 Excelente: muchos power users de alto valor")
                } else if (casualPercent > 70) {
                  insights.push("⚠️ Demasiados usuarios casuales - falta profundidad")
                }
              }
              
              // Recomendaciones coherentes basadas en el diagnóstico principal
              if (averageScore < 0.4) {
                recommendations.push("URGENTE: Revisar onboarding completo - engagement crítico")
                recommendations.push("Entrevistas con usuarios: ¿por qué no usan más Vence?")
              } else if (averageScore < 0.6) {
                // Recomendar según el punto débil principal
                if (testsPerActiveUser < avgDaysActivePerMonth && testsPerActiveUser < avgLongestStreak) {
                  recommendations.push("Prioridad: Aumentar intensidad - progresión de dificultad")
                } else if (avgDaysActivePerMonth < testsPerActiveUser && avgDaysActivePerMonth < avgLongestStreak) {
                  recommendations.push("Prioridad: Aumentar frecuencia - recordatorios inteligentes")
                } else {
                  recommendations.push("Prioridad: Mejorar consistencia - gamificación de streaks")
                }
              }
              
              // Recomendaciones específicas para patrones detectados
              if (testsPerActiveUser >= 10 && avgDaysActivePerMonth < 4) {
                recommendations.push("Convertir sesiones intensas en hábito diario")
              } else if (testsPerActiveUser < 5 && avgDaysActivePerMonth >= 6) {
                recommendations.push("Aumentar duración de sesiones - contenido más enganchante")
              }
              
              // Solo añadir si hay distribución problemática
              if (casual > power + regular && totalUsers > 0) {
                recommendations.push("Demasiados usuarios casuales - mejorar activación inicial")
              }
              
              const bgColor = alertLevel === "error" ? "bg-red-50 dark:bg-red-900/20" :
                             alertLevel === "warning" ? "bg-yellow-50 dark:bg-yellow-900/20" :
                             alertLevel === "success" ? "bg-green-50 dark:bg-green-900/20" :
                             "bg-blue-50 dark:bg-blue-900/20"
              
              return (
                <div className={`p-4 rounded-lg mb-4 ${bgColor}`}>
                  <p className="font-medium text-sm mb-2">
                    📈 Análisis para Vence ({testsPerActiveUser} tests/usuario):
                  </p>
                  <ul className="text-sm space-y-1 mb-3">
                    {insights.map((insight, i) => (
                      <li key={i}>• {insight}</li>
                    ))}
                  </ul>
                  {recommendations.length > 0 && (
                    <div>
                      <p className="font-medium text-sm mb-1">🎯 Estrategias para profundizar engagement:</p>
                      <ul className="text-sm space-y-1">
                        {recommendations.map((rec, i) => (
                          <li key={i}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })()}
            
            <div className="space-y-4">
              {/* Tests por usuario activo */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Tests por usuario activo</span>
                <span className="font-semibold text-lg text-blue-600">{stats.engagementDepth.testsPerActiveUser}</span>
              </div>
              
              {/* Días activos por mes */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Días activos promedio/mes</span>
                <span className="font-semibold text-lg text-green-600">{stats.engagementDepth.avgDaysActivePerMonth}</span>
              </div>
              
              {/* Streak promedio */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Streak promedio (días)</span>
                <span className="font-semibold text-lg text-purple-600">{stats.engagementDepth.avgLongestStreak}</span>
              </div>
              
              {/* Distribución de usuarios */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 mb-2">Distribución por intensidad:</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Casual (1-3 tests/mes)</span>
                    <span className="text-orange-600">{stats.engagementDepth.userEngagementLevels.casual}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Regular (4-10 tests/mes)</span>
                    <span className="text-blue-600">{stats.engagementDepth.userEngagementLevels.regular}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Power (11+ tests/mes)</span>
                    <span className="text-green-600">{stats.engagementDepth.userEngagementLevels.power}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Habit Formation */}
        {stats.habitFormation && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                💪 Habit Formation
              </h3>
              <button 
                onClick={() => setShowHabitModal(true)}
                className="w-4 h-4 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 rounded-full flex items-center justify-center transition-colors"
                title="Ver información detallada"
              >
                <span className="text-xs text-blue-600 dark:text-blue-400">❓</span>
              </button>
            </div>
            
            {/* Análisis dinámico de formación de hábitos */}
            {(() => {
              if (!stats.habitFormation || stats.MAU === 0) {
                return (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      📊 No hay suficientes usuarios activos para análisis de hábitos
                    </p>
                  </div>
                )
              }
              
              const { powerUsersPercentage, weeklyActivePercentage, avgSessionsPerWeek } = stats.habitFormation
              const { habitual, regular, occasional } = stats.habitFormation.habitDistribution
              
              let insights = []
              let recommendations = []
              let alertLevel = "info"
              
              // Análisis Power Users
              if (powerUsersPercentage >= 25) {
                insights.push("🚀 Excelente formación de hábito - muchos usuarios power")
                alertLevel = "success"
              } else if (powerUsersPercentage >= 15) {
                insights.push("📈 Formación de hábito en progreso")
                alertLevel = "warning"
              } else {
                insights.push("❌ CRÍTICO: Muy pocos usuarios forman hábitos fuertes")
                alertLevel = "error"
              }
              
              // Análisis Weekly Active
              if (weeklyActivePercentage >= 40) {
                insights.push("✅ Buen engagement semanal consistente")
              } else if (weeklyActivePercentage >= 25) {
                insights.push("⚠️ Engagement semanal mejorable")
              } else {
                insights.push("🔴 PROBLEMA: Pocos usuarios usan Vence consistentemente")
                alertLevel = "error"
              }
              
              // Análisis distribución
              const totalActive = habitual + regular + occasional
              if (totalActive > 0) {
                const habitualPercent = Math.round((habitual / totalActive) * 100)
                const regularPercent = Math.round((regular / totalActive) * 100)
                const occasionalPercent = Math.round((occasional / totalActive) * 100)
                
                if (occasionalPercent > 60) {
                  insights.push("⚡ Mayoría son usuarios ocasionales - falta hábito")
                } else if (regularPercent + habitualPercent > 50) {
                  insights.push("💪 Buenos hábitos: mayoría usa Vence regularmente")
                }
              }
              
              // Recomendaciones específicas
              if (powerUsersPercentage < 20) {
                recommendations.push("Implementar streaks diarios y gamificación")
              }
              if (weeklyActivePercentage < 30) {
                recommendations.push("Notificaciones inteligentes de recordatorio")
              }
              if (avgSessionsPerWeek < 10) {
                recommendations.push("Objetivos semanales: 'Haz 3 tests esta semana'")
              }
              if (habitual < regular) {
                recommendations.push("Programa de 21 días para formar hábito diario")
              }
              
              const bgColor = alertLevel === "error" ? "bg-red-50 dark:bg-red-900/20" :
                             alertLevel === "warning" ? "bg-yellow-50 dark:bg-yellow-900/20" :
                             alertLevel === "success" ? "bg-green-50 dark:bg-green-900/20" :
                             "bg-blue-50 dark:bg-blue-900/20"
              
              return (
                <div className={`p-4 rounded-lg mb-4 ${bgColor}`}>
                  <p className="font-medium text-sm mb-2">
                    💪 Análisis para Vence ({powerUsersPercentage}% power users):
                  </p>
                  <ul className="text-sm space-y-1 mb-3">
                    {insights.map((insight, i) => (
                      <li key={i}>• {insight}</li>
                    ))}
                  </ul>
                  {recommendations.length > 0 && (
                    <div>
                      <p className="font-medium text-sm mb-1">🎯 Estrategias recomendadas:</p>
                      <ul className="text-sm space-y-1">
                        {recommendations.map((rec, i) => (
                          <li key={i}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })()}
            
            <div className="space-y-4">
              {/* Power Users */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Power Users (3+ días/semana)</span>
                <div className="text-right">
                  <div className="font-semibold text-lg text-purple-600">{stats.habitFormation.powerUsersPercentage}%</div>
                  <div className="text-xs text-gray-500">{stats.habitFormation.powerUsers} usuarios</div>
                </div>
              </div>
              
              {/* Weekly Active */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Weekly Active (7+ tests/mes)</span>
                <div className="text-right">
                  <div className="font-semibold text-lg text-blue-600">{stats.habitFormation.weeklyActivePercentage}%</div>
                  <div className="text-xs text-gray-500">{stats.habitFormation.weeklyActiveUsers} usuarios</div>
                </div>
              </div>
              
              {/* Sesiones por semana */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Promedio sesiones/semana</span>
                <span className="font-semibold text-lg text-green-600">{stats.habitFormation.avgSessionsPerWeek}</span>
              </div>
              
              {/* Distribución de hábitos */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 mb-2">Distribución de hábitos:</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Ocasional (1-2 días/sem)</span>
                    <span className="text-orange-600">{stats.habitFormation.habitDistribution.occasional}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Regular (3-4 días/sem)</span>
                    <span className="text-blue-600">{stats.habitFormation.habitDistribution.regular}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Habitual (5+ días/sem)</span>
                    <span className="text-green-600">{stats.habitFormation.habitDistribution.habitual}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Gráfico de evolución Usuarios Registrados Activos */}
      {stats.activationHistory && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              📈 Evolución de Activación de Usuarios
            </h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Actual: <span className="font-semibold text-green-600">{stats.registeredActiveRatio}%</span>
            </div>
          </div>
          
          <div className="relative">
            {/* Zona objetivo (50%+) */}
            <div className="absolute inset-x-0 bg-green-50 dark:bg-green-900/10 border-y border-green-200 dark:border-green-800" 
                 style={{top: '50%', height: '50%'}}>
              <div className="text-xs text-green-600 dark:text-green-400 p-1">Zona objetivo (50%+)</div>
            </div>
            
            {/* Gráfico de barras */}
            <div className="relative h-48 border-b border-gray-200 dark:border-gray-700 px-2">
              <div className="flex items-end justify-between h-full pt-8 pb-4">
                {stats.activationHistory.map((point, index) => {
                  const height = Math.min(140, (point.activationRate / 100) * 140)
                  const isLast = index === stats.activationHistory.length - 1
                  
                  return (
                    <div key={point.month} className="flex-1 flex flex-col items-center">
                      {/* Barra */}
                      <div className="relative w-full max-w-12 mx-2">
                        {/* Valor encima de la barra */}
                        <div className="text-xs font-semibold text-center mb-1 text-gray-700 dark:text-gray-300">
                          {point.activationRate}%
                        </div>
                        
                        <div 
                          className={`w-full ${isLast ? 'bg-green-600' : 'bg-blue-600'} rounded transition-all hover:opacity-80 cursor-pointer`}
                          style={{height: `${height}px`}}
                          title={`${point.month}: ${point.activationRate}% (${point.activeUsers}/${point.totalUsers})`}
                        ></div>
                      </div>
                      
                      {/* Etiqueta de mes */}
                      <div className="text-xs text-gray-500 mt-2 text-center">
                        {point.month}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* Eje Y con marcadores */}
            <div className="absolute left-0 top-0 h-48 flex flex-col justify-between text-xs text-gray-400 -ml-8 pt-8">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
          </div>
          
          {/* Estadísticas resumidas */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                {Math.max(...stats.activationHistory.map(h => h.activationRate))}%
              </div>
              <div className="text-xs text-gray-500">Máximo</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {Math.round(stats.activationHistory.reduce((sum, h) => sum + h.activationRate, 0) / stats.activationHistory.length)}%
              </div>
              <div className="text-xs text-gray-500">Promedio</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-orange-600">
                {Math.min(...stats.activationHistory.map(h => h.activationRate))}%
              </div>
              <div className="text-xs text-gray-500">Mínimo</div>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de evolución DAU/MAU */}
      {stats.dauMauHistory && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              📈 Evolución DAU/MAU (período con actividad)
            </h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Promedio 7 días: <span className="font-semibold text-purple-600">{stats.dauMauRatio}%</span>
            </div>
          </div>
          
          <div className="relative">
            {/* Zona ideal (20-30%) */}
            <div className="absolute inset-x-0 bg-green-50 dark:bg-green-900/10 border-y border-green-200 dark:border-green-800" 
                 style={{top: '70%', height: '10%'}}>
              <div className="text-xs text-green-600 dark:text-green-400 p-1">Zona ideal (20-30%)</div>
            </div>
            
            {/* Gráfico de línea */}
            <div className="relative h-48 border-b border-gray-200 dark:border-gray-700 px-2">
              {/* SVG para línea continua */}
              <svg 
                className="absolute inset-0 w-full h-full pointer-events-none" 
                viewBox="0 0 100 100" 
                preserveAspectRatio="none"
              >
                <polyline
                  points={stats.dauMauHistory.map((point, index) => {
                    const x = (index / (stats.dauMauHistory.length - 1)) * 100
                    const y = 100 - Math.min(96, (point.ratio / 100) * 96)
                    return `${x},${y}`
                  }).join(' ')}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="0.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              
              {/* Puntos interactivos */}
              <div className="relative h-full">
                {stats.dauMauHistory.map((point, index) => {
                  const height = Math.min(96, (point.ratio / 100) * 96)
                  const leftPos = (index / (stats.dauMauHistory.length - 1)) * 100
                  const isLast = index === stats.dauMauHistory.length - 1
                  
                  return (
                    <div key={point.date}>
                      {/* Punto del gráfico */}
                      <div
                        className={`absolute w-3 h-3 ${isLast ? 'bg-purple-600' : 'bg-blue-600'} rounded-full z-20 group cursor-pointer transform -translate-x-1.5 -translate-y-1.5 border-2 border-white shadow-sm`}
                        style={{
                          left: `${leftPos}%`,
                          bottom: `${height}%`
                        }}
                        title={`${point.formattedDate}: ${point.ratio}% (DAU: ${point.dau}, MAU: ${point.mau})`}
                      >
                        {/* Tooltip en hover */}
                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-30 transition-opacity pointer-events-none">
                          {point.formattedDate}<br/>
                          {point.ratio}% (DAU: {point.dau})
                        </div>
                      </div>
                      
                      {/* Etiqueta de fecha (solo cada 5 días) */}
                      {index % 5 === 0 && (
                        <div 
                          className="absolute text-xs text-gray-400 transform -rotate-45 origin-left whitespace-nowrap"
                          style={{
                            left: `${leftPos}%`,
                            bottom: '-30px'
                          }}
                        >
                          {point.formattedDate}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* Eje Y con marcadores */}
            <div className="absolute left-0 top-0 h-48 flex flex-col justify-between text-xs text-gray-400 -ml-8">
              <span>100%</span>
              <span>80%</span>
              <span>60%</span>
              <span>40%</span>
              <span>20%</span>
              <span>0%</span>
            </div>
          </div>
          
          {/* Estadísticas resumidas */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {Math.max(...stats.dauMauHistory.map(h => h.ratio))}%
              </div>
              <div className="text-xs text-gray-500">Máximo</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                {Math.round(stats.dauMauHistory.reduce((sum, h) => sum + h.ratio, 0) / stats.dauMauHistory.length)}%
              </div>
              <div className="text-xs text-gray-500">Promedio</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600">
                {Math.min(...stats.dauMauHistory.map(h => h.ratio))}%
              </div>
              <div className="text-xs text-gray-500">Mínimo</div>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de evolución Engagement Depth */}
      {stats.engagementDepthHistory && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              📈 Evolución de Engagement Depth
            </h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Actual: <span className="font-semibold text-blue-600">{stats.engagementDepth?.testsPerActiveUser || 0} tests/usuario</span>
            </div>
          </div>
          
          <div className="relative">
            {/* Gráfico de líneas temporal */}
            <div className="relative h-80 border border-gray-200 dark:border-gray-700 p-4">
              <svg width="100%" height="100%" viewBox="0 0 700 280" className="overflow-visible">
                {/* Líneas de referencia horizontales para tests */}
                {[0, 5, 10, 15, 20].map(y => (
                  <g key={y}>
                    <line 
                      x1="60" 
                      y1={220 - (y * 10)} 
                      x2="640" 
                      y2={220 - (y * 10)} 
                      stroke="currentColor" 
                      strokeWidth="0.5" 
                      className="text-gray-300 dark:text-gray-600"
                    />
                    <text 
                      x="55" 
                      y={220 - (y * 10) + 4} 
                      className="text-xs fill-gray-500 dark:fill-gray-400" 
                      textAnchor="end"
                    >
                      {y}
                    </text>
                  </g>
                ))}
                
                {/* Zonas de referencia */}
                <rect x="60" y={220 - (10 * 10)} width="580" height="120" fill="rgb(59, 130, 246)" opacity="0.05" />
                <text x="70" y={220 - (10 * 10) + 15} className="text-xs fill-blue-600 dark:fill-blue-400">Zona objetivo 10+ tests/usuario</text>
                
                <rect x="60" y={220 - (5 * 10)} width="580" height="170" fill="rgb(34, 197, 94)" opacity="0.05" />
                <text x="70" y={220 - (5 * 10) + 15} className="text-xs fill-green-600 dark:fill-green-400">Zona objetivo 5+ días activos</text>
                
                {/* Líneas de datos */}
                {stats.engagementDepthHistory.length > 1 && (
                  <>
                    {/* Línea Tests por usuario (azul) */}
                    <polyline
                      points={stats.engagementDepthHistory.map((point, index) => {
                        const x = 60 + (index * (580 / (stats.engagementDepthHistory.length - 1)))
                        const y = 220 - (Math.min(point.testsPerUser, 20) * 10)
                        return `${x},${y}`
                      }).join(' ')}
                      fill="none"
                      stroke="rgb(59, 130, 246)"
                      strokeWidth="3"
                      className="drop-shadow-sm"
                    />
                    
                    {/* Línea Días activos (verde) */}
                    <polyline
                      points={stats.engagementDepthHistory.map((point, index) => {
                        const x = 60 + (index * (580 / (stats.engagementDepthHistory.length - 1)))
                        const y = 220 - (Math.min(point.avgDaysActive, 20) * 10)
                        return `${x},${y}`
                      }).join(' ')}
                      fill="none"
                      stroke="rgb(34, 197, 94)"
                      strokeWidth="3"
                      className="drop-shadow-sm"
                    />
                  </>
                )}
                
                {/* Puntos de datos */}
                {stats.engagementDepthHistory.map((point, index) => {
                  const x = 60 + (index * (580 / Math.max(1, stats.engagementDepthHistory.length - 1)))
                  const isLast = index === stats.engagementDepthHistory.length - 1
                  
                  const testsValue = Math.min(point.testsPerUser, 20)
                  const daysValue = Math.min(point.avgDaysActive, 20)
                  
                  return (
                    <g key={point.month}>
                      {/* Puntos con valores */}
                      <circle
                        cx={x}
                        cy={220 - (testsValue * 10)}
                        r={isLast ? "5" : "3"}
                        fill="rgb(59, 130, 246)"
                        className="drop-shadow-sm cursor-pointer hover:r-6 transition-all"
                        title={`${point.month}: ${testsValue} tests por usuario`}
                      />
                      <text
                        x={x}
                        y={220 - (testsValue * 10) - 8}
                        className="text-xs fill-blue-600 dark:fill-blue-400 font-semibold"
                        textAnchor="middle"
                      >
                        {testsValue}
                      </text>
                      
                      <circle
                        cx={x}
                        cy={220 - (daysValue * 10)}
                        r={isLast ? "5" : "3"}
                        fill="rgb(34, 197, 94)"
                        className="drop-shadow-sm cursor-pointer hover:r-6 transition-all"
                        title={`${point.month}: ${daysValue} días activos promedio`}
                      />
                      <text
                        x={x}
                        y={220 - (daysValue * 10) - 8}
                        className="text-xs fill-green-600 dark:fill-green-400 font-semibold"
                        textAnchor="middle"
                      >
                        {daysValue}
                      </text>
                      
                      {/* Etiqueta de tiempo */}
                      <text
                        x={x}
                        y="245"
                        className="text-xs fill-gray-500 dark:fill-gray-400"
                        textAnchor="middle"
                      >
                        {point.month}
                      </text>
                    </g>
                  )
                })}
                
              </svg>
            </div>
            
            {/* Leyenda */}
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">Tests por usuario</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">Días activos promedio</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de evolución Habit Formation */}
      {stats.habitFormationHistory && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              💪 Evolución de Habit Formation
            </h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Actual: <span className="font-semibold text-purple-600">{stats.habitFormation?.powerUsersPercentage || 0}% power users</span>
            </div>
          </div>
          
          <div className="relative">
            {/* Gráfico de líneas temporal */}
            <div className="relative h-80 border border-gray-200 dark:border-gray-700 p-4">
              <svg width="100%" height="100%" viewBox="0 0 700 280" className="overflow-visible">
                {/* Líneas de referencia horizontales */}
                {[0, 20, 40, 60, 80, 100].map(y => (
                  <g key={y}>
                    <line 
                      x1="60" 
                      y1={220 - (y * 2)} 
                      x2="640" 
                      y2={220 - (y * 2)} 
                      stroke="currentColor" 
                      strokeWidth="0.5" 
                      className="text-gray-300 dark:text-gray-600"
                    />
                    <text 
                      x="55" 
                      y={220 - (y * 2) + 4} 
                      className="text-xs fill-gray-500 dark:fill-gray-400" 
                      textAnchor="end"
                    >
                      {y}%
                    </text>
                  </g>
                ))}
                
                {/* Zonas de referencia */}
                <rect x="60" y={220 - (25 * 2)} width="580" height="170" fill="rgb(147, 51, 234)" opacity="0.05" />
                <text x="70" y={220 - (25 * 2) + 15} className="text-xs fill-purple-600 dark:fill-purple-400">Zona objetivo 25%+ power users</text>
                
                <rect x="60" y={220 - (50 * 2)} width="580" height="120" fill="rgb(249, 115, 22)" opacity="0.05" />
                <text x="70" y={220 - (50 * 2) + 15} className="text-xs fill-orange-600 dark:fill-orange-400">Zona objetivo 50%+ weekly active</text>
                
                {/* Líneas de datos */}
                {stats.habitFormationHistory.length > 1 && (
                  <>
                    {/* Línea Power Users (púrpura) */}
                    <polyline
                      points={stats.habitFormationHistory.map((point, index) => {
                        const x = 60 + (index * (580 / (stats.habitFormationHistory.length - 1)))
                        const y = 220 - (Math.min(point.powerUsersPercent, 100) * 2)
                        return `${x},${y}`
                      }).join(' ')}
                      fill="none"
                      stroke="rgb(147, 51, 234)"
                      strokeWidth="3"
                      className="drop-shadow-sm"
                    />
                    
                    {/* Línea Weekly Active (naranja) */}
                    <polyline
                      points={stats.habitFormationHistory.map((point, index) => {
                        const x = 60 + (index * (580 / (stats.habitFormationHistory.length - 1)))
                        const y = 220 - (Math.min(point.weeklyActivePercent, 100) * 2)
                        return `${x},${y}`
                      }).join(' ')}
                      fill="none"
                      stroke="rgb(249, 115, 22)"
                      strokeWidth="3"
                      className="drop-shadow-sm"
                    />
                  </>
                )}
                
                {/* Puntos de datos */}
                {stats.habitFormationHistory.map((point, index) => {
                  const x = 60 + (index * (580 / Math.max(1, stats.habitFormationHistory.length - 1)))
                  const isLast = index === stats.habitFormationHistory.length - 1
                  
                  const powerValue = Math.min(point.powerUsersPercent, 100)
                  const weeklyValue = Math.min(point.weeklyActivePercent, 100)
                  
                  return (
                    <g key={point.month}>
                      {/* Puntos con valores */}
                      <circle
                        cx={x}
                        cy={220 - (powerValue * 2)}
                        r={isLast ? "5" : "3"}
                        fill="rgb(147, 51, 234)"
                        className="drop-shadow-sm cursor-pointer hover:r-6 transition-all"
                        title={`${point.month}: ${powerValue}% power users (3+ días/sem)`}
                      />
                      <text
                        x={x}
                        y={220 - (powerValue * 2) - 8}
                        className="text-xs fill-purple-600 dark:fill-purple-400 font-semibold"
                        textAnchor="middle"
                      >
                        {powerValue}%
                      </text>
                      
                      <circle
                        cx={x}
                        cy={220 - (weeklyValue * 2)}
                        r={isLast ? "5" : "3"}
                        fill="rgb(249, 115, 22)"
                        className="drop-shadow-sm cursor-pointer hover:r-6 transition-all"
                        title={`${point.month}: ${weeklyValue}% weekly active (7+ tests/mes)`}
                      />
                      <text
                        x={x}
                        y={220 - (weeklyValue * 2) - 8}
                        className="text-xs fill-orange-600 dark:fill-orange-400 font-semibold"
                        textAnchor="middle"
                      >
                        {weeklyValue}%
                      </text>
                      
                      {/* Etiqueta de tiempo */}
                      <text
                        x={x}
                        y="245"
                        className="text-xs fill-gray-500 dark:fill-gray-400"
                        textAnchor="middle"
                      >
                        {point.month}
                      </text>
                    </g>
                  )
                })}
                
              </svg>
            </div>
            
            {/* Leyenda */}
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">Power Users (3+ días/sem)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">Weekly Active (7+ tests/mes)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de evolución True Retention Rate */}
      {stats.retentionRateHistory && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🎯 Evolución de True Retention Rate
            </h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Promedio actual: <span className="font-semibold text-green-600">
                {stats.retentionAnalysis ? Math.round(stats.retentionAnalysis.reduce((sum, c) => sum + c.day1Retention, 0) / stats.retentionAnalysis.filter(c => c.registered > 0).length || 0) : 0}%
              </span> Day 1
            </div>
          </div>
          
          <div className="relative">
            {/* Gráfico de líneas temporal */}
            <div className="relative h-80 border border-gray-200 dark:border-gray-700 p-4">
              <svg width="100%" height="100%" viewBox="0 0 700 280" className="overflow-visible">
                {/* Líneas de referencia horizontales */}
                {[0, 20, 40, 60, 80, 100].map(y => (
                  <g key={y}>
                    <line 
                      x1="60" 
                      y1={220 - (y * 2)} 
                      x2="640" 
                      y2={220 - (y * 2)} 
                      stroke="currentColor" 
                      strokeWidth="0.5" 
                      className="text-gray-300 dark:text-gray-600"
                    />
                    <text 
                      x="55" 
                      y={220 - (y * 2) + 4} 
                      className="text-xs fill-gray-500 dark:fill-gray-400" 
                      textAnchor="end"
                    >
                      {y}%
                    </text>
                  </g>
                ))}
                
                {/* Zonas de referencia */}
                <rect x="60" y={220 - (40 * 2)} width="580" height="140" fill="rgb(34, 197, 94)" opacity="0.05" />
                <text x="70" y={220 - (40 * 2) + 15} className="text-xs fill-green-600 dark:fill-green-400">Zona objetivo 40%+</text>
                
                <rect x="60" y={220 - (25 * 2)} width="580" height="170" fill="rgb(59, 130, 246)" opacity="0.05" />
                <text x="70" y={220 - (25 * 2) + 15} className="text-xs fill-blue-600 dark:fill-blue-400">Zona objetivo 25%+</text>
                
                {/* Líneas de datos */}
                {stats.retentionRateHistory.length > 1 && (
                  <>
                    {/* Línea Day 1 (verde) */}
                    <polyline
                      points={stats.retentionRateHistory.map((point, index) => {
                        const x = 60 + (index * (580 / (stats.retentionRateHistory.length - 1)))
                        const y = 220 - (Math.min(point.day1Retention, 100) * 2)
                        return `${x},${y}`
                      }).join(' ')}
                      fill="none"
                      stroke="rgb(34, 197, 94)"
                      strokeWidth="3"
                      className="drop-shadow-sm"
                    />
                    
                    {/* Línea Day 7 (azul) */}
                    <polyline
                      points={stats.retentionRateHistory.map((point, index) => {
                        const x = 60 + (index * (580 / (stats.retentionRateHistory.length - 1)))
                        const y = 220 - (Math.min(point.day7Retention, 100) * 2)
                        return `${x},${y}`
                      }).join(' ')}
                      fill="none"
                      stroke="rgb(59, 130, 246)"
                      strokeWidth="3"
                      className="drop-shadow-sm"
                    />
                    
                    {/* Línea Day 30 (púrpura) */}
                    <polyline
                      points={stats.retentionRateHistory.map((point, index) => {
                        const x = 60 + (index * (580 / (stats.retentionRateHistory.length - 1)))
                        const y = 220 - (Math.min(point.day30Retention, 100) * 2)
                        return `${x},${y}`
                      }).join(' ')}
                      fill="none"
                      stroke="rgb(147, 51, 234)"
                      strokeWidth="3"
                      className="drop-shadow-sm"
                    />
                  </>
                )}
                
                {/* Puntos de datos y etiquetas */}
                {stats.retentionRateHistory.map((point, index) => {
                  const x = 60 + (index * (580 / Math.max(1, stats.retentionRateHistory.length - 1)))
                  const isLast = index === stats.retentionRateHistory.length - 1
                  
                  // Limitar valores a 100% máximo
                  const day1Value = Math.min(point.day1Retention, 100)
                  const day7Value = Math.min(point.day7Retention, 100)
                  const day30Value = Math.min(point.day30Retention, 100)
                  
                  return (
                    <g key={point.period}>
                      {/* Puntos con valores */}
                      <circle
                        cx={x}
                        cy={220 - (day1Value * 2)}
                        r={isLast ? "5" : "3"}
                        fill="rgb(34, 197, 94)"
                        className="drop-shadow-sm cursor-pointer hover:r-6 transition-all"
                        title={`${point.periodLabel}: ${day1Value}% Day 1 retention`}
                      />
                      <text
                        x={x}
                        y={220 - (day1Value * 2) - 8}
                        className="text-xs fill-green-600 dark:fill-green-400 font-semibold"
                        textAnchor="middle"
                      >
                        {day1Value}%
                      </text>
                      
                      <circle
                        cx={x}
                        cy={220 - (day7Value * 2)}
                        r={isLast ? "5" : "3"}
                        fill="rgb(59, 130, 246)"
                        className="drop-shadow-sm cursor-pointer hover:r-6 transition-all"
                        title={`${point.periodLabel}: ${day7Value}% Day 7 retention`}
                      />
                      <text
                        x={x}
                        y={220 - (day7Value * 2) - 8}
                        className="text-xs fill-blue-600 dark:fill-blue-400 font-semibold"
                        textAnchor="middle"
                      >
                        {day7Value}%
                      </text>
                      
                      <circle
                        cx={x}
                        cy={220 - (day30Value * 2)}
                        r={isLast ? "5" : "3"}
                        fill="rgb(147, 51, 234)"
                        className="drop-shadow-sm cursor-pointer hover:r-6 transition-all"
                        title={`${point.periodLabel}: ${day30Value}% Day 30 retention`}
                      />
                      <text
                        x={x}
                        y={220 - (day30Value * 2) - 8}
                        className="text-xs fill-purple-600 dark:fill-purple-400 font-semibold"
                        textAnchor="middle"
                      >
                        {day30Value}%
                      </text>
                      
                      {/* Etiqueta de tiempo */}
                      <text
                        x={x}
                        y="245"
                        className="text-xs fill-gray-500 dark:fill-gray-400"
                        textAnchor="middle"
                      >
                        {point.periodLabel}
                      </text>
                    </g>
                  )
                })}
                
              </svg>
            </div>
            
            {/* Leyenda */}
            <div className="flex justify-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">Day 1 Retention</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">Day 7 Retention</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">Day 30 Retention</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* True Retention Rate */}
      {stats.retentionAnalysis && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🎯 True Retention Rate
            </h3>
            <button 
              onClick={() => setShowRetentionModal(true)}
              className="w-4 h-4 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 rounded-full flex items-center justify-center transition-colors"
              title="Ver información detallada"
            >
              <span className="text-xs text-blue-600 dark:text-blue-400">❓</span>
            </button>
          </div>
          <div className="mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              ¿Los usuarios vuelven después del registro? Day 1, 7 y 30 retention por cohorte
            </p>
            
            {/* Análisis dinámico personalizado */}
            {(() => {
              const validCohorts = stats.retentionAnalysis.filter(c => c.registered > 0)
              if (validCohorts.length === 0) {
                return (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      📊 No hay suficientes datos de cohortes recientes para análisis
                    </p>
                  </div>
                )
              }
              
              const avgDay1 = Math.round(validCohorts.reduce((sum, c) => sum + c.day1Retention, 0) / validCohorts.length)
              const avgDay7 = Math.round(validCohorts.reduce((sum, c) => sum + c.day7Retention, 0) / validCohorts.length)
              const avgDay30 = Math.round(validCohorts.reduce((sum, c) => sum + c.day30Retention, 0) / validCohorts.length)
              
              let insights = []
              let alertLevel = "info"
              
              // Análisis Day 1
              if (avgDay1 >= 40) {
                insights.push("🚀 Excelente primer contacto - usuarios vuelven al día siguiente")
                alertLevel = "success"
              } else if (avgDay1 >= 20) {
                insights.push("📈 Primer contacto aceptable, pero hay margen de mejora")
                alertLevel = "warning"
              } else {
                insights.push("❌ CRÍTICO: Muy pocos usuarios vuelven al día siguiente - onboarding deficiente")
                alertLevel = "error"
              }
              
              // Análisis Day 7
              if (avgDay7 >= 25) {
                insights.push("✅ Los usuarios ven valor en la primera semana")
              } else if (avgDay7 >= 15) {
                insights.push("⚠️ Algunos usuarios abandonan en la primera semana")
              } else {
                insights.push("🔴 PROBLEMA: Muy pocos usuarios vuelven después de una semana")
                alertLevel = "error"
              }
              
              // Análisis Day 30
              if (avgDay30 >= 15) {
                insights.push("💪 Buena formación de hábito a largo plazo")
              } else if (avgDay30 >= 10) {
                insights.push("📊 Retención mensual mejorable")
              } else {
                insights.push("⚡ Urgente: Casi nadie forma hábitos duraderos")
                alertLevel = "error"
              }
              
              // Recomendaciones específicas
              let recommendations = []
              if (avgDay1 < 30) {
                recommendations.push("Simplificar primer test, añadir tutorial interactivo")
              }
              if (avgDay7 < 20) {
                recommendations.push("Email de reactivación día 3, mostrar progreso personal")
              }
              if (avgDay30 < 15) {
                recommendations.push("Gamificación, streaks, recordatorios inteligentes")
              }
              
              const bgColor = alertLevel === "error" ? "bg-red-50 dark:bg-red-900/20" :
                             alertLevel === "warning" ? "bg-yellow-50 dark:bg-yellow-900/20" :
                             alertLevel === "success" ? "bg-green-50 dark:bg-green-900/20" :
                             "bg-blue-50 dark:bg-blue-900/20"
              
              return (
                <div className={`p-4 rounded-lg ${bgColor}`}>
                  <p className="font-medium text-sm mb-2">
                    📊 Análisis para Vence (promedio: {avgDay1}% / {avgDay7}% / {avgDay30}%):
                  </p>
                  <ul className="text-sm space-y-1 mb-3">
                    {insights.map((insight, i) => (
                      <li key={i}>• {insight}</li>
                    ))}
                  </ul>
                  {recommendations.length > 0 && (
                    <div>
                      <p className="font-medium text-sm mb-1">🎯 Acciones recomendadas:</p>
                      <ul className="text-sm space-y-1">
                        {recommendations.map((rec, i) => (
                          <li key={i}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-gray-600 dark:text-gray-400">Cohorte</th>
                  <th className="text-center py-2 text-gray-600 dark:text-gray-400">Registrados</th>
                  <th className="text-center py-2 text-green-600">Day 1</th>
                  <th className="text-center py-2 text-blue-600">Day 7</th>
                  <th className="text-center py-2 text-purple-600">Day 30</th>
                </tr>
              </thead>
              <tbody>
                {stats.retentionAnalysis.map((cohort, index) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3 font-medium text-gray-700 dark:text-gray-300">
                      {cohort.weekLabel || cohort.week}
                    </td>
                    <td className="text-center py-3 text-gray-600 dark:text-gray-400">
                      {cohort.registered}
                    </td>
                    <td className="text-center py-3">
                      <span className={`font-semibold ${
                        cohort.day1Retention >= 40 ? 'text-green-600' :
                        cohort.day1Retention >= 20 ? 'text-yellow-600' : 'text-red-500'
                      }`}>
                        {cohort.day1Retention}%
                      </span>
                    </td>
                    <td className="text-center py-3">
                      <span className={`font-semibold ${
                        cohort.day7Retention >= 30 ? 'text-green-600' :
                        cohort.day7Retention >= 15 ? 'text-yellow-600' : 'text-red-500'
                      }`}>
                        {cohort.day7Retention}%
                      </span>
                    </td>
                    <td className="text-center py-3">
                      <span className={`font-semibold ${
                        cohort.day30Retention >= 20 ? 'text-green-600' :
                        cohort.day30Retention >= 10 ? 'text-yellow-600' : 'text-red-500'
                      }`}>
                        {cohort.day30Retention}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Promedios */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                {Math.round(stats.retentionAnalysis.reduce((sum, c) => sum + c.day1Retention, 0) / stats.retentionAnalysis.filter(c => c.registered > 0).length || 0)}%
              </div>
              <div className="text-xs text-gray-500">Promedio Day 1</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {Math.round(stats.retentionAnalysis.reduce((sum, c) => sum + c.day7Retention, 0) / stats.retentionAnalysis.filter(c => c.registered > 0).length || 0)}%
              </div>
              <div className="text-xs text-gray-500">Promedio Day 7</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-purple-600">
                {Math.round(stats.retentionAnalysis.reduce((sum, c) => sum + c.day30Retention, 0) / stats.retentionAnalysis.filter(c => c.registered > 0).length || 0)}%
              </div>
              <div className="text-xs text-gray-500">Promedio Day 30</div>
            </div>
          </div>
        </div>
      )}

      {/* Análisis de cohortes por retención */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            📊 Análisis de Retención por Cohortes
          </h3>
          <button 
            onClick={() => setShowCohortModal(true)}
            className="w-4 h-4 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 rounded-full flex items-center justify-center transition-colors"
            title="Ver información detallada"
          >
            <span className="text-xs text-blue-600 dark:text-blue-400">❓</span>
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Retención de usuarios registrados por semana de registro
        </p>
        
        <div className="space-y-2">
          {stats.cohortAnalysis.map((cohort, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">
                    {cohort.week}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {cohort.registered} registrados
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {cohort.active} activos
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full"
                  style={{width: '100px'}}
                >
                  <div 
                    className="h-2 bg-blue-600 rounded-full transition-all"
                    style={{width: `${cohort.retentionRate}%`}}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-12 text-right">
                  {cohort.retentionRate}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal DAU/MAU */}
      {showDAUModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  📊 ¿Qué significa tu DAU/MAU de {stats?.dauMauRatio}%?
                </h3>
                <button 
                  onClick={() => setShowDAUModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-4">
                <div>
                  <p className="font-medium mb-2">Definiciones:</p>
                  <p><strong>DAU (Daily Active Users):</strong> {stats?.averageDAU} usuarios únicos promedio diario (últimos 7 días)</p>
                  <p><strong>MAU (Monthly Active Users):</strong> {stats?.MAU} usuarios únicos en los últimos 30 días</p>
                </div>
                
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <p className="font-medium mb-2">Tu nivel actual:</p>
                  <div className="text-sm">
                    {stats?.dauMauRatio < 10 && (
                      <span className="text-orange-600">📊 Engagement bajo - Los usuarios usan la app ocasionalmente</span>
                    )}
                    {stats?.dauMauRatio >= 10 && stats?.dauMauRatio < 20 && (
                      <span className="text-yellow-600">📈 Engagement medio - App útil pero no diaria</span>
                    )}
                    {stats?.dauMauRatio >= 20 && stats?.dauMauRatio < 50 && (
                      <span className="text-green-600">🚀 Engagement bueno - Los usuarios han desarrollado un hábito</span>
                    )}
                    {stats?.dauMauRatio >= 50 && (
                      <span className="text-purple-600">⭐ Engagement excepcional - App tipo red social/juego adictivo</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Significa que de cada 100 usuarios mensuales, {stats?.dauMauRatio} la usan diariamente
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <p className="font-medium mb-2">⚠️ Limitaciones en apps pequeñas:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-orange-600">Volatilidad extrema</span>: Con {stats?.MAU} MAU, un solo usuario puede cambiar el ratio del 0% al {Math.round(100/stats?.MAU)}%</li>
                    <li>• <span className="text-yellow-600">100% engañoso</span>: 1 usuario activo de 1 total = 100% pero no es significativo</li>
                    <li>• <span className="text-red-600">Poco fiable</span>: DAU/MAU es útil con 500+ MAU, muy volátil con {'<'}100 MAU</li>
                    <li>• <span className="text-blue-600">Mejor métrica</span>: Activation Rate ({stats?.registeredActiveRatio}%) es más estable</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                  <p className="font-medium mb-2">📊 ¿Cuándo DAU/MAU se vuelve útil?</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-purple-600">100+ MAU</span>: Empieza a ser indicativo</li>
                    <li>• <span className="text-blue-600">250+ MAU</span>: Útil para decisiones de producto</li>
                    <li>• <span className="text-green-600">500+ MAU</span>: Confiable para benchmarking</li>
                    <li>• <span className="text-orange-600">Tu estado</span>: Con {stats?.MAU} MAU, enfócate en Activation Rate</li>
                  </ul>
                </div>

                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="font-medium mb-2">💡 Para Vence específicamente:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-green-600">{stats?.registeredActiveRatio}% activación</span> ({stats?.MAU}/{stats?.totalUsers}) es excelente</li>
                    <li>• <span className="text-blue-600">Enfoque</span>: Activar usuarios dormidos vs. mejorar DAU/MAU</li>
                    <li>• <span className="text-purple-600">Meta</span>: Llegar a 250+ MAU para DAU/MAU confiable</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Usuarios Registrados Activos */}
      {showActivationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  📊 ¿Qué significa tu {stats?.registeredActiveRatio}% de Activation Rate?
                </h3>
                <button 
                  onClick={() => setShowActivationModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-4">
                <div>
                  <p className="font-medium mb-2">¿Qué mide esta métrica?</p>
                  <p><strong>Activation Rate:</strong> Del total de usuarios que se han registrado en Vence, ¿cuántos han usado la app en los últimos 30 días?</p>
                  <p className="mt-2"><strong>Tu situación:</strong> {stats?.MAU} usuarios activos de {stats?.totalUsers} registrados = {stats?.registeredActiveRatio}%</p>
                </div>
                
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <p className="font-medium mb-2">¿Es bueno tu {stats?.registeredActiveRatio}%?</p>
                  <div className="text-sm">
                    {stats?.registeredActiveRatio >= 60 && (
                      <span className="text-green-600">🚀 Excepcional - Muy pocos usuarios abandonan Vence</span>
                    )}
                    {stats?.registeredActiveRatio >= 40 && stats?.registeredActiveRatio < 60 && (
                      <span className="text-green-600">✅ Excelente - Gran retención de usuarios</span>
                    )}
                    {stats?.registeredActiveRatio >= 25 && stats?.registeredActiveRatio < 40 && (
                      <span className="text-yellow-600">📈 Bueno - Por encima del promedio de apps educativas</span>
                    )}
                    {stats?.registeredActiveRatio < 25 && (
                      <span className="text-orange-600">📊 Mejorable - Muchos usuarios se registran pero no vuelven</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Benchmark: Apps educativas típicamente tienen 15-30% de activación
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <p className="font-medium mb-2">💡 ¿Por qué es mejor que DAU/MAU?</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-blue-600">Más estable</span>: No fluctúa tanto día a día</li>
                    <li>• <span className="text-green-600">Accionable</span>: Te dice cuántos usuarios "dormidos" puedes reactivar</li>
                    <li>• <span className="text-purple-600">Realista</span>: Considera toda tu base de usuarios, no solo los activos</li>
                    <li>• <span className="text-orange-600">Estratégico</span>: Ayuda a decidir entre adquirir vs. reactivar usuarios</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="font-medium mb-2">🎯 Para mejorar tu activación:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-green-600">Usuarios dormidos</span>: {stats?.totalUsers - stats?.MAU} usuarios no usan Vence (oportunidad de reactivación)</li>
                    <li>• <span className="text-blue-600">Email marketing</span>: Recordatorios a usuarios inactivos</li>
                    <li>• <span className="text-purple-600">Onboarding</span>: ¿Los nuevos usuarios entienden cómo usar Vence?</li>
                    <li>• <span className="text-orange-600">Valor inmediato</span>: ¿El primer test muestra valor claro?</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Análisis de Cohortes */}
      {showCohortModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  📊 ¿Qué es el Análisis de Retención por Cohortes?
                </h3>
                <button 
                  onClick={() => setShowCohortModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-4">
                <div>
                  <p className="font-medium mb-2">¿Qué mide esta métrica?</p>
                  <p><strong>Cohort Retention:</strong> Agrupa usuarios por semana de registro y mide cuántos siguen activos después de un tiempo.</p>
                  <p className="mt-2"><strong>Ejemplo:</strong> De 26 usuarios que se registraron en Semana 2, 18 siguen activos = 69% retención</p>
                </div>
                
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <p className="font-medium mb-2">¿Cómo leer los datos?</p>
                  <ul className="text-sm space-y-1">
                    <li>• <strong>Semana 1:</strong> Usuarios registrados hace 1 semana</li>
                    <li>• <strong>Semana 8:</strong> Usuarios registrados hace 8 semanas</li>
                    <li>• <strong>% Retención:</strong> Cuántos de esos usuarios siguen activos hoy</li>
                    <li>• <strong>0% normal:</strong> En semanas sin registros nuevos</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <p className="font-medium mb-2">💡 ¿Por qué es importante?</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-blue-600">Predice LTV</span>: ¿Los usuarios se quedan o abandonan?</li>
                    <li>• <span className="text-green-600">Identifica problemas</span>: ¿Una cohorte específica tiene mala retención?</li>
                    <li>• <span className="text-purple-600">Mide onboarding</span>: ¿Los nuevos usuarios "enganchan"?</li>
                    <li>• <span className="text-orange-600">Optimiza timing</span>: ¿Cuándo enviar emails de reactivación?</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <p className="font-medium mb-2">⚠️ Interpretación para Vence:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-yellow-600">Retención alta (50%+)</span>: Usuarios encuentran valor en los tests</li>
                    <li>• <span className="text-orange-600">Retención baja ({'<'}25%)</span>: Onboarding o producto necesita mejoras</li>
                    <li>• <span className="text-blue-600">Semanas con 0%</span>: Normal si no hubo registros esa semana</li>
                    <li>• <span className="text-green-600">Tendencia ascendente</span>: Producto mejorando con el tiempo</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="font-medium mb-2">🎯 Benchmarks apps educativas:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-green-600">Semana 1:</span> 40-60% (usuarios recientes)</li>
                    <li>• <span className="text-blue-600">Semana 4:</span> 25-40% (mes completo)</li>
                    <li>• <span className="text-purple-600">Semana 8+:</span> 15-25% (usuarios fieles)</li>
                    <li>• <span className="text-orange-600">Tu objetivo:</span> Mantener {'>'}30% en semanas 2-4</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal MAU */}
      {showMAUModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  📊 ¿Qué significa tu MAU de {stats?.MAU}?
                </h3>
                <button 
                  onClick={() => setShowMAUModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-4">
                <div>
                  <p className="font-medium mb-2">¿Qué es MAU?</p>
                  <p><strong>Monthly Active Users:</strong> Número de usuarios únicos que han usado Vence en los últimos 30 días.</p>
                  <p className="mt-2"><strong>Tu situación:</strong> {stats?.MAU} usuarios han hecho al menos 1 test en el último mes</p>
                </div>
                
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <p className="font-medium mb-2">¿Es bueno tu MAU de {stats?.MAU}?</p>
                  <div className="text-sm">
                    {stats?.MAU >= 100 && (
                      <span className="text-green-600">🎯 Base sólida - Tienes una comunidad activa establecida</span>
                    )}
                    {stats?.MAU >= 50 && stats?.MAU < 100 && (
                      <span className="text-yellow-600">📈 Creciendo - En camino a una base sólida de usuarios</span>
                    )}
                    {stats?.MAU < 50 && (
                      <span className="text-orange-600">🌱 Fase inicial - Enfócate en retener y hacer crecer tu base</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Para apps educativas B2C, 50+ MAU indica tracción inicial
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <p className="font-medium mb-2">💡 ¿Por qué MAU es importante?</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-blue-600">Métrica de salud</span>: Indica cuánta gente encuentra valor real</li>
                    <li>• <span className="text-green-600">Base para crecer</span>: MAU sólido = fundación para escalar</li>
                    <li>• <span className="text-purple-600">Predice ingresos</span>: Más MAU = más potencial de monetización</li>
                    <li>• <span className="text-orange-600">Compara progreso</span>: Fácil de trackear mes a mes</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <p className="font-medium mb-2">📈 Cómo crecer tu MAU:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-yellow-600">Reactivar dormidos</span>: {stats?.totalUsers - stats?.MAU} usuarios inactivos disponibles</li>
                    <li>• <span className="text-green-600">Mejorar onboarding</span>: Que nuevos usuarios completen primer test</li>
                    <li>• <span className="text-blue-600">Contenido regular</span>: Nuevas preguntas para que vuelvan</li>
                    <li>• <span className="text-purple-600">Notificaciones</span>: Recordatorios inteligentes de estudio</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="font-medium mb-2">🎯 Benchmarks y objetivos:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-green-600">Apps educativas nicho:</span> 25-100 MAU (fase temprana)</li>
                    <li>• <span className="text-blue-600">Growth consistente:</span> +10-20% MAU mes a mes</li>
                    <li>• <span className="text-purple-600">Tu próximo hito:</span> {stats?.MAU < 100 ? '100 MAU' : '200 MAU'} (base sólida)</li>
                    <li>• <span className="text-orange-600">Meta ambiciosa:</span> 500+ MAU (mercado significativo)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal True Retention Rate */}
      {showRetentionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  🎯 ¿Qué es True Retention Rate?
                </h3>
                <button 
                  onClick={() => setShowRetentionModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-4">
                <div>
                  <p className="font-medium mb-2">¿Qué mide esta métrica?</p>
                  <p><strong>True Retention:</strong> De usuarios que se registraron en una fecha específica, ¿cuántos vuelven después de X días?</p>
                  <p className="mt-2"><strong>Diferencia clave:</strong> No es "están activos ahora", sino "volvieron después del registro"</p>
                </div>
                
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <p className="font-medium mb-2">¿Cómo leer los datos?</p>
                  <ul className="text-sm space-y-1">
                    <li>• <strong>Day 1 Retention:</strong> ¿Volvieron al día siguiente del registro?</li>
                    <li>• <strong>Day 7 Retention:</strong> ¿Volvieron en la primera semana?</li>
                    <li>• <strong>Day 30 Retention:</strong> ¿Siguieron usando después de un mes?</li>
                    <li>• <strong>Por cohorte:</strong> Cada fila = usuarios registrados esa semana</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <p className="font-medium mb-2">💡 ¿Por qué es la métrica más importante?</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-blue-600">Predice LTV real</span>: Si no vuelven, no generarán valor</li>
                    <li>• <span className="text-green-600">Mide onboarding</span>: Day 1 bajo = onboarding malo</li>
                    <li>• <span className="text-purple-600">Detecta problemas</span>: Caída en Day 7 = producto no engancha</li>
                    <li>• <span className="text-orange-600">Es accionable</span>: Sabes exactamente cuándo pierdes usuarios</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <p className="font-medium mb-2">📊 Benchmarks apps educativas:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-green-600">Day 1: 40%+</span> = Excelente primer contacto</li>
                    <li>• <span className="text-blue-600">Day 7: 25%+</span> = Producto engancha</li>
                    <li>• <span className="text-purple-600">Day 30: 15%+</span> = Formación de hábito</li>
                    <li>• <span className="text-red-500">Señales rojas:</span> Day 1 {'<'}20%, Day 7 {'<'}10%</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="font-medium mb-2">🎯 Cómo mejorar cada fase:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-green-600">Day 1 bajo:</span> Onboarding terrible, primer test muy difícil</li>
                    <li>• <span className="text-blue-600">Day 7 bajo:</span> No ven valor, tests aburridos</li>
                    <li>• <span className="text-purple-600">Day 30 bajo:</span> No hay hábito, falta gamificación</li>
                    <li>• <span className="text-orange-600">Estrategia:</span> Emails específicos por día de retención</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Engagement Depth */}
      {showEngagementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  📈 ¿Qué es Engagement Depth?
                </h3>
                <button 
                  onClick={() => setShowEngagementModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-4">
                <div>
                  <p className="font-medium mb-2">¿Qué mide esta métrica?</p>
                  <p><strong>Engagement Depth:</strong> Mide la CALIDAD del engagement, no solo la cantidad. ¿Los usuarios que se quedan realmente usan la app intensivamente?</p>
                  <p className="mt-2"><strong>Diferencia clave:</strong> Un usuario puede ser "activo" con 1 test/mes vs. otro con 20 tests/mes</p>
                </div>
                
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <p className="font-medium mb-2">Métricas incluidas:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <strong>Tests por usuario activo:</strong> Intensidad de uso promedio</li>
                    <li>• <strong>Días activos/mes:</strong> Frecuencia de regreso</li>
                    <li>• <strong>Streak promedio:</strong> Días consecutivos máximos</li>
                    <li>• <strong>Distribución:</strong> Casual vs Regular vs Power users</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <p className="font-medium mb-2">💡 ¿Por qué es importante?</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-blue-600">Predice LTV</span>: Power users valen 10x más que casuales</li>
                    <li>• <span className="text-green-600">Detecta engagement real</span>: ¿Los usuarios realmente usan o solo "prueban"?</li>
                    <li>• <span className="text-purple-600">Segmentación</span>: Diferentes estrategias para cada tipo</li>
                    <li>• <span className="text-orange-600">Product-market fit</span>: High depth = producto adictivo</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <p className="font-medium mb-2">📊 Benchmarks para Vence:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-green-600">Tests/usuario: 8+</span> = Engagement profundo</li>
                    <li>• <span className="text-blue-600">Días activos: 6+</span> = Uso regular</li>
                    <li>• <span className="text-purple-600">Streak: 4+ días</span> = Formación de hábito</li>
                    <li>• <span className="text-orange-600">Power users: 30%+</span> = Base sólida</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="font-medium mb-2">🎯 Para Vence específicamente:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-green-600">Casual users</span>: Email de "¿cómo van los estudios?"</li>
                    <li>• <span className="text-blue-600">Regular users</span>: Recordatorios de consistencia</li>
                    <li>• <span className="text-purple-600">Power users</span>: Features avanzadas, referrals</li>
                    <li>• <span className="text-orange-600">Streak bajo</span>: Gamificación y objetivos diarios</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Habit Formation */}
      {showHabitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  💪 ¿Qué es Habit Formation?
                </h3>
                <button 
                  onClick={() => setShowHabitModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-4">
                <div>
                  <p className="font-medium mb-2">¿Qué mide esta métrica?</p>
                  <p><strong>Habit Formation:</strong> ¿Los usuarios han convertido Vence en un HÁBITO? Mide la frecuencia y consistencia del uso.</p>
                  <p className="mt-2"><strong>Clave del éxito:</strong> Apps que forman hábitos tienen LTV 10x mayor y retención masiva</p>
                </div>
                
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <p className="font-medium mb-2">Métricas de hábito:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <strong>Power Users:</strong> 3+ días/semana (hábito fuerte)</li>
                    <li>• <strong>Weekly Active:</strong> 7+ tests/mes (uso consistente)</li>
                    <li>• <strong>Sesiones/semana:</strong> Intensidad general</li>
                    <li>• <strong>Distribución:</strong> Ocasional → Regular → Habitual</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                  <p className="font-medium mb-2">🧠 Ciencia del hábito:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-purple-600">21 días</span>: Tiempo mínimo para formar hábito</li>
                    <li>• <span className="text-blue-600">3+ días/semana</span>: Frecuencia crítica</li>
                    <li>• <span className="text-green-600">Consistencia {'>'} intensidad</span>: Mejor 10 min diarios que 2h semanales</li>
                    <li>• <span className="text-orange-600">Triggers</span>: Notificaciones, recordatorios, contexto</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <p className="font-medium mb-2">📊 Benchmarks apps educativas:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-green-600">Power Users: 25%+</span> = Hábito exitoso</li>
                    <li>• <span className="text-blue-600">Weekly Active: 40%+</span> = Engagement sólido</li>
                    <li>• <span className="text-purple-600">Ocasional {'<'} 50%</span> = Mayoría debe ser Regular+</li>
                    <li>• <span className="text-red-500">Señal roja:</span> {'<'}15% power users</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="font-medium mb-2">🎯 Estrategias de formación de hábito:</p>
                  <ul className="text-sm space-y-1">
                    <li>• <span className="text-green-600">Daily goals</span>: "Haz 1 test al día"</li>
                    <li>• <span className="text-blue-600">Streaks</span>: Gamificación de consistencia</li>
                    <li>• <span className="text-purple-600">Time-based triggers</span>: "Tu test de las 19:00"</li>
                    <li>• <span className="text-orange-600">Progress visible</span>: "Llevas 5 días seguidos"</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}