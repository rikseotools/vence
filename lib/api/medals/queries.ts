// lib/api/medals/queries.ts - Queries tipadas para medallas de ranking
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import {
  RANKING_MEDALS,
  type UserMedal,
  type GetMedalsResponse,
  type CheckMedalsResponse,
  type MedalDefinition,
} from './schemas'

// ============================================
// TIPOS INTERNOS
// ============================================

interface RankingUser {
  userId: string
  totalQuestions: number
  correctAnswers: number
  accuracy: number
}

interface PeriodConfig {
  name: string
  startDate: Date
  endDate: Date
}

// ============================================
// LOGICA PURA: CALCULAR PERIODOS A EVALUAR
// ============================================

/**
 * Determina que periodos evaluar para medallas.
 * Las medallas se otorgan AL DIA SIGUIENTE del periodo evaluado:
 * - Diarias: siempre (evalua ayer)
 * - Semanales: solo lunes (evalua semana pasada)
 * - Mensuales: solo dia 1 (evalua mes pasado)
 */
export function getMedalPeriods(now: Date): { today?: PeriodConfig; week?: PeriodConfig; month?: PeriodConfig } {
  const isMonday = now.getUTCDay() === 1
  const isFirstDayOfMonth = now.getUTCDate() === 1

  const periods: { today?: PeriodConfig; week?: PeriodConfig; month?: PeriodConfig } = {}

  // Diarias: siempre evaluar ayer
  const yesterday = new Date(now)
  yesterday.setUTCDate(now.getUTCDate() - 1)
  const yesterdayStart = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0))
  const yesterdayEnd = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59, 999))
  periods.today = { name: 'today', startDate: yesterdayStart, endDate: yesterdayEnd }

  // Semanales: solo lunes (evalua lunes anterior a domingo)
  if (isMonday) {
    const weekStart = new Date(now)
    weekStart.setUTCDate(now.getUTCDate() - 8) // Lunes anterior
    weekStart.setUTCHours(0, 0, 0, 0)

    const weekEnd = new Date(now)
    weekEnd.setUTCDate(now.getUTCDate() - 2) // Domingo
    weekEnd.setUTCHours(23, 59, 59, 999)

    periods.week = { name: 'week', startDate: weekStart, endDate: weekEnd }
  }

  // Mensuales: solo dia 1 (evalua mes pasado)
  if (isFirstDayOfMonth) {
    const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0))
    const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999))
    periods.month = { name: 'month', startDate: lastMonthStart, endDate: lastMonthEnd }
  }

  return periods
}

// ============================================
// LOGICA PURA: ASIGNAR MEDALLAS POR RANKING
// ============================================

/**
 * Funcion pura que determina que medallas merece un usuario
 * dado su ranking en cada periodo.
 */
export function assignMedalsForPeriod(
  periodName: string,
  ranking: RankingUser[],
  userId: string
): UserMedal[] {
  const medals: UserMedal[] = []
  const userRank = ranking.findIndex(u => u.userId === userId) + 1
  if (userRank === 0) return medals

  const userStats = ranking[userRank - 1]
  const now = new Date().toISOString()

  // Primer lugar
  if (userRank === 1 && ranking.length >= 1) {
    const medalKey = `FIRST_PLACE_${periodName.toUpperCase()}`
    const def = RANKING_MEDALS[medalKey]
    if (def) {
      medals.push(buildMedal(def, userRank, ranking.length, periodName, userStats, now))
    }
  }

  // Top 3 (posiciones 2 y 3)
  if (userRank >= 2 && userRank <= 3 && ranking.length >= 2) {
    const medalKey = `TOP_3_${periodName.toUpperCase()}`
    const def = RANKING_MEDALS[medalKey]
    if (def) {
      medals.push(buildMedal(def, userRank, ranking.length, periodName, userStats, now))
    }
  }

  // Medallas de rendimiento y volumen (solo semanales)
  if (periodName === 'week') {
    // Alta precision: >= 90% con >= 20 preguntas
    if (userStats.accuracy >= 90 && userStats.totalQuestions >= 20) {
      medals.push(buildMedal(
        RANKING_MEDALS.HIGH_ACCURACY,
        userRank,
        ranking.length,
        periodName,
        userStats,
        now,
        `${userStats.accuracy}% de aciertos en ${userStats.totalQuestions} preguntas`
      ))
    }

    // Volumen: >= 100 preguntas
    if (userStats.totalQuestions >= 100) {
      medals.push(buildMedal(
        RANKING_MEDALS.VOLUME_LEADER,
        userRank,
        ranking.length,
        periodName,
        userStats,
        now,
        `${userStats.totalQuestions} preguntas respondidas esta semana`
      ))
    }
  }

  return medals
}

function buildMedal(
  def: MedalDefinition,
  rank: number,
  totalUsers: number,
  period: string,
  stats: RankingUser,
  unlockedAt: string,
  customProgress?: string
): UserMedal {
  return {
    ...def,
    unlocked: true,
    progress: customProgress || `Posicion #${rank} de ${totalUsers} usuarios`,
    unlockedAt,
    rank,
    period,
    stats: {
      userId: stats.userId,
      totalQuestions: stats.totalQuestions,
      correctAnswers: stats.correctAnswers,
      accuracy: stats.accuracy,
    },
  }
}

