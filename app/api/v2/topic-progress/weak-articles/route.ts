// app/api/v2/topic-progress/weak-articles/route.ts
// API v2 para obtener artículos débiles por tema - Usa Drizzle + Zod
//
// Estrategia de cache (refactor 2026-05-09): stale-while-error con Redis,
// mismo patrón que /api/v2/topic-progress/theme-stats y
// /api/notifications/problematic-articles. Sobrevive blips del pooler
// regional Supavisor (que afectan tanto al primary como al replica).
//
// - Cache fresco (<5min) → devolver inmediato sin tocar BD
// - Cache stale + BD OK → refresh y devolver
// - Cache stale + BD timeout → devolver stale (200, NO 503)
// - Cache vacío + BD timeout → devolver weakArticlesByTopic={} (200)
// - Siempre 200 → 0 errores 5xx user-facing por este endpoint
//
// userId SIEMPRE deriva del Bearer token (auth.user.id) — nunca del body —
// para impedir cross-user leakage en cache key.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getWeakArticlesForUser,
  safeParseGetWeakArticles,
  type GetWeakArticlesRequest,
} from '@/lib/api/topic-progress'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getCached, setCached } from '@/lib/cache/redis'

// maxDuration bajado de 60s → 20s tras incidente cascade 2026-05-07 12:34 UTC.
// Read path analítico (agg sobre test_questions); 20s da margen sin permitir
// que un blip sature concurrency.
export const maxDuration = 20

interface CachedWeakArticles {
  data: { success: true; weakArticlesByTopic: Record<string, unknown> }
  ts: number  // ms epoch — usado para freshness check
}

const FRESH_WINDOW_MS = 5 * 60 * 1000   // 5 min: dentro de esta ventana es fresh
const STALE_TTL_S = 24 * 60 * 60        // 24h: cuánto retiene Redis (fallback timeout)
const BD_TIMEOUT_MS = 15_000            // 15s: tope query BD; si excede, fallback a stale

// Cliente Supabase solo para auth
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function _GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await getSupabase().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Parsear query params
    const { searchParams } = new URL(request.url)
    const params = {
      userId: user.id,
      minAttempts: parseInt(searchParams.get('minAttempts') || '2'),
      maxSuccessRate: parseInt(searchParams.get('maxSuccessRate') || '60'),
      maxPerTopic: parseInt(searchParams.get('maxPerTopic') || '5'),
      positionType: searchParams.get('positionType') || undefined,
    }

    // Validar con Zod
    const parseResult = safeParseGetWeakArticles(params)
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Parámetros inválidos',
        details: parseResult.error.errors,
      }, { status: 400 })
    }

    const validatedParams: GetWeakArticlesRequest = parseResult.data

    // Cache key: incluye userId + todos los filtros para que requests con
    // distintos params no colisionen.
    const cacheKey = `weak_articles:${validatedParams.userId}:${validatedParams.minAttempts}:${validatedParams.maxSuccessRate}:${validatedParams.maxPerTopic}:${validatedParams.positionType ?? 'all'}`
    const cached = await getCached<CachedWeakArticles>(cacheKey)

    // Fast path: cache fresco (<5min) → devolver sin tocar BD
    if (cached && Date.now() - cached.ts < FRESH_WINDOW_MS) {
      return NextResponse.json(cached.data)
    }

    try {
      const queryPromise = getWeakArticlesForUser(validatedParams)
      const result = await Promise.race([
        queryPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('weak-articles timeout')), BD_TIMEOUT_MS)
        ),
      ])

      if (!result.success) {
        return NextResponse.json(result, { status: 500 })
      }

      const response = {
        success: true as const,
        weakArticlesByTopic: result.weakArticlesByTopic ?? {},
      }

      // Guardar en Redis con TTL 24h y timestamp para freshness check
      setCached(cacheKey, { data: response, ts: Date.now() }, STALE_TTL_S)

      return NextResponse.json(response)
    } catch (err) {
      // Timeout o error BD: si tenemos cache (aun stale), devolverlo;
      // mejor servir datos viejos que 503. Si no hay cache, fallback a {}.
      if (cached) {
        const ageS = Math.floor((Date.now() - cached.ts) / 1000)
        console.warn(`⏱️ [API/v2/weak-articles] timeout for ${user.id.slice(0, 8)}, returning stale cache (${ageS}s old)`)
        return NextResponse.json(cached.data)
      }

      console.warn(`⏱️ [API/v2/weak-articles] timeout for ${user.id.slice(0, 8)}, returning empty`)
      return NextResponse.json({ success: true, weakArticlesByTopic: {} })
    }
  } catch (error) {
    console.error('❌ [API/v2/weak-articles] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/v2/topic-progress/weak-articles', _GET)
