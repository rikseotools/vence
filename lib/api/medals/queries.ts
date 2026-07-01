// lib/api/medals/queries.ts - Queries tipadas para medallas de ranking
// CANARY self-hosted pooler (Fase 3, 2026-05-10):
// El READ path de /api/medals (getRankingForPeriodInternal) participa en el
// canary del pooler propio porque dio 503 hoy 17:31:23 contra Supavisor.
// El WRITE path (checkAndSaveNewMedals con sus INSERTs) sigue contra primary
// hasta que el canary lleve >24h estable y migremos writes en una fase posterior.
import { getDb, getPoolerDb } from '@/db/client'

/**
 * Selector canary para reads del módulo medals: pooler propio si flag ON,
 * primary si OFF (comportamiento histórico — este módulo nunca usó replica).
 * Cuando el canary se considere estable se migra al pooler también el path
 * de writes y eventualmente getDb() se mantiene sólo para emergencias.
 */
function getMedalsReadDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { getOrSet } from '@/lib/cache/redis'
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

// Runtime ranking aggregation must never run from ordinary GET/page loads.
// POST can still award newly earned medals, but can be disabled instantly with
// MEDALS_RUNTIME_RECALC_ENABLED=false if the database is under pressure.
const RUNTIME_MEDAL_RECALC_ENABLED = process.env.MEDALS_RUNTIME_RECALC_ENABLED !== 'false'

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
// QUERY DEL RANKING POR PERÍODO (cacheado + circuit breaker)
// ============================================
// La query depende SOLO del período. getMedalPeriods() siempre evalúa períodos
// CERRADOS (ayer, semana pasada, mes pasado) — esos rankings NUNCA cambian
// retroactivamente, así que el cache es permanente (revalidate: false). Una
// vez populado, sirve para siempre hasta revalidateTag('medals').
//
// IMPORTANTE: la query es estructuralmente cara (GROUP BY user_id sobre
// 192k filas para período "month"). En BD saturada agota statement_timeout
// 30s. Por eso encima del cache hay un circuit breaker: si la query falla
// con statement_timeout, abrimos el circuit 5 min y devolvemos [] sin
// tocar BD — evita que cada hit a /api/medals queme el pool 30s.
//
// Cuando el cache se popula (1 vez por período), el circuit breaker queda
// inerte porque las siguientes lecturas son cache hits.
//
// Invalidar manualmente: revalidateTag('medals') o
//   curl POST /api/admin/revalidate -d '{"tag":"medals"}'.

async function getRankingForPeriodInternal(
  startISO: string,
  endISO: string
): Promise<RankingUser[]> {
  const db = getMedalsReadDb()  // canary: pooler si flag ON, primary si OFF
  const result = await db.execute(
    sql`SELECT
          tq.user_id,
          COUNT(*)::bigint AS total_questions,
          COUNT(*) FILTER (WHERE tq.is_correct)::bigint AS correct_answers,
          ROUND((COUNT(*) FILTER (WHERE tq.is_correct)::numeric / COUNT(*)) * 100, 0) AS accuracy
        FROM test_questions tq
        WHERE tq.user_id IS NOT NULL
          AND tq.created_at >= ${startISO}::timestamptz
          AND tq.created_at <= ${endISO}::timestamptz
          -- Excluir cuentas canary/smoke (100% sintético) para que no ganen
          -- medallas ni desplacen a usuarios reales del 1er puesto.
          AND tq.user_id NOT IN (SELECT id FROM user_profiles WHERE registration_source = 'internal_canary')
        GROUP BY tq.user_id
        HAVING COUNT(*) >= 5
        ORDER BY accuracy DESC, total_questions DESC
        LIMIT 100`
  )

  return ((result as any[]) || []).map((row: any) => ({
    userId: row.user_id,
    totalQuestions: Number(row.total_questions),
    correctAnswers: Number(row.correct_answers),
    accuracy: Number(row.accuracy),
  }))
}

const getRankingForPeriodCached = unstable_cache(
  getRankingForPeriodInternal,
  ['medals-ranking-period-v2'],
  { revalidate: false, tags: ['medals'] }
)

// Circuit breaker: si la query agota statement_timeout (BD saturada),
// abrimos el circuit 5 min — los siguientes hits devuelven [] sin tocar BD.
// Estado en memoria del proceso → cada lambda Vercel tiene el suyo, pero
// con TTL corto se autorrecupera.
let circuitOpenUntil = 0
const CIRCUIT_BREAKER_DURATION_MS = 5 * 60 * 1000
const RANKING_REDIS_TTL_S = 30 * 24 * 60 * 60

function isStatementTimeoutError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { code?: string; message?: string }
  return e.code === '57014' || /statement timeout/i.test(e.message ?? '')
}