// ============================================
// OBTENER MEDALLAS DEL USUARIO
// ============================================

export async function getUserMedals(userId: string): Promise<GetMedalsResponse> {
  try {
    const db = getDb()
    const now = new Date()
    const periods = getMedalPeriods(now)
    const medals: UserMedal[] = []

    for (const [, period] of Object.entries(periods)) {
      if (!period) continue

      const result = await db.execute(
        sql`SELECT
              t.user_id,
              COUNT(*)::bigint AS total_questions,
              COUNT(*) FILTER (WHERE tq.is_correct)::bigint AS correct_answers,
              ROUND((COUNT(*) FILTER (WHERE tq.is_correct)::numeric / COUNT(*)) * 100, 0) AS accuracy
            FROM test_questions tq
            INNER JOIN tests t ON t.id = tq.test_id
            WHERE tq.created_at >= ${period.startDate.toISOString()}::timestamptz
              AND tq.created_at <= ${period.endDate.toISOString()}::timestamptz
            GROUP BY t.user_id
            HAVING COUNT(*) >= 5
            ORDER BY accuracy DESC, total_questions DESC
            LIMIT 100`
      )

      const ranking: RankingUser[] = ((result as any[]) || []).map((row: any) => ({
        userId: row.user_id,
        totalQuestions: Number(row.total_questions),
        correctAnswers: Number(row.correct_answers),
        accuracy: Number(row.accuracy),
      }))

      const periodMedals = assignMedalsForPeriod(period.name, ranking, userId)
      medals.push(...periodMedals)
    }

    return { success: true, medals }
  } catch (error) {
    console.error('❌ [Medals] Error obteniendo medallas:', error)
    return { success: true, medals: [] }
  }
}

// ============================================
// CHECK Y GUARDAR MEDALLAS NUEVAS
// ============================================

export async function checkAndSaveNewMedals(userId: string): Promise<CheckMedalsResponse> {
  try {
    const db = getDb()

    // Obtener medallas actuales basadas en rendimiento
    const medalsResult = await getUserMedals(userId)
    const currentMedals = medalsResult.medals || []

    // Obtener medallas ya almacenadas
    const storedResult = await db.execute(
      sql`SELECT medal_id FROM user_medals WHERE user_id = ${userId}::uuid`
    )
    const storedMedalIds = new Set(((storedResult as any[]) || []).map((r: any) => r.medal_id))

    // Encontrar medallas nuevas
    const newMedals = currentMedals.filter(medal => !storedMedalIds.has(medal.id))

    if (newMedals.length === 0) {
      return { success: true, newMedals: [] }
    }

    // Guardar medallas nuevas
    for (const medal of newMedals) {
      await db.execute(
        sql`INSERT INTO user_medals (user_id, medal_id, medal_data, unlocked_at, viewed)
            VALUES (${userId}::uuid, ${medal.id}, ${JSON.stringify(medal)}::jsonb, NOW(), false)
            ON CONFLICT (user_id, medal_id) DO NOTHING`
      )
    }

    console.log(`🏆 [Medals] ${newMedals.length} medalla(s) guardada(s) para usuario ${userId.slice(0, 8)}`)

    // Verificar si el usuario esta activo recientemente
    const isActive = await isUserRecentlyActive(db, userId)

    if (!isActive) {
      // Enviar emails para medallas nuevas
      for (const medal of newMedals) {
        await sendMedalEmail(db, userId, medal)
      }
    }

    return { success: true, newMedals }
  } catch (error) {
    console.error('❌ [Medals] Error verificando medallas nuevas:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

async function isUserRecentlyActive(db: ReturnType<typeof getDb>, userId: string): Promise<boolean> {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    const result = await db.execute(
      sql`SELECT 1 FROM test_questions tq
          JOIN tests t ON tq.test_id = t.id
          WHERE t.user_id = ${userId}::uuid
            AND tq.created_at >= ${fiveMinutesAgo.toISOString()}::timestamptz
          LIMIT 1`
    )

    return ((result as any[]) || []).length > 0
  } catch {
    return false
  }
}

async function sendMedalEmail(db: ReturnType<typeof getDb>, userId: string, medal: UserMedal): Promise<void> {
  try {
    // Verificar preferencias de email
    const prefResult = await db.execute(
      sql`SELECT unsubscribed_all FROM email_preferences WHERE user_id = ${userId}::uuid LIMIT 1`
    )
    const pref = ((prefResult as any[]) || [])[0]
    if (pref?.unsubscribed_all === true) return

    // Obtener nombre del usuario
    const profileResult = await db.execute(
      sql`SELECT display_name FROM public_user_profiles WHERE id = ${userId}::uuid LIMIT 1`
    )
    const profile = ((profileResult as any[]) || [])[0]
    const userName = profile?.display_name || 'Estudiante'

    // Llamar a la API de emails (server-side)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    await fetch(`${baseUrl}/api/emails/send-medal-congratulation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        userName,
        medal,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (error) {
    console.error(`❌ [Medals] Error enviando email para medalla ${medal.id}:`, error)
  }
}
