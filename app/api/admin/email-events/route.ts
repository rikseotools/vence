// app/api/admin/email-events/route.ts - Admin API for email events
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getEmailEvents } from '@/lib/api/admin-email-events'
import { emailEventsQuerySchema } from '@/lib/api/admin-email-events'
import { requireAdmin } from '@/lib/api/shared/auth'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
// Supabase admin client — para RPC calls (POST + subscriptionCount en GET)
const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const parsed = emailEventsQuerySchema.safeParse({
      timeRange: searchParams.get('timeRange') ?? undefined,
    })

    const timeRange = parsed.success ? parsed.data.timeRange : 30

    const [events, subscriptionResult] = await Promise.all([
      getEmailEvents(timeRange),
      getSupabaseAdmin().rpc('get_subscription_count').then(r => r),
    ])

    if (subscriptionResult.error) {
      console.warn('⚠️ Error getting subscription count:', subscriptionResult.error)
    }

    return NextResponse.json({
      events,
      subscriptionCount: subscriptionResult.data?.[0] ?? { suscritos: 0, no_suscritos: 0, total: 0 },
      totalEvents: events.length,
      timeRange: String(timeRange),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ [API/admin/email-events] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// (POST eliminado 2026-06-20: handler muerto —0 callers— que usaba la RPC
//  is_user_admin/auth.uid(), no portable. El único uso del endpoint es el GET.)

export const GET = withErrorLogging('/api/admin/email-events', _GET)
