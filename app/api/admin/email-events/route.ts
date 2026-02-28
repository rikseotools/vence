// app/api/admin/email-events/route.ts - Admin API for email events
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getEmailEvents } from '@/lib/api/admin-email-events'
import { emailEventsQuerySchema } from '@/lib/api/admin-email-events'

// Supabase admin client — para RPC calls (POST + subscriptionCount en GET)
const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
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

// Verify admin access — se mantiene con Supabase RPC (no migrable a Drizzle)
export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const { data: isAdmin, error } = await getSupabaseAdmin()
      .rpc('is_user_admin', { check_user_id: userId })

    if (error) {
      console.error('❌ Error checking admin status:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ isAdmin: isAdmin === true })
  } catch (error) {
    console.error('❌ Admin verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
