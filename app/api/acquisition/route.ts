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
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
import { userAcquisition, attributionTouches } from '@/db/schema'
import { deriveChannel } from '@/lib/attribution/deriveChannel'
import { hasCampaignSignal } from '@/lib/attribution/touchPolicy'

export const maxDuration = 15

const bodySchema = z.object({
  deviceId: z.string().min(1).max(128).nullish(),
  // client_id de GA4 (cookie _ga) — para el GA4Destination (Measurement Protocol).
  gaClientId: z.string().max(128).nullish(),
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

    // Respaldo cuando este device NO tiene toques (adblock, sessionStorage limpiado,
    // registro desde otro dispositivo…). Antes esta rama fijaba 'direct' a secas y
    // DESCARTABA los campos directos que el caller hubiera mandado — lo que convertía
    // en 'direct' a usuarios cuyo gclid/UTM sí conocíamos. Desde T-243 `AuthContext`
    // manda `deviceId` Y los campos, así que aquí se aprovechan los dos.
    const sinToques = touches.length === 0
    const canalRespaldo = sinToques
      ? (hasCampaignSignal(a) || a.referrer ? deriveChannel(a) : a.channel || 'direct')
      : deriveChannel(touches[0])

    // GA4 client_id: guardarlo aunque NO haya toques de campaña (sirve para que
    // GA4 atribuya también ventas orgánicas/directas). Asegura la fila base y
    // preserva el primer client_id capturado (coalesce).
    if (a.gaClientId) {
      await db
        .insert(userAcquisition)
        .values({
          userId,
          channel: canalRespaldo,
          gclid: sinToques ? a.gclid ?? null : null,
          fbclid: sinToques ? a.fbclid ?? null : null,
          utmSource: sinToques ? a.utmSource ?? null : null,
          utmMedium: sinToques ? a.utmMedium ?? null : null,
          utmCampaign: sinToques ? a.utmCampaign ?? null : null,
          landingPath: sinToques ? a.landingPath ?? null : null,
          referrer: sinToques ? a.referrer ?? null : null,
          gaClientId: a.gaClientId,
        })
        .onConflictDoUpdate({
          target: userAcquisition.userId,
          set: { gaClientId: sql`coalesce(${userAcquisition.gaClientId}, ${a.gaClientId})` },
        })
    }

    // Fallback de COBERTURA: si no hubo toques NI gaClientId (directo sin GA,
    // consentimiento rechazado, adblock…), garantizar fila base para que TODO usuario
    // tenga canal. onConflictDoNothing → nunca pisa atribución real existente. Sube la
    // cobertura hacia el 100%. Usa los campos directos si los hay (T-243): mejor un
    // 'google_ads' con su gclid que un 'direct' vacío.
    const baseRow = sinToques && !a.gaClientId
      ? await db
          .insert(userAcquisition)
          .values({
            userId,
            channel: canalRespaldo,
            gclid: a.gclid ?? null,
            fbclid: a.fbclid ?? null,
            utmSource: a.utmSource ?? null,
            utmMedium: a.utmMedium ?? null,
            utmCampaign: a.utmCampaign ?? null,
            landingPath: a.landingPath ?? null,
            referrer: a.referrer ?? null,
          })
          .onConflictDoNothing()
          .returning({ id: userAcquisition.userId })
      : null

    return NextResponse.json({ success: true, touches: touches.length, baseCreated: !!baseRow?.length })
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
