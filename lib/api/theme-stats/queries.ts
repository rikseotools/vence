// lib/api/theme-stats/queries.ts - Queries optimizadas para estadísticas por tema
import { getDb } from '@/db/client'
import { tests, testQuestions } from '@/db/schema'
import { eq, and, sql, isNotNull } from 'drizzle-orm'
import type { GetThemeStatsResponse, ThemeStat } from './schemas'

// Cache simple en memoria (30 segundos - reducido para mejor UX)
const statsCache = new Map<string, { data: GetThemeStatsResponse; timestamp: number }>()
const CACHE_TTL = 30 * 1000 // 30 segundos

/**
 * Obtiene las estadísticas por tema para un usuario
 * Reemplaza la función RPC get_user_theme_stats
 */
export async function getUserThemeStats(userId: string): Promise<GetThemeStatsResponse> {
  try {
    // Verificar cache
    const cached = statsCache.get(userId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { ...cached.data, cached: true }
    }

    const db = getDb()

    // Query optimizada con Drizzle - agrupa por tema
    const result = await db
      .select({
        temaNumber: testQuestions.temaNumber,
        total: sql<number>`COUNT(*)::int`,
        correct: sql<number>`SUM(CASE WHEN ${testQuestions.isCorrect} THEN 1 ELSE 0 END)::int`,
        lastStudy: sql<string>`MAX(${testQuestions.createdAt})`,
      })
      .from(testQuestions)
      .innerJoin(tests, eq(testQuestions.testId, tests.id))
      .where(and(
        eq(tests.userId, userId),
        isNotNull(testQuestions.temaNumber)
      ))
      .groupBy(testQuestions.temaNumber)
      .orderBy(testQuestions.temaNumber)

    // Procesar resultados
    const stats: Record<string, ThemeStat> = {}

    for (const row of result) {
      if (row.temaNumber === null) continue

      const total = row.total || 0
      const correct = row.correct || 0
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
      const lastStudyDate = row.lastStudy ? new Date(row.lastStudy) : null

      stats[row.temaNumber.toString()] = {
        temaNumber: row.temaNumber,
        total,
        correct,
        accuracy,
        lastStudy: row.lastStudy,
        lastStudyFormatted: lastStudyDate
          ? lastStudyDate.toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short'
            })
          : 'Nunca'
      }
    }

    const response: GetThemeStatsResponse = {
      success: true,
      stats,
      generatedAt: new Date().toISOString(),
    }

    // Guardar en cache
    statsCache.set(userId, { data: response, timestamp: Date.now() })

    return response
  } catch (error) {
    console.error('Error obteniendo estadísticas por tema:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Invalida el cache de un usuario específico
 */
export function invalidateThemeStatsCache(userId: string): void {
  statsCache.delete(userId)
}

/**
 * Limpia todo el cache
 */
export function clearAllThemeStatsCache(): void {
  statsCache.clear()
}
