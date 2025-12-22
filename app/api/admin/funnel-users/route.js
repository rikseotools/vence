// app/api/admin/funnel-users/route.js
// API para obtener usuarios en cada etapa del funnel
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getServiceSupabase = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const stage = searchParams.get('stage')
    const days = parseInt(searchParams.get('days') || '7')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!stage) {
      return NextResponse.json({ error: 'stage parameter required' }, { status: 400 })
    }

    const supabase = getServiceSupabase()

    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - days)
    const daysAgoISO = daysAgo.toISOString()

    let users = []
    let query

    switch (stage) {
      case 'registrations':
        // Usuarios registrados en el periodo
        const { data: regUsers, error: regError } = await supabase
          .from('user_profiles')
          .select('id, email, full_name, plan_type, registration_source, created_at')
          .gte('created_at', daysAgoISO)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (regError) throw regError
        users = regUsers || []
        break

      case 'completed_first_test':
        // Usuarios que completaron su primer test
        const { data: testUsers, error: testError } = await supabase
          .from('user_profiles')
          .select('id, email, full_name, plan_type, registration_source, created_at, first_test_completed_at')
          .not('first_test_completed_at', 'is', null)
          .gte('first_test_completed_at', daysAgoISO)
          .order('first_test_completed_at', { ascending: false })
          .limit(limit)

        if (testError) throw testError
        users = testUsers || []
        break

      case 'hit_limit':
        // Usuarios que alcanzaron el limite
        users = await getUsersByEvent(supabase, 'limit_reached', daysAgoISO, limit)
        break

      case 'saw_modal':
        // Usuarios que vieron el modal de upgrade
        users = await getUsersByEvent(supabase, 'upgrade_modal_viewed', daysAgoISO, limit)
        break

      case 'clicked_upgrade':
        // Usuarios que hicieron clic en upgrade
        users = await getUsersByEvent(supabase, ['upgrade_button_clicked', 'upgrade_banner_clicked'], daysAgoISO, limit)
        break

      case 'visited_premium':
        // Usuarios que visitaron /premium
        users = await getUsersByEvent(supabase, 'premium_page_viewed', daysAgoISO, limit)
        break

      case 'started_checkout':
        // Usuarios que iniciaron checkout
        users = await getUsersByEvent(supabase, 'checkout_started', daysAgoISO, limit)
        break

      case 'paid':
        // Usuarios que pagaron
        users = await getUsersByEvent(supabase, 'payment_completed', daysAgoISO, limit)
        break

      default:
        return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
    }

    return NextResponse.json({
      stage,
      count: users.length,
      users,
      period: { days, from: daysAgoISO }
    })

  } catch (error) {
    console.error('Error in funnel-users:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// Helper para obtener usuarios por tipo de evento
async function getUsersByEvent(supabase, eventType, daysAgoISO, limit) {
  // Obtener user_ids unicos con ese evento
  const eventTypes = Array.isArray(eventType) ? eventType : [eventType]

  const { data: events, error: eventError } = await supabase
    .from('conversion_events')
    .select('user_id, event_type, created_at')
    .in('event_type', eventTypes)
    .gte('created_at', daysAgoISO)
    .order('created_at', { ascending: false })

  if (eventError) throw eventError

  // Obtener user_ids unicos
  const userIds = [...new Set((events || []).map(e => e.user_id))]

  if (userIds.length === 0) return []

  // Obtener perfiles de esos usuarios
  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, plan_type, registration_source, created_at')
    .in('id', userIds.slice(0, limit))

  if (profileError) throw profileError

  // Combinar con fecha del evento
  const profileMap = {}
  ;(profiles || []).forEach(p => { profileMap[p.id] = p })

  // Agrupar eventos por usuario (tomar el mas reciente)
  const eventsByUser = {}
  ;(events || []).forEach(e => {
    if (!eventsByUser[e.user_id]) {
      eventsByUser[e.user_id] = e
    }
  })

  return Object.keys(eventsByUser)
    .slice(0, limit)
    .map(userId => ({
      ...profileMap[userId],
      event_at: eventsByUser[userId].created_at,
      event_type: eventsByUser[userId].event_type
    }))
    .filter(u => u.email) // Solo usuarios con perfil
}
