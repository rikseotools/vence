// lib/api/user-stats/queries.ts - Drizzle queries para User Stats v2
// Reemplaza la RPC get_user_public_stats (5 CTEs, ~1.8s) con 2 queries simples
import { getDb } from '@/db/client'
import { tests, testQuestions, userStreaks } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import type { UserPublicStats } from './schemas'

// Cache en memoria: evita que N page_views del mismo usuario en pocos minutos
// disparen N full-scans de test_questions (733k+ filas). La query tarda 1-3s
// para usuarios normales y >10s para heavy users → 504 en Vercel (10s timeout).
// Cache TTL 5 min: stats no necesitan ser real-time (se actualizan al responder).
interface CachedStats {
  data: UserPublicStats
  timestamp: number
}
const statsCache = new Map<string, CachedStats>()
const STATS_CACHE_TTL = 5 * 60 * 1000 // 5 minutos

/** Invalidar cache de un usuario (llamar después de guardar respuesta) */
export function invalidateUserStatsCache(userId: string): void {
  statsCache.delete(userId)
}

export async function getUserPublicStats(userId: string): Promise<UserPublicStats> {
  // Check cache
  const cached = statsCache.get(userId)
  if (cached && Date.now() - cached.timestamp < STATS_CACHE_TTL) {
    return cached.data
  }

  const db = getDb()

  const mondayThisWeek = getMondayThisWeek()

  // Query 1: total + accuracy + this week + desglose correct/blank (un solo
  // scan de test_questions). blankAnswers requiere was_blank=true (añadido
  // 15/4/2026 con la feature "Dejar en blanco"). Para filas legacy (before
  // was_blank), el valor default es false y cuentan como incorrectas.
  //
  // Timeout de 8s: si Supabase está lento, mejor devolver cache stale o
  // defaults que bloquear la UI entera con un 504.
  const timeoutMs = 8_000
  const queryPromise = db
    .select({
      totalQuestions: sql<number>`count(*)::int`,
      correctAnswers: sql<number>`sum(case when ${testQuestions.isCorrect} then 1 else 0 end)::int`,
      blankAnswers: sql<number>`sum(case when ${testQuestions.wasBlank} then 1 else 0 end)::int`,
      questionsThisWeek: sql<number>`sum(case when ${testQuestions.createdAt} >= ${mondayThisWeek} then 1 else 0 end)::int`,
    })
    .from(testQuestions)
    .innerJoin(tests, eq(testQuestions.testId, tests.id))
    .where(eq(tests.userId, userId))

  let statsResult: Awaited<typeof queryPromise>[0] | null = null
  try {
    const [result] = await Promise.race([
      queryPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('user-stats query timeout')), timeoutMs)
      ),
    ])
    statsResult = result
  } catch (err) {
    // Timeout o error de BD: devolver cache stale si existe, sino defaults
    if (cached) {
      console.warn(`⏱️ [user-stats] timeout for ${userId.slice(0,8)}, returning stale cache`)
      return cached.data
    }
    console.warn(`⏱️ [user-stats] timeout for ${userId.slice(0,8)}, no cache, returning defaults`)
    return { totalQuestions: 0, globalAccuracy: 0, currentStreak: 0, questionsThisWeek: 0, correctAnswers: 0, incorrectAnswers: 0, blankAnswers: 0 }
  }

  // Query 2: streak (lookup directo por user_id, instantaneo)
  const [streakResult] = await db
    .select({
      currentStreak: userStreaks.currentStreak,
    })
    .from(userStreaks)
    .where(eq(userStreaks.userId, userId))
    .limit(1)

  const total = statsResult?.totalQuestions ?? 0
  const correct = statsResult?.correctAnswers ?? 0
  const blank = statsResult?.blankAnswers ?? 0
  // incorrectas REALES = no acertadas Y no en blanco. Rama legacy: filas con
  // wasBlank=false pero que eran -1 en realidad (rare edge case de respuestas
  // pre-15/4/2026 que podrían haber quedado con letra incorrecta) cuentan como
  // incorrectas — pérdida aceptable, era pre-feature.
  const incorrect = total - correct - blank

  const result: UserPublicStats = {
    totalQuestions: total,
    globalAccuracy: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
    currentStreak: streakResult?.currentStreak ?? 0,
    questionsThisWeek: statsResult?.questionsThisWeek ?? 0,
    correctAnswers: correct,
    incorrectAnswers: Math.max(0, incorrect),
    blankAnswers: blank,
  }

  // Guardar en cache
  statsCache.set(userId, { data: result, timestamp: Date.now() })

  return result
}

function getMondayThisWeek(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
}
