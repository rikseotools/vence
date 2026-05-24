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
//
// V3 (2026-05-24): si llega `oposicionId` derivamos el tema dinámicamente
// desde article_id + topic_scope de esa oposición (módulo topic-progress),
// en lugar de agrupar por test_questions.tema_number. tema_number se rellena
// con la oposición activa del user en el momento del INSERT y NO se reasigna
// si después cambia de target_oposicion. La query legacy mezclaba B2 de
// oposiciones distintas (T101 AAE "Atención al ciudadano" colisionaba con
// T101 SS "SS en la CE"). La rama V3 es backward compatible: si el caller
// no manda `oposicionId`, se mantiene la query legacy.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getReadDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getCached, setCached } from '@/lib/cache/redis'
import { getUserThemeStatsByOposicion } from '@/lib/api/theme-stats/queries'
import { ALL_OPOSICION_SLUGS } from '@/lib/config/oposiciones'
import type { OposicionSlug } from '@/lib/api/theme-stats/schemas'

const userIdSchema = z.string().uuid()
const oposicionSlugSet = new Set<string>(ALL_OPOSICION_SLUGS)

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

  const oposicionIdRaw = request.nextUrl.searchParams.get('oposicionId')
  // Validar contra el enum de oposiciones conocidas. Si llega un valor que no
  // existe, devolver 400 (mejor fallar pronto que devolver datos vacíos sin
  // explicación). Si no llega → undefined → rama legacy.
  if (oposicionIdRaw !== null && !oposicionSlugSet.has(oposicionIdRaw)) {
    return NextResponse.json({ success: false, error: `oposicionId no válido: ${oposicionIdRaw}` }, { status: 400 })
  }
  const oposicionId = (oposicionIdRaw as OposicionSlug | null) ?? undefined

  // Cache key incluye oposicionId para no mezclar entre oposiciones.
  // Las claves antiguas (`theme_stats:${userId}`) coexisten para clientes
  // que aún no envían oposicionId (backward compat).
  const cacheKey = oposicionId
    ? `theme_stats:${userId}:${oposicionId}`
    : `theme_stats:${userId}`
  const cached = await getCached<CachedThemeStats>(cacheKey)

  // Fast path: cache fresco (< 5min) → devolver sin tocar BD
  if (cached && Date.now() - cached.ts < FRESH_WINDOW_MS) {
    return NextResponse.json({ success: true, stats: cached.data })
  }

  // === RAMA V4 (2026-05-24): agrupa tema_number filtrando por tests.position_type ===
  //
  // Por qué V4 (y no la V3 con derivación article→topic):
  //   - V3 hacía JOIN test_questions → questions → articles + lookup mapping
  //     por oposición. Para users heavy (>50k test_questions) el JOIN agotaba
  //     el timeout de 10s (medido: 12s para user con 64k). Fallback a stale
  //     servía [] en cold start → user veía dashboard vacío.
  //   - V4 aprovecha tests.position_type (columna persistida + índice parcial
  //     idx_tests_user_position_completed, migración 2026-05-24). El filtro
  //     por (user_id, position_type) reduce el set ANTES del GROUP BY.
  //   - Semánticamente más correcto: solo cuenta lo hecho EN la oposición
  //     del dashboard, sin atribuir respuestas de tests AAE al dashboard SS
  //     por solapamiento de scope. Es justo lo que pidió el usuario que
  //     motivó este refactor (María Lorenzo, feedback 0f4734c0).
  //   - Si el user no ha hecho NINGÚN test en esa oposición pero tiene tests
  //     antiguos sin position_type (NULL) que podrían encajar, NO los
  //     contamos. Esos son tests globales (/test/rapido, /leyes/...). El
  //     fallback "todos los tests" pertenece a la rama LEGACY sin oposicionId.
  if (oposicionId) {
    const positionType = oposicionId.replace(/-/g, '_')

    try {
      const db = getReadDb()
      // CTE MATERIALIZED para forzar el orden del plan: primero materializar
      // los test_ids de esta oposición (índice parcial idx_tests_user_position_completed
      // cubre user_id+position_type+completed_at), después join sobre
      // test_questions por test_id (índice idx_test_questions_test_id).
      // Sin CTE Postgres elegía Bitmap Scan(tq.user_id) → 64k filas heap
      // (~3s) ANTES de filtrar por tests.position_type, agotando timeout.
      const queryPromise = db.execute(sql`
        WITH user_tests AS MATERIALIZED (
          SELECT id FROM tests
          WHERE user_id = ${userId} AND position_type = ${positionType}
        )
        SELECT
          tq.tema_number,
          COUNT(*)::int as total,
          SUM(CASE WHEN tq.is_correct = true THEN 1 ELSE 0 END)::int as correct,
          ROUND((SUM(CASE WHEN tq.is_correct = true THEN 1 ELSE 0 END)::numeric
            / NULLIF(COUNT(*), 0)) * 100, 0)::int as accuracy,
          SUM(CASE WHEN tq.created_at >= now() - interval '30 days' THEN 1 ELSE 0 END)::int as total_30d,
          SUM(CASE WHEN tq.created_at >= now() - interval '30 days' AND tq.is_correct = true THEN 1 ELSE 0 END)::int as correct_30d,
          CASE WHEN SUM(CASE WHEN tq.created_at >= now() - interval '30 days' THEN 1 ELSE 0 END) > 0
            THEN ROUND((SUM(CASE WHEN tq.created_at >= now() - interval '30 days' AND tq.is_correct = true THEN 1 ELSE 0 END)::numeric
              / SUM(CASE WHEN tq.created_at >= now() - interval '30 days' THEN 1 ELSE 0 END)) * 100, 0)::int
            ELSE NULL END as accuracy_30d,
          MAX(tq.created_at)::text as last_study
        FROM user_tests ut
        INNER JOIN test_questions tq ON tq.test_id = ut.id
        WHERE tq.tema_number IS NOT NULL
        GROUP BY tq.tema_number
        ORDER BY tq.tema_number
      `)

      const result = await Promise.race([
        queryPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('theme-stats v4 timeout')), BD_TIMEOUT_MS)
        ),
      ])

      const stats: ThemeStat[] = (result as any[]).map((r: any) => ({
        tema_number: r.tema_number,
        total: Number(r.total),
        correct: Number(r.correct),
        accuracy: Number(r.accuracy),
        total_30d: Number(r.total_30d || 0),
        correct_30d: Number(r.correct_30d || 0),
        accuracy_30d: r.accuracy_30d != null ? Number(r.accuracy_30d) : null,
        last_study: r.last_study,
      }))

      setCached(cacheKey, { data: stats, ts: Date.now() }, STALE_TTL_S)
      return NextResponse.json({ success: true, stats })
    } catch (err) {
      // Timeout o error BD: cache stale si existe
      if (cached) {
        const ageS = Math.floor((Date.now() - cached.ts) / 1000)
        console.warn(`⏱️ [theme-stats v4] timeout for ${userId.slice(0, 8)}/${oposicionId}, stale (${ageS}s)`)
        return NextResponse.json({ success: true, stats: cached.data })
      }
      console.warn(`⏱️ [theme-stats v4] timeout for ${userId.slice(0, 8)}/${oposicionId}, empty`)
      return NextResponse.json({ success: true, stats: [] })
    }
  }

  // === RAMA LEGACY: query SQL por tema_number (sin contexto de oposición) ===
  try {
    // getReadDb apunta al replica si USE_READ_REPLICA=true, fallback primary.
    // theme-stats es read-only y tolerable a stale (lag típico 0.4s).
    const db = getReadDb()

    // Query optimizada (2026-05-06): elimina JOIN con tests usando user_id
    // ya denormalizado en test_questions + covering index idx_tq_user_tema_covering
    // (migración 20260506_idx_tq_user_tema_covering.sql).
    //
    // Antes: Nested Loop test×test_questions + Bitmap Heap Scan = 12.5s para
    // user con 56k test_questions (timeout a los 10s, fallback empty).
    // Ahora: Index Only Scan = 502ms para el mismo user (24.9x speedup).
    // Verificado paridad 100% con la query antigua sobre 3 users heavy.
    const queryPromise = db.execute(sql`
      SELECT
        tema_number,
        COUNT(*)::int as total,
        SUM(CASE WHEN is_correct = true THEN 1 ELSE 0 END)::int as correct,
        ROUND((SUM(CASE WHEN is_correct = true THEN 1 ELSE 0 END)::numeric
          / NULLIF(COUNT(*), 0)) * 100, 0)::int as accuracy,
        -- Accuracy últimos 30 días (mismo scan, sin coste extra)
        SUM(CASE WHEN created_at >= now() - interval '30 days' THEN 1 ELSE 0 END)::int as total_30d,
        SUM(CASE WHEN created_at >= now() - interval '30 days' AND is_correct = true THEN 1 ELSE 0 END)::int as correct_30d,
        CASE WHEN SUM(CASE WHEN created_at >= now() - interval '30 days' THEN 1 ELSE 0 END) > 0
          THEN ROUND((SUM(CASE WHEN created_at >= now() - interval '30 days' AND is_correct = true THEN 1 ELSE 0 END)::numeric
            / SUM(CASE WHEN created_at >= now() - interval '30 days' THEN 1 ELSE 0 END)) * 100, 0)::int
          ELSE NULL END as accuracy_30d,
        MAX(created_at)::text as last_study
      FROM test_questions
      WHERE user_id = ${userId} AND tema_number IS NOT NULL
      GROUP BY tema_number
      ORDER BY tema_number
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
