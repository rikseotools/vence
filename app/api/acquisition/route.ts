// app/api/acquisition/route.ts
// Persiste la atribución first-touch del usuario (gclid/fbclid/utm/landing).
//
// AGNÓSTICO: escribe vía Drizzle (getAdminDb), NO usa supabase.from()/rpc.
// Funciona igual en Supabase hoy y en RDS mañana. El control de acceso está
// aquí (verifyAuth), no en RLS/PostgREST.
//
// Idempotente por usuario: ON CONFLICT DO NOTHING preserva el primer toque.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
import { userAcquisition } from '@/db/schema'

export const maxDuration = 15

const bodySchema = z.object({
  channel: z.string().min(1).max(40),
  gclid: z.string().max(512).nullish(),
  fbclid: z.string().max(512).nullish(),
  utmSource: z.string().max(255).nullish(),
  utmMedium: z.string().max(255).nullish(),
  utmCampaign: z.string().max(255).nullish(),
  landingPath: z.string().max(2048).nullish(),
  referrer: z.string().max(2048).nullish(),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/acquisition')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }
  const a = parsed.data

  // first-touch: el userId es la PK; si ya existe, no se toca.
  await getAdminDb()
    .insert(userAcquisition)
    .values({
      userId: auth.userId,
      channel: a.channel,
      gclid: a.gclid ?? null,
      fbclid: a.fbclid ?? null,
      utmSource: a.utmSource ?? null,
      utmMedium: a.utmMedium ?? null,
      utmCampaign: a.utmCampaign ?? null,
      landingPath: a.landingPath ?? null,
      referrer: a.referrer ?? null,
    })
    .onConflictDoNothing()

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/acquisition', _POST)