async function getRankingForPeriod(
  startISO: string,
  endISO: string
): Promise<RankingUser[]> {
  if (Date.now() < circuitOpenUntil) {
    console.warn('🚧 [Medals] Circuit breaker abierto — devolviendo [] sin tocar BD')
    return []
  }
  try {
    const cacheKey = `medals_ranking:${startISO}:${endISO}:v2`
    return await getOrSet(cacheKey, RANKING_REDIS_TTL_S, () =>
      getRankingForPeriodCached(startISO, endISO)
    )
  } catch (error) {
    if (isStatementTimeoutError(error)) {
      circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_DURATION_MS
      console.warn(
        `🚧 [Medals] Statement timeout en período ${startISO}..${endISO}. ` +
        `Circuit breaker abierto durante 5 min.`
      )
    } else {
      console.error('❌ [Medals] Error en getRankingForPeriod:', error)
    }
    return [] // degradado: medallas vacías mejor que cascada de 504s
  }
}

// ============================================
// OBTENER MEDALLAS DEL USUARIO
// ============================================

export async function getUserMedals(userId: string): Promise<GetMedalsResponse> {
  const storedMedals = await getStoredUserMedals(userId)
  return { success: true, medals: storedMedals }
}

async function calculateCurrentUserMedals(userId: string, storedMedals: UserMedal[]): Promise<UserMedal[]> {
  try {
    const now = new Date()
    const periods = getMedalPeriods(now)
    const medals: UserMedal[] = [...storedMedals]
    const existingIds = new Set(storedMedals.map((medal) => medal.id))

    for (const [, period] of Object.entries(periods)) {
      if (!period) continue

      const ranking = await getRankingForPeriod(
        period.startDate.toISOString(),
        period.endDate.toISOString()
      )

      const periodMedals = assignMedalsForPeriod(period.name, ranking, userId)
      for (const medal of periodMedals) {
        if (existingIds.has(medal.id)) continue
        existingIds.add(medal.id)
        medals.push(medal)
      }
    }

    return medals
  } catch (error) {
    console.error('❌ [Medals] Error obteniendo medallas:', error)
    return storedMedals
  }
}

// ============================================
// CHECK Y GUARDAR MEDALLAS NUEVAS
// ============================================

export async function checkAndSaveNewMedals(userId: string): Promise<CheckMedalsResponse> {
  if (!RUNTIME_MEDAL_RECALC_ENABLED) {
    return { success: true, newMedals: [] }
  }

  try {
    const db = getDb()
    const storedMedals = await getStoredUserMedals(userId)

    // Obtener medallas actuales basadas en rendimiento
    const currentMedals = await calculateCurrentUserMedals(userId, storedMedals)

    // Obtener medallas ya almacenadas
    const storedMedalIds = new Set(storedMedals.map((medal) => medal.id))

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

async function getStoredUserMedals(userId: string): Promise<UserMedal[]> {
  try {
    const db = getMedalsReadDb()
    const rows = await db.execute(
      sql`SELECT medal_id, medal_data, unlocked_at
          FROM user_medals
          WHERE user_id = ${userId}::uuid
          ORDER BY unlocked_at DESC`
    )

    return ((rows as any[]) || [])
      .map((row: any) => normalizeStoredMedal(row, userId))
      .filter((medal: UserMedal | null): medal is UserMedal => medal !== null)
  } catch (error) {
    console.error('❌ [Medals] Error leyendo medallas guardadas:', error)
    return []
  }
}

function normalizeStoredMedal(row: any, userId: string): UserMedal | null {
  const medalData = row?.medal_data
  const stored = typeof medalData === 'object' && medalData !== null ? medalData : {}
  const medalId = typeof row?.medal_id === 'string' ? row.medal_id : stored.id
  if (typeof medalId !== 'string') return null

  const definition = Object.values(RANKING_MEDALS).find((medal) => medal.id === medalId)
  const unlockedAt = row?.unlocked_at
    ? new Date(row.unlocked_at).toISOString()
    : typeof stored.unlockedAt === 'string'
      ? stored.unlockedAt
      : new Date().toISOString()

  return {
    id: medalId,
    title: typeof stored.title === 'string' ? stored.title : definition?.title ?? medalId,
    description: typeof stored.description === 'string' ? stored.description : definition?.description ?? '',
    category: typeof stored.category === 'string' ? stored.category : definition?.category ?? 'Ranking',
    emailTemplate: typeof stored.emailTemplate === 'string' ? stored.emailTemplate : definition?.emailTemplate ?? '',
    unlocked: true,
    progress: typeof stored.progress === 'string' ? stored.progress : 'Medalla conseguida',
    unlockedAt,
    rank: typeof stored.rank === 'number' ? stored.rank : 0,
    period: typeof stored.period === 'string' ? stored.period : 'stored',
    stats: typeof stored.stats === 'object' && stored.stats !== null
      ? stored.stats
      : {
          userId,
          totalQuestions: 0,
          correctAnswers: 0,
          accuracy: 0,
        },
  }
}

async function isUserRecentlyActive(db: ReturnType<typeof getDb>, userId: string): Promise<boolean> {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    const result = await db.execute(
      sql`SELECT 1 FROM test_questions tq
          WHERE tq.user_id = ${userId}::uuid
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
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'http://localhost:3000'

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
