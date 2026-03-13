import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
const BATCH_SIZE = 50

/**
 * Calcula la racha de días consecutivos con día de gracia
 * (réplica de utils/streakCalculator.js)
 */
function calculateStreak(sessions) {
  if (!sessions || sessions.length === 0) return 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Crear set de días con actividad (más eficiente que array)
  const activeDaySet = new Set()
  for (const session of sessions) {
    const d = new Date(session.completed_at || session.created_at)
    d.setHours(0, 0, 0, 0)
    activeDaySet.add(d.getTime())
  }

  // Verificar últimos 60 días
  const activeDays = []
  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(today.getDate() - i)
    checkDate.setHours(0, 0, 0, 0)
    activeDays.push(activeDaySet.has(checkDate.getTime()))
  }

  // Encontrar primer día con actividad desde hoy
  let startIndex = -1
  for (let i = 0; i < activeDays.length; i++) {
    if (activeDays[i]) {
      startIndex = i
      break
    }
  }

  if (startIndex === -1) return 0

  // Contar racha con 1 día de gracia
  let consecutiveMisses = 0
  let daysInStreak = 0

  for (let i = startIndex; i < activeDays.length; i++) {
    if (activeDays[i]) {
      daysInStreak++
      consecutiveMisses = 0
    } else {
      consecutiveMisses++
      daysInStreak++
      if (consecutiveMisses >= 2) {
        daysInStreak--
        break
      }
    }
  }

  return daysInStreak
}

async function _GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (authHeader !== expectedAuth) {
      console.error('❌ Unauthorized request to update-streaks cron')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🔄 Actualizando rachas por batches...')

    // Solo usuarios con actividad en los últimos 62 días (racha máx 60 + 2 días gracia)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 62)

    // Obtener usuarios distintos con actividad reciente
    const { data: activeUsers, error: usersError } = await supabase
      .from('user_test_sessions')
      .select('user_id')
      .gte('completed_at', cutoffDate.toISOString())
      .order('user_id')

    if (usersError) {
      console.error('❌ Error obteniendo usuarios activos:', usersError)
      return NextResponse.json({ success: false, error: usersError.message }, { status: 500 })
    }

    // Deduplicar user_ids
    const uniqueUserIds = [...new Set(activeUsers.map(u => u.user_id))]
    console.log(`📊 ${uniqueUserIds.length} usuarios con actividad reciente`)

    let updated = 0
    let errors = 0

    // Procesar en batches
    for (let i = 0; i < uniqueUserIds.length; i += BATCH_SIZE) {
      const batch = uniqueUserIds.slice(i, i + BATCH_SIZE)

      // Obtener sesiones de los últimos 62 días para este batch
      const { data: sessions, error: sessionsError } = await supabase
        .from('user_test_sessions')
        .select('user_id, completed_at, created_at')
        .in('user_id', batch)
        .gte('completed_at', cutoffDate.toISOString())
        .order('completed_at', { ascending: false })

      if (sessionsError) {
        console.error(`❌ Error batch ${i / BATCH_SIZE + 1}:`, sessionsError.message)
        errors++
        continue
      }

      // Agrupar sesiones por usuario
      const sessionsByUser = {}
      for (const session of sessions) {
        if (!sessionsByUser[session.user_id]) {
          sessionsByUser[session.user_id] = []
        }
        sessionsByUser[session.user_id].push(session)
      }

      // Calcular y actualizar racha para cada usuario del batch
      for (const userId of batch) {
        const userSessions = sessionsByUser[userId] || []
        const currentStreak = calculateStreak(userSessions)
        const lastActivity = userSessions[0]?.completed_at || userSessions[0]?.created_at || null

        try {
          const { error: upsertError } = await supabase
            .from('user_streaks')
            .upsert({
              user_id: userId,
              current_streak: currentStreak,
              last_activity_date: lastActivity ? lastActivity.split('T')[0] : null,
              streak_updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id',
              ignoreDuplicates: false
            })

          if (upsertError) {
            console.error(`⚠️ Error streak user ${userId}:`, upsertError.message)
            errors++
          } else {
            updated++
          }
        } catch (err) {
          console.error(`⚠️ Error inesperado user ${userId}:`, err.message)
          errors++
        }
      }
    }

    // Resetear rachas de usuarios sin actividad reciente que aún tengan racha > 0
    // Obtener usuarios con racha > 0 y filtrar en cliente para evitar NOT IN con 800+ UUIDs
    const activeUserSet = new Set(uniqueUserIds)
    const { data: streakUsers, error: streakFetchError } = await supabase
      .from('user_streaks')
      .select('user_id')
      .gt('current_streak', 0)

    let resetError = streakFetchError
    if (!streakFetchError && streakUsers) {
      const usersToReset = streakUsers
        .map(s => s.user_id)
        .filter(uid => !activeUserSet.has(uid))

      if (usersToReset.length > 0) {
        // Resetear en batches de 100
        for (let i = 0; i < usersToReset.length; i += 100) {
          const resetBatch = usersToReset.slice(i, i + 100)
          const { error: batchResetError } = await supabase
            .from('user_streaks')
            .update({
              current_streak: 0,
              streak_updated_at: new Date().toISOString()
            })
            .in('user_id', resetBatch)

          if (batchResetError) {
            resetError = batchResetError
            break
          }
        }
      }
    }

    if (resetError) {
      console.error('⚠️ Error reseteando rachas inactivas:', resetError.message)
    }

    console.log(`✅ Rachas actualizadas: ${updated} OK, ${errors} errores`)
    return NextResponse.json({
      success: true,
      message: `Rachas actualizadas: ${updated} usuarios, ${errors} errores`,
      usersProcessed: updated,
      errors,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error inesperado:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/cron/update-streaks', _GET)
