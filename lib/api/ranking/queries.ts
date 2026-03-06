// lib/api/ranking/queries.ts - Queries tipadas para ranking
import { getDb } from '@/db/client'
import { sql, inArray } from 'drizzle-orm'
import { publicUserProfiles, userProfiles, userAvatarSettings, userStreaks } from '@/db/schema'
import type {
  TimeFilter,
  StreakTimeFilter,
  StreakCategory,
  GetRankingRequest,
  GetRankingResponse,
  RankingEntry,
  UserPosition,
  Avatar,
  GetStreakRankingRequest,
  GetStreakRankingResponse,
  StreakEntry,
} from './schemas'

// Cache en memoria (60 segundos por timeFilter — solo page 0)
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
// RESOLVER PERFILES DE USUARIOS (SERVER-SIDE)
// ============================================

export interface ResolvedProfile {
  name: string
  ciudad: string | null
  avatar: Avatar
  isNovato: boolean
}

/**
 * Resuelve nombre, ciudad, avatar e isNovato para una lista de userIds.
 * Reemplaza las 3 queries + funciones duplicadas de RankingModal.js.
 *
 * Prioridad para nombre:
 * 1. publicUserProfiles.displayName (si != "Usuario")
 * 2. userProfiles.fullName (primer nombre, si != "Usuario")
 * 3. userProfiles.email (antes del @, limpio)
 * 4. "Anonimo"
 */
