// lib/services/rankingMedals.js
// Sistema de medallas de ranking para mostrar en estadísticas y enviar emails

export const RANKING_MEDALS = {
  FIRST_PLACE_TODAY: {
    id: 'first_place_today',
    title: '🥇 Líder del Día',
    description: 'Primer lugar en el ranking diario',
    category: 'Ranking Diario',
    emailTemplate: 'daily_champion'
  },
  FIRST_PLACE_WEEK: {
    id: 'first_place_week',
    title: '🥇 Líder Semanal',
    description: 'Primer lugar en el ranking semanal',
    category: 'Ranking Semanal',
    emailTemplate: 'weekly_champion'
  },
  FIRST_PLACE_MONTH: {
    id: 'first_place_month',
    title: '🥇 Líder Mensual',
    description: 'Primer lugar en el ranking mensual',
    category: 'Ranking Mensual',
    emailTemplate: 'monthly_champion'
  },
  TOP_3_TODAY: {
    id: 'top_3_today',
    title: '🏅 Podio Diario',
    description: 'Top 3 en el ranking del día',
    category: 'Ranking Diario',
    emailTemplate: 'daily_podium'
  },
  TOP_3_WEEK: {
    id: 'top_3_week',
    title: '🏅 Podio Semanal',
    description: 'Top 3 en el ranking semanal',
    category: 'Ranking Semanal',
    emailTemplate: 'weekly_podium'
  },
  TOP_3_MONTH: {
    id: 'top_3_month',
    title: '🏅 Podio Mensual',
    description: 'Top 3 en el ranking mensual',
    category: 'Ranking Mensual',
    emailTemplate: 'monthly_podium'
  },
  HIGH_ACCURACY: {
    id: 'high_accuracy',
    title: '🎯 Precisión Extrema',
    description: 'Más del 90% de aciertos en el ranking semanal',
    category: 'Rendimiento',
    emailTemplate: 'high_accuracy'
  },
  VOLUME_LEADER: {
    id: 'volume_leader',
    title: '📚 Máquina de Preguntas',
    description: 'Más de 100 preguntas en una semana',
    category: 'Volumen',
    emailTemplate: 'volume_leader'
  }
}

// Función para obtener las medallas del usuario
export async function getUserRankingMedals(supabase, userId) {
  console.log('🏆 getUserRankingMedals llamada para usuario:', userId)
  
  if (!supabase || !userId) {
    console.log('🏆 No hay supabase o userId en getUserRankingMedals')
    return []
  }

  const medals = []
  const now = new Date()
  
  console.log('🏆 Fecha actual:', now.toISOString())

  try {
    // 🏆 NUEVA LÓGICA: Medallas se otorgan AL DÍA SIGUIENTE del período evaluado
    // - Hoy (miércoles): Medallas de ayer (martes)
    // - Lunes: Medallas de la semana pasada  
    // - Primer día del mes: Medallas del mes pasado
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const isMonday = now.getDay() === 1
    const isFirstDayOfMonth = now.getDate() === 1
    
    const periods = {}
    
    // Medallas diarias: siempre evaluar el día anterior
    periods.today = {
      start: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
      end: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59)
    }
    
    // Medallas semanales: solo los lunes
    if (isMonday) {
      const weekStart = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000) // Hace 8 días (lunes anterior)
      const weekEnd = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)   // Hace 2 días (domingo)
      periods.week = {
        start: weekStart,
        end: weekEnd
      }
    }
    
    // Medallas mensuales: solo el primer día del mes
    if (isFirstDayOfMonth) {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
      periods.month = {
        start: lastMonth,
        end: lastMonthEnd
      }
    }

    console.log('🏆 Evaluando períodos:', Object.keys(periods))
    console.log('🗓️ Fechas:', {
      esLunes: isMonday,
      esPrimerDelMes: isFirstDayOfMonth,
      ayer: yesterday.toISOString().split('T')[0]
    })

    // Verificar medallas para cada período
    for (const [periodName, period] of Object.entries(periods)) {
      console.log(`🏆 Evaluando período: ${periodName} (${period.start.toISOString().split('T')[0]} a ${period.end.toISOString().split('T')[0]})`)
      
      const ranking = await getRankingForPeriod(supabase, period.start, period.end)
      const userRank = ranking.findIndex(user => user.userId === userId) + 1
      
      console.log(`🏆 Ranking ${periodName}: ${ranking.length} usuarios, posición del usuario: ${userRank || 'no encontrado'}`)

      if (userRank === 1 && ranking.length >= 1) {
        // Primer lugar
        const medalKey = `FIRST_PLACE_${periodName.toUpperCase()}`
        if (RANKING_MEDALS[medalKey]) {
          medals.push({
            ...RANKING_MEDALS[medalKey],
            unlocked: true,
            progress: `Posición #${userRank} de ${ranking.length} usuarios`,
            unlockedAt: new Date(),
            rank: userRank,
            period: periodName,
            stats: ranking.find(user => user.userId === userId)
          })
        }
      } else if (userRank >= 2 && userRank <= 3 && ranking.length >= 2) {
        // Top 3 (podio) - ahora necesita mínimo 2 usuarios
        const medalKey = `TOP_3_${periodName.toUpperCase()}`
        if (RANKING_MEDALS[medalKey]) {
          medals.push({
            ...RANKING_MEDALS[medalKey],
            unlocked: true,
            progress: `Posición #${userRank} de ${ranking.length} usuarios`,
            unlockedAt: new Date(),
            rank: userRank,
            period: periodName,
            stats: ranking.find(user => user.userId === userId)
          })
        }
      }

      // Medalla de alta precisión (semanal)
      if (periodName === 'week') {
        const userStats = ranking.find(user => user.userId === userId)
        if (userStats && userStats.accuracy >= 90 && userStats.totalQuestions >= 20) {
          medals.push({
            ...RANKING_MEDALS.HIGH_ACCURACY,
            unlocked: true,
            progress: `${userStats.accuracy}% de aciertos en ${userStats.totalQuestions} preguntas`,
            unlockedAt: new Date(),
            rank: userRank,
            period: periodName,
            stats: userStats
          })
        }

        // Medalla de volumen (semanal)
        if (userStats && userStats.totalQuestions >= 100) {
          medals.push({
            ...RANKING_MEDALS.VOLUME_LEADER,
            unlocked: true,
            progress: `${userStats.totalQuestions} preguntas respondidas esta semana`,
            unlockedAt: new Date(),
            rank: userRank,
            period: periodName,
            stats: userStats
          })
        }
      }
    }

    return medals

  } catch (error) {
    console.error('Error calculating ranking medals:', error)
    return []
  }
}

