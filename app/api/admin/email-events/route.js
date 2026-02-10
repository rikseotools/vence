// app/api/admin/email-events/route.js - Admin API with service_role access
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Create admin client with service_role key
const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '30'
    const daysAgo = new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString()
    
    console.log('🔑 Admin API: Using service_role to fetch email events')
    console.log('🔍 Time range:', timeRange, 'days, from:', daysAgo)
    
    // Get all email events with service_role (bypasses RLS)
    const { data: allEmailEvents, error: emailError } = await getSupabaseAdmin()
      .from('email_events')
      .select('*')
      .gte('created_at', daysAgo)
      .order('created_at', { ascending: false })

    if (emailError) {
      console.error('❌ Error fetching email events:', emailError)
      return NextResponse.json({ error: emailError.message }, { status: 500 })
    }

    console.log(`✅ Admin API: Retrieved ${allEmailEvents?.length || 0} email events`)

    // Get subscription count
    const { data: subscriptionCount, error: rpcError } = await getSupabaseAdmin()
      .rpc('get_subscription_count')

    if (rpcError) {
      console.warn('⚠️ Error getting subscription count:', rpcError)
    }

    // Return all data
    return NextResponse.json({
      events: allEmailEvents || [],
      subscriptionCount: subscriptionCount?.[0] || { suscritos: 0, no_suscritos: 0, total: 0 },
      totalEvents: allEmailEvents?.length || 0,
      timeRange,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Admin API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Verify admin access
export async function POST(request) {
  try {
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Check if user is admin using service_role
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