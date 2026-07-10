// app/api/teoria/search/route.ts — GATE de cuota de búsquedas de /teoria.
//
// NO busca: consume/verifica la cuota diaria de búsquedas (5/día free+anónimos,
// ilimitado premium) vía el primitivo genérico lib/api/featureLimits.ts. El
// cliente (components/TeoriaSearch) llama a este gate ANTES de navegar a ?q=; si
// devuelve 429, muestra el CTA (registro/premium) y NO navega. Si 200, navega y
// el Server Component sirve los resultados (matview+FTS) como siempre.
//
// Por qué gate y no buscar aquí: la auth de la app es Bearer (no cookie) → el RSC
// no puede identificar al usuario en una navegación normal. Este endpoint SÍ
// recibe el Bearer + X-Device-Id (lo manda authHeaders del cliente), así que es
// el punto correcto para contar. Evita además doble búsqueda (RSC + endpoint).
//
// SEO INTACTO: ver/leer leyes (/teoria, /teoria/[law], /teoria/[law]/[art]) sigue
// SSR, público, indexable y en el sitemap. Solo se cuenta el ACTO de buscar, que
// no es objetivo SEO ni lo usa Googlebot.

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthOptional } from '@/lib/api/auth/verifyAuth'
import { getDeviceIdFromRequest } from '@/lib/api/deviceLimit'
import { getClientIp } from '@/lib/api/rateLimit'
import { getAdminDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import {
  getFeatureLimitStatus,
  consumeFeatureLimit,
  type FeatureIdentity,
} from '@/lib/api/featureLimits'
import { normalizeQuery } from '@/lib/api/laws/teoriaCatalog'

const FEATURE = { feature: 'teoria_search', freeLimit: 5 } as const

async function _GET(request: NextRequest): Promise<NextResponse> {
  const q = normalizeQuery(new URL(request.url).searchParams.get('q'))
  // Query vacía = limpiar/volver al catálogo. No es una búsqueda: no cuenta.
  if (!q) return NextResponse.json({ allowed: true, counted: false })

  // ─── Identidad + premium (fuente de verdad = BD, no el cliente) ───────────
  const auth = await verifyAuthOptional(request, '/api/teoria/search')
  const userId = auth?.userId ?? null
  let isPremium = false
  if (userId) {
    try {
      const rows = await getAdminDb()
        .select({ plan_type: userProfiles.planType })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1)
      const plan = rows[0]?.plan_type
      isPremium = plan === 'premium' || plan === 'trial'
    } catch {
      // Fail-open del check premium: un blip de BD no bloquea (como mucho un
      // premium consume 1 de cuota; el contador free sigue aplicando).
    }
  }

  const identity: FeatureIdentity = {
    userId,
    deviceId: getDeviceIdFromRequest(request),
    ip: getClientIp(request),
    isPremium,
  }

  // ─── Gate ─────────────────────────────────────────────────────────────────
  const status = await getFeatureLimitStatus(FEATURE, identity)
  if (!status.allowed) {
    return NextResponse.json(
      {
        allowed: false,
        blocked: true,
        isPremium: false,
        loggedIn: !!userId,
        used: status.used,
        limit: status.limit,
        remaining: 0,
      },
      { status: 429 },
    )
  }

  // Permitido → consumir 1 (solo búsquedas reales de free/anónimos; premium no-op).
  await consumeFeatureLimit(FEATURE, identity)

  return NextResponse.json({
    allowed: true,
    counted: !status.isPremium,
    isPremium: status.isPremium,
    used: status.isPremium ? 0 : status.used + 1,
    limit: status.limit,
    remaining: status.isPremium ? null : Math.max(0, status.remaining - 1),
  })
}

export const GET = withErrorLogging('/api/teoria/search', _GET)