// Función auxiliar para obtener ranking de un período
async function getRankingForPeriod(supabase, startDate, endDate) {
  try {
    const { data: responses, error } = await supabase
      .from('test_questions')
      .select(`
        tests!inner(user_id),
        is_correct,
        created_at
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (error) throw error

    // Procesar datos por usuario
    const userStats = {}
    
    responses?.forEach(response => {
      const userId = response.tests.user_id
      if (!userStats[userId]) {
        userStats[userId] = {
          userId,
          totalQuestions: 0,
          correctAnswers: 0,
          accuracy: 0
        }
      }
      
      userStats[userId].totalQuestions++
      if (response.is_correct) {
        userStats[userId].correctAnswers++
      }
    })

    // Calcular accuracy y ordenar
    return Object.values(userStats)
      .filter(user => user.totalQuestions >= 5)
      .map(user => ({
        ...user,
        accuracy: Math.round((user.correctAnswers / user.totalQuestions) * 100)
      }))
      .sort((a, b) => {
        if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy
        return b.totalQuestions - a.totalQuestions
      })

  } catch (error) {
    console.error('Error getting ranking for period:', error)
    return []
  }
}

// Función para verificar si el usuario está activo recientemente (últimos 5 minutos)
async function isUserRecentlyActive(supabase, userId) {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    
    // Verificar actividad en test_questions (respuestas recientes)
    const { data: recentAnswers, error: answersError } = await supabase
      .from('test_questions')
      .select('created_at, tests!inner(user_id)')
      .eq('tests.user_id', userId)
      .gte('created_at', fiveMinutesAgo.toISOString())
      .limit(1)

    if (answersError) {
      console.warn('Error checking recent test activity:', answersError)
    }

    // Si tiene respuestas en los últimos 5 minutos, está activo
    if (recentAnswers && recentAnswers.length > 0) {
      console.log('🟢 Usuario activo: respuestas recientes detectadas')
      return true
    }

    // Verificar actividad en tests completados recientemente
    const { data: recentTests, error: testsError } = await supabase
      .from('tests')
      .select('completed_at')
      .eq('user_id', userId)
      .gte('completed_at', fiveMinutesAgo.toISOString())
      .limit(1)

    if (testsError) {
      console.warn('Error checking recent test completion:', testsError)
    }

    if (recentTests && recentTests.length > 0) {
      console.log('🟢 Usuario activo: tests completados recientemente')
      return true
    }

    console.log('🔴 Usuario no activo recientemente')
    return false

  } catch (error) {
    console.warn('Error checking user activity:', error)
    // En caso de error, asumir que no está activo para enviar email
    return false
  }
}

// Función para verificar medallas nuevas y enviar emails (con detección de actividad)
export async function checkAndNotifyNewMedals(supabase, userId) {
  if (!supabase || !userId) return []

  try {
    // Obtener medallas actuales del usuario basadas en su rendimiento
    const currentMedals = await getUserRankingMedals(supabase, userId)
    
    // Obtener medallas que ya tenía almacenadas
    const { data: storedMedals, error: storedError } = await supabase
      .from('user_medals')
      .select('medal_id, unlocked_at')
      .eq('user_id', userId)

    if (storedError) {
      console.warn('No se pudieron cargar medallas almacenadas (tabla puede no existir):', storedError)
    }

    const storedMedalIds = new Set(storedMedals?.map(m => m.medal_id) || [])
    
    // Encontrar medallas nuevas
    const newMedals = currentMedals.filter(medal => 
      !storedMedalIds.has(medal.id)
    )

    console.log(`🏆 Medallas actuales: ${currentMedals.length}, almacenadas: ${storedMedalIds.size}, nuevas: ${newMedals.length}`)

    // Guardar medallas nuevas en la base de datos (si la tabla existe)
    if (newMedals.length > 0) {
      try {
        const medalRecords = newMedals.map(medal => ({
          user_id: userId,
          medal_id: medal.id,
          medal_data: medal,
          unlocked_at: medal.unlockedAt ? new Date(medal.unlockedAt).toISOString() : new Date().toISOString(),
          viewed: false // Nueva medalla no vista para mostrar badge
        }))

        console.log('🔍 Intentando insertar medallas:', medalRecords)

        const { error: insertError } = await supabase
          .from('user_medals')
          .upsert(medalRecords, { onConflict: 'user_id,medal_id' })

        if (insertError) {
          console.error('❌ Error guardando medallas en user_medals:', insertError)
          console.error('📋 Datos que causaron el error:', JSON.stringify(medalRecords, null, 2))
        } else {
          console.log(`✅ ${newMedals.length} medalla(s) guardada(s) en user_medals`)
        }

        // 🎯 VERIFICAR ACTIVIDAD ANTES DE ENVIAR EMAILS
        const isActive = await isUserRecentlyActive(supabase, userId)
        
        if (isActive) {
          console.log('📱 Usuario activo detectado - NO se enviarán emails de medallas (verá notificación in-app)')
        } else {
          console.log('📧 Usuario no activo - enviando emails de medallas')
          
          // Enviar emails para medallas nuevas solo si no está activo
          for (const medal of newMedals) {
            try {
              await sendMedalEmail(supabase, userId, medal)
            } catch (emailError) {
              console.error(`Error enviando email para medalla ${medal.id}:`, emailError)
            }
          }
        }
      } catch (dbError) {
        console.warn('Error en operaciones de base de datos para medallas:', dbError)
        // Continuar sin fallar completamente
      }
    }

    return newMedals

  } catch (error) {
    console.error('Error checking new medals:', error)
    return []
  }
}

// Función para enviar email de felicitación por medalla
async function sendMedalEmail(supabase, userId, medal) {
  try {
    // Verificar preferencias de email del usuario
    const { data: emailPreferences } = await supabase
      .from('email_preferences')
      .select('unsubscribed_all')
      .eq('user_id', userId)
      .single()

    if (emailPreferences?.unsubscribed_all === true) {
      console.log(`📧 Usuario ${userId} tiene emails desactivados - no se enviará email de medalla`)
      return
    }

    // Obtener datos del usuario
    const { data: profile } = await supabase
      .from('public_user_profiles')
      .select('display_name')
      .eq('id', userId)
      .single()

    const userName = profile?.display_name || 'Estudiante'

    // Llamar a la API de emails
    await fetch('/api/emails/send-medal-congratulation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        userName,
        medal,
        timestamp: new Date().toISOString()
      })
    })

    console.log(`📧 Medal email sent for ${medal.title} to user ${userId}`)

  } catch (error) {
    console.error('Error sending medal email:', error)
  }
}