export async function resolveUserProfiles(
  db: ReturnType<typeof getDb>,
  userIds: string[]
): Promise<Map<string, ResolvedProfile>> {
  const result = new Map<string, ResolvedProfile>()

  if (userIds.length === 0) return result

  // 3 queries paralelas
  const [pubProfiles, upProfiles, avatarRows] = await Promise.all([
    db
      .select({
        id: publicUserProfiles.id,
        displayName: publicUserProfiles.displayName,
        ciudad: publicUserProfiles.ciudad,
        avatarType: publicUserProfiles.avatarType,
        avatarEmoji: publicUserProfiles.avatarEmoji,
        avatarColor: publicUserProfiles.avatarColor,
        avatarUrl: publicUserProfiles.avatarUrl,
        createdAt: publicUserProfiles.createdAt,
      })
      .from(publicUserProfiles)
      .where(inArray(publicUserProfiles.id, userIds)),
    db
      .select({
        id: userProfiles.id,
        fullName: userProfiles.fullName,
        email: userProfiles.email,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.id, userIds)),
    db
      .select({
        userId: userAvatarSettings.userId,
        currentEmoji: userAvatarSettings.currentEmoji,
        currentProfile: userAvatarSettings.currentProfile,
      })
      .from(userAvatarSettings)
      .where(inArray(userAvatarSettings.userId, userIds)),
  ])

  // Indexar para lookup rapido
  const pubMap = new Map(pubProfiles.map(p => [p.id, p]))
  const upMap = new Map(upProfiles.map(p => [p.id, p]))
  const avatarMap = new Map(avatarRows.map(a => [a.userId!, a]))

  const now = new Date()

  for (const uid of userIds) {
    const pub = pubMap.get(uid)
    const up = upMap.get(uid)
    const ava = avatarMap.get(uid)

    // --- Nombre ---
    let name = 'Anonimo'

    // 1. displayName from public_user_profiles (ignore "Usuario")
    if (pub?.displayName && pub.displayName !== 'Usuario') {
      name = pub.displayName
    }
    // 2. fullName from user_profiles (first word, ignore "Usuario")
    else if (up?.fullName && up.fullName !== 'Usuario') {
      const firstName = up.fullName.split(' ')[0]
      if (firstName?.trim() && firstName !== 'Usuario') {
        name = firstName.trim()
      }
    }
    // 3. email from user_profiles (before @, cleaned)
    if (name === 'Anonimo' && up?.email) {
      const emailName = up.email.split('@')[0]
      const cleanName = emailName.replace(/[0-9]+/g, '').replace(/[._-]/g, ' ').trim()
      if (cleanName) {
        name = cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
      } else {
        name = emailName
      }
    }

    // --- Ciudad ---
    const ciudad = pub?.ciudad || null

    // --- Avatar ---
    let avatar: Avatar = null

    // 1. Automatic avatar (from user_avatar_settings)
    if (ava?.currentEmoji) {
      avatar = {
        type: 'automatic',
        emoji: ava.currentEmoji,
        profile: ava.currentProfile || undefined,
      }
    }
    // 2. Public profile avatar
    else if (pub) {
      if (pub.avatarType === 'predefined' && pub.avatarEmoji) {
        avatar = {
          type: 'predefined',
          emoji: pub.avatarEmoji,
          color: pub.avatarColor || undefined,
        }
      } else if (pub.avatarType === 'uploaded' && pub.avatarUrl) {
        avatar = {
          type: 'uploaded',
          url: pub.avatarUrl,
        }
      }
    }

    // --- isNovato ---
    let isNovato = false
    if (pub?.createdAt) {
      const daysSince = Math.floor((now.getTime() - new Date(pub.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      isNovato = daysSince < 30
    }

    result.set(uid, { name, ciudad, avatar, isNovato })
  }

  return result
}

// ============================================
// OBTENER RANKING
// ============================================

export async function getRanking(params: GetRankingRequest): Promise<GetRankingResponse> {
  try {
    const offset = params.offset ?? 0
    const limit = params.limit ?? 50

    // Verificar cache (solo para page 0)
    const cacheKey = `${params.timeFilter}_${params.minQuestions}_${limit}`
    if (offset === 0) {
      const cached = rankingCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data
      }
    }

    const db = getDb()
    const { startDate, endDate } = computeDateRange(params.timeFilter)

    const result = await db.execute(
      sql`SELECT * FROM get_ranking_for_period(
        ${startDate}::timestamptz,
        ${endDate}::timestamptz,
        ${params.minQuestions ?? 5},
        ${limit},
        ${offset}
      )`
    )

    const rows = result as any[]

    // Resolver perfiles server-side
    const userIds = (rows || []).map((row: any) => row.user_id as string)
    const profiles = await resolveUserProfiles(db, userIds)

    const ranking: RankingEntry[] = (rows || []).map((row: any, index: number) => {
      const profile = profiles.get(row.user_id)
      return {
        userId: row.user_id,
        totalQuestions: Number(row.total_questions),
        correctAnswers: Number(row.correct_answers),
        accuracy: Number(row.accuracy),
        rank: offset + index + 1,
        name: profile?.name ?? 'Anonimo',
        ciudad: profile?.ciudad ?? null,
        avatar: profile?.avatar ?? null,
      }
    })

    const hasMore = rows.length === limit

    // Si se pide posicion del usuario, buscarla
    let userPosition: UserPosition | null = null
    if (params.userId) {
      userPosition = await getUserPosition(params.userId, params.timeFilter, params.minQuestions)
    }

    const response: GetRankingResponse = {
      success: true,
      ranking,
      userPosition,
      hasMore,
      generatedAt: new Date().toISOString(),
    }

    // Guardar en cache solo page 0
    if (offset === 0) {
      rankingCache.set(cacheKey, { data: response, timestamp: Date.now() })
    }

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
// OBTENER RANKING DE RACHAS (STREAKS)
// ============================================

export async function getStreakRanking(params: GetStreakRankingRequest): Promise<GetStreakRankingResponse> {
  try {
    const db = getDb()
    const limit = params.limit ?? 50
    const offset = params.offset ?? 0
    const now = new Date()

    // Calcular filtro de fecha y maxDays segun timeFilter
    let minDate: string
    let maxDays: number | null = null

    if (params.timeFilter === 'week') {
      const dayOfWeek = now.getUTCDay()
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const thisMonday = new Date(now)
      thisMonday.setUTCDate(now.getUTCDate() - daysFromMonday)
      thisMonday.setUTCHours(0, 0, 0, 0)
      minDate = thisMonday.toISOString().split('T')[0]
      maxDays = daysFromMonday + 1
    } else if (params.timeFilter === 'month') {
      const firstDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      minDate = firstDayOfMonth.toISOString().split('T')[0]
      maxDays = now.getUTCDate()
    } else {
      // 'all' - solo usuarios con actividad en los ultimos 2 dias (racha activa)
      const twoDaysAgo = new Date(now)
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
      minDate = twoDaysAgo.toISOString().split('T')[0]
    }

    // Query: user_streaks filtrado
    const rows = await db
      .select({
        userId: userStreaks.userId,
        currentStreak: userStreaks.currentStreak,
      })
      .from(userStreaks)
      .where(sql`${userStreaks.lastActivityDate} >= ${minDate} AND ${userStreaks.currentStreak} >= 2`)

    // Cap streak por maxDays del periodo
    let streakData = rows.map(r => ({
      userId: r.userId,
      streak: maxDays ? Math.min(r.currentStreak ?? 0, maxDays) : (r.currentStreak ?? 0),
    }))

    // Ordenar por streak desc
    streakData.sort((a, b) => b.streak - a.streak)

    // Resolver perfiles para filtrar por categoria
    const allUserIds = streakData.map(s => s.userId)
    const profiles = await resolveUserProfiles(db, allUserIds)

    // Filtrar por categoria
    if (params.category === 'principiantes') {
      streakData = streakData.filter(s => profiles.get(s.userId)?.isNovato === true)
    } else if (params.category === 'veteranos') {
      streakData = streakData.filter(s => profiles.get(s.userId)?.isNovato === false)
    }

    // Paginar con slice
    const page = streakData.slice(offset, offset + limit)
    const hasMore = offset + limit < streakData.length

    const streaks: StreakEntry[] = page.map((s, index) => {
      const profile = profiles.get(s.userId)
      return {
        userId: s.userId,
        streak: s.streak,
        rank: offset + index + 1,
        name: profile?.name ?? 'Anonimo',
        ciudad: profile?.ciudad ?? null,
        avatar: profile?.avatar ?? null,
        isNovato: profile?.isNovato ?? false,
      }
    })

    return {
      success: true,
      streaks,
      hasMore,
    }
  } catch (error) {
    console.error('❌ [Ranking] Error obteniendo streak ranking:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// INVALIDAR CACHE
// ============================================

export function invalidateRankingCache(): void {
  rankingCache.clear()
}
