// app/api/v2/topic-progress/theme-stats/route.ts
// Reemplaza supabase.rpc('get_user_theme_stats') que tardaba 16s para heavy users.
// Usa Drizzle con timeout de 10s + cache server-side compartido en Redis.
//
// Estrategia de cache (Fase 1 escalabilidad):
// - Una sola key Redis con TTL 24h (stale fallback) y timestamp interno
// - Si timestamp < 5min → fresh, devolver inmediato (no toca BD)
// - Si timestamp ≥ 5min → query BD; si BD responde, refresh; si BD timeout,
//   devolver versión stale (mejor servir datos viejos que pantalla vacía)
//
// Antes era Map in-memory (TTL 5min) que fragmentaba entre instancias Vercel
// Fluid: cada cold start pagaba la query lenta. Redis comparte entre todas.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getCached, setCached } from '@/lib/cache/redis'

const userIdSchema = z.string().uuid()

interface ThemeStat {
  tema_number: number
  total: number
  correct: number
  accuracy: number
  total_30d: number
  correct_30d: number
  accuracy_30d: number | null  // null si no hay datos en los últimos 30 días
  last_study: string | null
}

interface CachedThemeStats {
  data: ThemeStat[]
  ts: number  // ms epoch — usado para freshness check, NO Redis TTL
}

const FRESH_WINDOW_MS = 5 * 60 * 1000   // 5 min: dentro de esta ventana se considera fresh
const STALE_TTL_S = 24 * 60 * 60        // 24h: cuánto retiene Redis (para fallback en timeout BD)
const BD_TIMEOUT_MS = 10_000            // 10s: tope query BD; si excede, fallback a stale

async function _GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId || !userIdSchema.safeParse(userId).success) {
    return NextResponse.json({ success: false, error: 'userId inválido o faltante (debe ser UUID)' }, { status: 400 })
  }

  const cacheKey = `theme_stats:${userId}`
  const cached = await getCached<CachedThemeStats>(cacheKey)

  // Fast path: cache fresco (< 5min) → devolver sin tocar BD
  if (cached && Date.now() - cached.ts < FRESH_WINDOW_MS) {
    return NextResponse.json({ success: true, stats: cached.data })
  }

  try {
    const db = getDb()

    const queryPromise = db.execute(sql`
      SELECT
        tq.tema_number,
        COUNT(*)::int as total,
        SUM(CASE WHEN tq.is_correct = true THEN 1 ELSE 0 END)::int as correct,
        ROUND((SUM(CASE WHEN tq.is_correct = true THEN 1 ELSE 0 END)::numeric
          / NULLIF(COUNT(*), 0)) * 100, 0)::int as accuracy,
        -- Accuracy últimos 30 días (mismo scan, sin coste extra)
        SUM(CASE WHEN tq.created_at >= now() - interval '30 days' THEN 1 ELSE 0 END)::int as total_30d,
        SUM(CASE WHEN tq.created_at >= now() - interval '30 days' AND tq.is_correct = true THEN 1 ELSE 0 END)::int as correct_30d,
        CASE WHEN SUM(CASE WHEN tq.created_at >= now() - interval '30 days' THEN 1 ELSE 0 END) > 0
          THEN ROUND((SUM(CASE WHEN tq.created_at >= now() - interval '30 days' AND tq.is_correct = true THEN 1 ELSE 0 END)::numeric
            / SUM(CASE WHEN tq.created_at >= now() - interval '30 days' THEN 1 ELSE 0 END)) * 100, 0)::int
          ELSE NULL END as accuracy_30d,
        MAX(tq.created_at)::text as last_study
      FROM test_questions tq
      JOIN tests t ON tq.test_id = t.id
      WHERE t.user_id = ${userId} AND tq.tema_number IS NOT NULL
      GROUP BY tq.tema_number
      ORDER BY tq.tema_number
    `)

    const result = await Promise.race([
      queryPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('theme-stats timeout')), BD_TIMEOUT_MS)
      ),
    ])

    const stats = (result as any[]).map((r: any) => ({
      tema_number: r.tema_number,
      total: Number(r.total),
      correct: Number(r.correct),
      accuracy: Number(r.accuracy),
      total_30d: Number(r.total_30d || 0),
      correct_30d: Number(r.correct_30d || 0),
      accuracy_30d: r.accuracy_30d != null ? Number(r.accuracy_30d) : null,
      last_study: r.last_study,
    }))

    // Guardar en Redis con TTL 24h y timestamp para freshness check
    setCached(cacheKey, { data: stats, ts: Date.now() }, STALE_TTL_S)

    return NextResponse.json({ success: true, stats })
  } catch (err) {
    // Timeout o error BD: devolver cache stale si existe (mejor que pantalla vacía)
    if (cached) {
      const ageS = Math.floor((Date.now() - cached.ts) / 1000)
      console.warn(`⏱️ [theme-stats] timeout for ${userId.slice(0, 8)}, returning stale cache (${ageS}s old)`)
      return NextResponse.json({ success: true, stats: cached.data })
    }

    console.warn(`⏱️ [theme-stats] timeout for ${userId.slice(0, 8)}, returning empty`)
    return NextResponse.json({ success: true, stats: [] })
  }
}

export const GET = withErrorLogging('/api/v2/topic-progress/theme-stats', _GET)
