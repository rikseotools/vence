// lib/debug/medalDebug.js
// Funciones para debuggear el sistema de medallas

export async function debugMedalSystem(supabase, userId) {
  console.log('🔍 === DEBUG SISTEMA DE MEDALLAS ===')
  console.log('🔍 Usuario:', userId)
  
  if (!supabase || !userId) {
    console.log('❌ No hay supabase o userId')
    return
  }

  try {
    const now = new Date()
    
    // Definir períodos
    const periods = {
      today: {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      },
      week: {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: now
      }
    }

    console.log('🔍 Períodos:', periods)

    // Verificar datos para cada período
    for (const [periodName, period] of Object.entries(periods)) {
      console.log(`\n🔍 === PERÍODO: ${periodName.toUpperCase()} ===`)
      console.log('🔍 Desde:', period.start.toISOString())
      console.log('🔍 Hasta:', period.end.toISOString())
      
      // Obtener respuestas del período
      const { data: responses, error } = await supabase
        .from('test_questions')
        .select(`
          tests!inner(user_id),
          is_correct,
          created_at
        `)
        .eq('tests.is_completed', true)
        .gte('created_at', period.start.toISOString())
        .lte('created_at', period.end.toISOString())

      if (error) {
        console.log('❌ Error obteniendo responses:', error)
        continue
      }

      console.log(`🔍 Total respuestas en ${periodName}:`, responses?.length || 0)
      
      // Procesar por usuario
      const userStats = {}
      responses?.forEach(response => {
        const responseUserId = response.tests.user_id
        if (!userStats[responseUserId]) {
          userStats[responseUserId] = {
            userId: responseUserId,
            totalQuestions: 0,
            correctAnswers: 0,
            accuracy: 0
          }
        }
        
        userStats[responseUserId].totalQuestions++
        if (response.is_correct) {
          userStats[responseUserId].correctAnswers++
        }
      })

      // Calcular accuracy y ordenar
      const ranking = Object.values(userStats)
        .filter(user => user.totalQuestions >= 5)
        .map(user => ({
          ...user,
          accuracy: Math.round((user.correctAnswers / user.totalQuestions) * 100)
        }))
        .sort((a, b) => {
          if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy
          return b.totalQuestions - a.totalQuestions
        })

      console.log(`🔍 Ranking ${periodName}:`, ranking)
      console.log(`🔍 Total usuarios en ranking:`, ranking.length)
      
      // Encontrar posición del usuario actual
      const userRank = ranking.findIndex(user => user.userId === userId) + 1
      console.log(`🔍 Tu posición: ${userRank} (${userRank === 0 ? 'No estás en el ranking' : '#' + userRank})`)
      
      if (userRank > 0) {
        const userStats = ranking[userRank - 1]
        console.log(`🔍 Tus stats: ${userStats.accuracy}% - ${userStats.totalQuestions} preguntas`)
      }

      // Verificar requisitos para medallas
      if (userRank === 1) {
        if (ranking.length >= 2) {
          console.log(`✅ Cumples requisitos para CAMPEÓN ${periodName}!`)
        } else {
          console.log(`❌ Solo hay ${ranking.length} usuario(s), necesitas al menos 2 para competencia`)
        }
      } else if (userRank >= 2 && userRank <= 3) {
        if (ranking.length >= 3) {
          console.log(`✅ Cumples requisitos para PODIO ${periodName}!`)
        } else {
          console.log(`❌ Solo hay ${ranking.length} usuario(s), necesitas al menos 3 para podio`)
        }
      }
    }

    // Verificar medallas almacenadas
    console.log('\n🔍 === MEDALLAS ALMACENADAS ===')
    const { data: storedMedals, error: medalError } = await supabase
      .from('user_medals')
      .select('*')
      .eq('user_id', userId)

    if (medalError) {
      console.log('❌ Error obteniendo medallas:', medalError)
    } else {
      console.log('🔍 Medallas almacenadas:', storedMedals?.length || 0)
      storedMedals?.forEach(medal => {
        console.log(`🏆 ${medal.medal_id} - Visto: ${medal.viewed} - Fecha: ${medal.unlocked_at}`)
      })
    }

  } catch (error) {
    console.log('❌ Error en debug:', error)
  }

  console.log('🔍 === FIN DEBUG ===')
}

// Función para ejecutar desde la consola del navegador
if (typeof window !== 'undefined') {
  window.debugMedals = async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      
      // Usar las variables de entorno del cliente
      const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co' // Tu URL de supabase
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY1NzE3MDUsImV4cCI6MjA0MjE0NzcwNX0.9TrXKAIdgUXjhLLpJyNzK4E0N2xDQ6f_BsG2cj_n57Q'
      
      const supabase = createClient(supabaseUrl, supabaseKey)
      
      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        console.log('🔍 Usuario encontrado:', user.id, user.email)
        await debugMedalSystem(supabase, user.id)
      } else {
        console.log('❌ No hay usuario logueado')
      }
    } catch (error) {
      console.log('❌ Error en debugMedals:', error)
    }
  }
}