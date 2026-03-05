// lib/api/ranking/queries.ts - Queries tipadas para ranking
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import type {
  TimeFilter,
  GetRankingRequest,
  GetRankingResponse,
  RankingEntry,
  UserPosition,
} from './schemas'

// Cache en memoria (60 segundos por timeFilter)
const rankingCache = new Map<string, { data: GetRankingResponse; timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 60 segundos

// ============================================
// CALCULAR RANGO DE FECHAS
// ============================================

export interface DateRange {
  startDate: string
  endDate: string | null
}

/**
 * Calcula startDate/endDate UTC para el timeFilter dado.
 * Replica la logica de RankingModal.js lineas 75-114.
 */
export function computeDateRange(timeFilter: TimeFilter): DateRange {
  const now = new Date()

  if (timeFilter === 'yesterday') {
    const yesterday = new Date(now)
    yesterday.setUTCDate(now.getUTCDate() - 1)
    yesterday.setUTCHours(0, 0, 0, 0)

    const yesterdayEnd = new Date(yesterday)
    yesterdayEnd.setUTCHours(23, 59, 59, 999)

    return {
      startDate: yesterday.toISOString(),
      endDate: yesterdayEnd.toISOString(),
    }
  }

  if (timeFilter === 'today') {
    const today = new Date(now)
    today.setUTCHours(0, 0, 0, 0)

    const todayEnd = new Date(today)
    todayEnd.setUTCHours(23, 59, 59, 999)

    return {
      startDate: today.toISOString(),
      endDate: todayEnd.toISOString(),
    }
  }

  if (timeFilter === 'week') {
    const dayOfWeek = now.getUTCDay() // 0=dom, 1=lun...
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const thisMonday = new Date(now)
    thisMonday.setUTCDate(now.getUTCDate() - daysFromMonday)
    thisMonday.setUTCHours(0, 0, 0, 0)

    return {
      startDate: thisMonday.toISOString(),
      endDate: null,
    }
  }

  // month
  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
  return {
    startDate: firstDay.toISOString(),
    endDate: null,
  }
}

// ============================================
// OBTENER RANKING
// ============================================

export async function getRanking(params: GetRankingRequest): Promise<GetRankingResponse> {
  try {
    // Verificar cache
    const cacheKey = `${params.timeFilter}_${params.minQuestions}_${params.limit}`
    const cached = rankingCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }

    const db = getDb()
    const { startDate, endDate } = computeDateRange(params.timeFilter)

    const result = await db.execute(
      sql`SELECT * FROM get_ranking_for_period(
        ${startDate}::timestamptz,
        ${endDate}::timestamptz,
        ${params.minQuestions ?? 5},
        ${params.limit ?? 100}
      )`
    )

    const rows = result as any[]
    const ranking: RankingEntry[] = (rows || []).map((row: any, index: number) => ({
      userId: row.user_id,
      totalQuestions: Number(row.total_questions),
      correctAnswers: Number(row.correct_answers),
      accuracy: Number(row.accuracy),
      rank: index + 1,
    }))

    // Si se pide posicion del usuario, buscarla
    let userPosition: UserPosition | null = null
    if (params.userId) {
      userPosition = await getUserPosition(params.userId, params.timeFilter, params.minQuestions)
    }

    const response: GetRankingResponse = {
      success: true,
      ranking,
      userPosition,
      generatedAt: new Date().toISOString(),
    }

    // Guardar en cache
    rankingCache.set(cacheKey, { data: response, timestamp: Date.now() })

    return response
  } catch (error) {
    console.error('❌ [Ranking] Error obteniendo ranking:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// OBTENER POSICION DEL USUARIO
// ============================================

export async function getUserPosition(
  userId: string,
  timeFilter: TimeFilter,
  minQuestions = 5
): Promise<UserPosition | null> {
  try {
    const db = getDb()
    const { startDate, endDate } = computeDateRange(timeFilter)

    const result = await db.execute(
      sql`SELECT * FROM get_user_ranking_position(
        ${userId}::uuid,
        ${startDate}::timestamptz,
        ${endDate}::timestamptz,
        ${minQuestions}
      )`
    )

    const rows = result as any[]
    if (!rows || rows.length === 0) return null

    const row = rows[0]
    if (!row.user_rank) return null

    return {
      rank: Number(row.user_rank),
      totalQuestions: Number(row.total_questions),
      correctAnswers: Number(row.correct_answers),
      accuracy: Number(row.accuracy),
      totalUsers: Number(row.total_users_in_ranking),
    }
  } catch (error) {
    console.error('❌ [Ranking] Error obteniendo posicion del usuario:', error)
    return null
  }
}

// ============================================
// INVALIDAR CACHE
// ============================================

export function invalidateRankingCache(): void {
  rankingCache.clear()
}
