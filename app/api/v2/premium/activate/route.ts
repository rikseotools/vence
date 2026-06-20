// app/api/v2/premium/activate/route.ts
// Activa premium tras el pago (liga el stripe_customer_id y sube el plan).
//
// AGNÓSTICO (Fase A2): invoca la función plpgsql activate_premium_user vía
// Drizzle, NO supabase.rpc(). El user_id sale del TOKEN (verifyAuth), no del body.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({
  stripeCustomerId: z.string().min(1).max(255),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/premium/activate')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }

  const db = getAdminDb()
  await db.execute(sql`SELECT activate_premium_user(user_id => ${auth.userId}::uuid, stripe_customer_id => ${parsed.data.stripeCustomerId})`)

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/v2/premium/activate', _POST)
