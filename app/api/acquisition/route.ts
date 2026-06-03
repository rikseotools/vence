// app/api/acquisition/route.ts
// Binding de atribución anónima → usuario, en el momento del registro/login.
//
// AGNÓSTICO: escribe vía Drizzle (getAdminDb), NO usa supabase.from()/rpc.
// Funciona igual en Supabase hoy y en RDS mañana. El control de acceso está
// aquí (verifyAuth), no en RLS/PostgREST.
//
// Modo principal (F0 trackeo-conversiones-ventas): recibe `deviceId`, resuelve
// los `attribution_touches` de ese device, deriva first-touch + last-touch,
// hace upsert en `user_acquisition` (first-touch inmutable, last-touch siempre
// fresco) y liga los toques al usuario (backfill user_id).
//
// Modo legacy (compat): si llega sin deviceId pero con campos directos
// (gclid/utm…), inserta el first-touch como antes (ON CONFLICT DO NOTHING).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { and, asc, desc, eq, isNull, or } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
import { userAcquisition, attributionTouches } from '@/db/schema'

export const maxDuration = 15

const bodySchema = z.object({
  deviceId: z.string().min(1).max(128).nullish(),
  // Legacy / fallback directo:
  channel: z.string().min(1).max(40).nullish(),
  gclid: z.string().max(512).nullish(),
  fbclid: z.string().max(512).nullish(),
  utmSource: z.string().max(255).nullish(),
  utmMedium: z.string().max(255).nullish(),
  utmCampaign: z.string().max(255).nullish(),
  landingPath: z.string().max(2048).nullish(),
  referrer: z.string().max(2048).nullish(),
})

type Touch = typeof attributionTouches.$inferSelect

/** Deriva el canal de marketing a partir de los click-IDs/UTM de un toque. */
function deriveChannel(t: Pick<Touch, 'gclid' | 'gbraid' | 'wbraid' | 'fbclid' | 'ttclid' | 'msclkid' | 'utmSource' | 'utmMedium'>): string {
  if (t.gclid || t.gbraid || t.wbraid) return 'google_ads'
  if (t.fbclid) return 'meta_ads'
  if (t.ttclid) return 'tiktok_ads'
  if (t.msclkid) return 'bing_ads'
  const src = (t.utmSource || '').toLowerCase()
  const med = (t.utmMedium || '').toLowerCase()
  if (src === 'google' && med === 'cpc') return 'google_ads'
  if (['facebook', 'instagram', 'meta'].includes(src) || src.includes('fb') || src.includes('meta')) return 'meta_ads'
  if (src || med) return src ? `${src}${med ? '/' + med : ''}` : 'referral'
  return 'organic'
}

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
  const db = getAdminDb()
  const userId = auth.userId

  // ─── Modo principal: binding por deviceId ────────────────────────
  if (a.deviceId) {
    // Toques de este device aún no ligados (o ya ligados a este mismo user).
    const touches = await db
      .select()
      .from(attributionTouches)
      .where(and(
        eq(attributionTouches.deviceId, a.deviceId),
        or(isNull(attributionTouches.userId), eq(attributionTouches.userId, userId)),
      ))
      .orderBy(asc(attributionTouches.occurredAt))

    if (touches.length > 0) {
      const first = touches[0]
      const last = touches[touches.length - 1]
      const firstChannel = deriveChannel(first)
      const lastChannel = deriveChannel(last)

      // First-touch: crear la fila base si no existe (inmutable).
      await db
        .insert(userAcquisition)
        .values({
          userId,
          channel: firstChannel,
          gclid: first.gclid ?? null,
          fbclid: first.fbclid ?? null,
          gbraid: first.gbraid ?? null,
          wbraid: first.wbraid ?? null,
          ttclid: first.ttclid ?? null,
          msclkid: first.msclkid ?? null,
          utmSource: first.utmSource ?? null,
          utmMedium: first.utmMedium ?? null,
          utmCampaign: first.utmCampaign ?? null,
          landingPath: first.landingPath ?? null,
          referrer: first.referrer ?? null,
        })
        .onConflictDoNothing()

      // Last-touch: siempre refrescado (sirve a la atribución de la conversión).
      await db
        .update(userAcquisition)
        .set({
          lastChannel,
          lastGclid: last.gclid ?? null,
          lastUtmSource: last.utmSource ?? null,
          lastUtmCampaign: last.utmCampaign ?? null,
          lastLandingPath: last.landingPath ?? null,
          lastCapturedAt: last.occurredAt,
        })
        .where(eq(userAcquisition.userId, userId))

      // Backfill: ligar los toques anónimos de este device al usuario.
      await db
        .update(attributionTouches)
        .set({ userId })
        .where(and(
          eq(attributionTouches.deviceId, a.deviceId),
          isNull(attributionTouches.userId),
        ))
    }

    return NextResponse.json({ success: true, touches: touches.length })
  }

  // ─── Modo legacy: first-touch desde campos directos ──────────────
  await db
    .insert(userAcquisition)
    .values({
      userId,
      channel: a.channel || 'organic',
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
