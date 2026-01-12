// app/api/admin/conversion-stats/route.js
// API para obtener estadísticas de conversión (usa service role para bypasear RLS)
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
    const days = parseInt(searchParams.get('days') || '7')

    const supabase = getServiceSupabase()

    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - days)
    const daysAgoISO = daysAgo.toISOString()

    // 1. Registros del periodo
    const { data: registrations, error: regError } = await supabase
      .from('user_profiles')
      .select('id, registration_source, created_at')
      .gte('created_at', daysAgoISO)

    if (regError) throw regError

    // 1b. Total de usuarios (historico)
    const { count: totalUsersAllTime, error: totalError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    if (totalError) throw totalError

    // 2. Primer test completado del periodo
    const { data: firstTests, error: testError } = await supabase
      .from('user_profiles')
      .select('id')
      .not('first_test_completed_at', 'is', null)
      .gte('first_test_completed_at', daysAgoISO)

    if (testError) throw testError

    // 3. Eventos de conversión del periodo
    const { data: events, error: eventsError } = await supabase
      .from('conversion_events')
      .select('*')
      .gte('created_at', daysAgoISO)
      .order('created_at', { ascending: false })

    if (eventsError) throw eventsError

    // 4. Agrupar registros por fuente
    const bySource = {}
    ;(registrations || []).forEach(user => {
      const source = user.registration_source || 'organic'
      bySource[source] = (bySource[source] || 0) + 1
    })

    // 5. Agrupar eventos por tipo
    const eventCounts = {}
    ;(events || []).forEach(event => {
      eventCounts[event.event_type] = (eventCounts[event.event_type] || 0) + 1
    })

    // 6. Agrupar eventos por día
    const dailyStats = {}
    ;(events || []).forEach(event => {
      const day = new Date(event.created_at).toLocaleDateString('es-ES')
      if (!dailyStats[day]) dailyStats[day] = {}
      if (!dailyStats[day][event.event_type]) dailyStats[day][event.event_type] = 0
      dailyStats[day][event.event_type]++
    })

    // Convertir dailyStats a array ordenado
    const dailyArray = Object.entries(dailyStats)
      .map(([date, events]) => ({ date, ...events }))
      .sort((a, b) => new Date(b.date) - new Date(a.date))

    return NextResponse.json({
      registrations: {
        total: registrations?.length || 0,
        totalAllTime: totalUsersAllTime || 0,
        bySource,
        firstTestCompleted: firstTests?.length || 0
      },
      events: events || [],
      eventCounts,
      dailyStats: dailyArray,
      period: {
        days,
        from: daysAgoISO,
        to: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error in conversion-stats:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
