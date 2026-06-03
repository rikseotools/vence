// app/api/attribution/touch/route.ts
//
// F0 — trackeo-conversiones-ventas. Endpoint público (pre-login) que registra
// un toque de atribución anónimo en `attribution_touches`, keyed por el
// `vence_device_id` (1ª parte, generado por components/FraudTracker.tsx).
//
// Patrón: fire-and-forget desde el browser vía navigator.sendBeacon (igual que
// /api/interactions). Sin auth (el toque ocurre antes de registrarse) pero con
// ORIGIN-ALLOWLIST (copiado de /api/observability/ingest) para que terceros no
// llenen la tabla. Escritura agnóstica vía getAdminDb (Drizzle) → RDS-ready.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'
import { getAdminDb } from '@/db/client'
import { attributionTouches } from '@/db/schema'

export const maxDuration = 10
const TOUCH_TIMEOUT_MS = 5000

// Hosts permitidos (mismo criterio que /api/observability/ingest).
const ALLOWED_ORIGINS = [
  'https://www.vence.es',
  'https://vence.es',
  'https://preview-aws.vence.es',
] as const

function isAllowedClientOrigin(originHeader: string | null): boolean {
  if (!originHeader) return false
  if ((ALLOWED_ORIGINS as readonly string[]).includes(originHeader)) return true
  if (/^https:\/\/[\w-]+\.vercel\.app$/.test(originHeader)) return true
  // Desarrollo local
  if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(originHeader)) return true
  return false
}

const clickId = z.string().max(512).nullish()
const utm = z.string().max(255).nullish()

const bodySchema = z.object({
  deviceId: z.string().min(1).max(128),
  gclid: clickId,
  gbraid: clickId,
  wbraid: clickId,
  fbclid: clickId,
  ttclid: clickId,
  msclkid: clickId,
  utmSource: utm,
  utmMedium: utm,
  utmCampaign: utm,
  utmTerm: utm,
  utmContent: utm,
  landingPath: z.string().max(2048).nullish(),
  referrer: z.string().max(2048).nullish(),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  // Origin-allowlist (no auth: el toque es pre-login).
  if (!isAllowedClientOrigin(request.headers.get('origin'))) {
    return NextResponse.json({ success: false, error: 'forbidden_origin' }, { status: 403 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }
  const a = parsed.data

  // Solo persistir si hay alguna señal de atribución (evita ruido de page-loads
  // orgánicos sin parámetros). El cliente ya filtra, esto es defensa en profundidad.
  const hasSignal =
    a.gclid || a.gbraid || a.wbraid || a.fbclid || a.ttclid || a.msclkid ||
    a.utmSource || a.utmCampaign
  if (!hasSignal) {
    return NextResponse.json({ success: true, skipped: 'no_signal' })
  }

  try {
    await withDbTimeout(
      () =>
        getAdminDb()
          .insert(attributionTouches)
          .values({
            deviceId: a.deviceId,
            gclid: a.gclid ?? null,
            gbraid: a.gbraid ?? null,
            wbraid: a.wbraid ?? null,
            fbclid: a.fbclid ?? null,
            ttclid: a.ttclid ?? null,
            msclkid: a.msclkid ?? null,
            utmSource: a.utmSource ?? null,
            utmMedium: a.utmMedium ?? null,
            utmCampaign: a.utmCampaign ?? null,
            utmTerm: a.utmTerm ?? null,
            utmContent: a.utmContent ?? null,
            landingPath: a.landingPath ?? null,
            referrer: a.referrer ?? null,
          }),
      TOUCH_TIMEOUT_MS,
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    // Fire-and-forget: un blip de BD no debe romper la navegación del usuario.
    if (isDbTimeoutError(error)) {
      return NextResponse.json({ success: false, reason: 'db_unavailable' }, { status: 200 })
    }
    throw error
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export const POST = withErrorLogging('/api/attribution/touch', _POST)
