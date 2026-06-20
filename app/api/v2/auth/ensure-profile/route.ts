// app/api/v2/auth/ensure-profile/route.ts
// Crea el user_profile en el primer login según la fuente de registro.
//
// AGNÓSTICO (Fase A2 de auth-agnostico-jwks-y-rls): invoca las funciones plpgsql
// create_{google_ads,meta_ads,organic}_user vía Drizzle (getAdminDb), NO
// supabase.rpc()/PostgREST. Mismas funciones SQL, transporte portable a RDS/Neon.
//
// SEGURIDAD: el user_id y el email salen del TOKEN (verifyAuth), nunca del body.
// El body solo aporta datos no sensibles de routing/display (fuente, campaña, nombre).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({
  registrationSource: z.enum(['google_ads', 'meta_ads', 'organic']),
  campaignId: z.string().max(255).nullish(),
  userName: z.string().max(255).nullish(),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/auth/ensure-profile')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }

  const { registrationSource, campaignId } = parsed.data
  const userId = auth.userId
  const email = auth.email
  const name = parsed.data.userName || email?.split('@')[0] || null
  const db = getAdminDb()

  if (registrationSource === 'google_ads') {
    await db.execute(sql`SELECT create_google_ads_user(user_id => ${userId}::uuid, user_email => ${email}, user_name => ${name}, campaign_id => ${campaignId ?? null})`)
  } else if (registrationSource === 'meta_ads') {
    await db.execute(sql`SELECT create_meta_ads_user(user_id => ${userId}::uuid, user_email => ${email}, user_name => ${name})`)
  } else {
    await db.execute(sql`SELECT create_organic_user(user_id => ${userId}::uuid, user_email => ${email}, user_name => ${name})`)
  }

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/v2/auth/ensure-profile', _POST)
