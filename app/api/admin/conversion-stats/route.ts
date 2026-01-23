// app/api/admin/conversion-stats/route.ts
// API para obtener estadísticas de conversión - OPTIMIZADA
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface RegistrationStats {
  total: number
  totalAllTime: number
  bySource: Record<string, number>
  firstTestCompleted: number
  activeUsers: number
  activationRate: number
}

interface ActiveUserMetrics {
  // Período seleccionado
  dauTotal: number
  dauFree: number
  dauPremium: number
  monetizationRate: number // Premium / Total
  paidInPeriod: number // Pagos en el período
  freeToPayRate: number // paidInPeriod / dauFree
  // Referencia fija 7 días
  dau7Days: number
  dau7DaysFree: number
  dau7DaysPremium: number
  monetizationRate7Days: number
  paidIn7Days: number // Pagos últimos 7 días
  freeToPayRate7Days: number // paidIn7Days / dau7DaysFree
}

const getServiceSupabase = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')

    const supabase = getServiceSupabase()

    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - days)
    const daysAgoISO = daysAgo.toISOString()

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoISO = sevenDaysAgo.toISOString()

    // Ejecutar queries en paralelo para máxima velocidad
    const [
      registrationsResult,
      totalUsersResult,
      firstTestsResult,
      eventsResult,
      dauPeriodResult,
      dau7Result,
      activeFromRegResult,
      paidPeriodResult,
      paid7DaysResult,
      refundsPeriodResult,
      refunds7DaysResult
    ] = await Promise.all([
      // 1. Registros del periodo
      supabase
        .from('user_profiles')
        .select('id, registration_source, created_at')
        .gte('created_at', daysAgoISO),

      // 2. Total usuarios histórico
      supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true }),

      // 3. Primer test completado
      supabase
        .from('user_profiles')
        .select('id')
        .not('first_test_completed_at', 'is', null)
        .gte('first_test_completed_at', daysAgoISO),

      // 4. Eventos de conversión
      supabase
        .from('conversion_events')
        .select('*')
        .gte('created_at', daysAgoISO)
        .order('created_at', { ascending: false }),

      // 5. DAU período: usuarios únicos con tests
      supabase
        .from('tests')
        .select('user_id')
        .gte('created_at', daysAgoISO),

      // 6. DAU 7 días
      supabase
        .from('tests')
        .select('user_id')
        .gte('created_at', sevenDaysAgoISO),

      // 7. Registros activos (tienen tests)
      supabase
        .from('tests')
        .select('user_id, user_profiles!inner(created_at)')
        .gte('user_profiles.created_at', daysAgoISO),

      // 8. Pagos del período (payment_completed events)
      supabase
        .from('conversion_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'payment_completed')
        .gte('created_at', daysAgoISO),

      // 9. Pagos últimos 7 días (fijo)
      supabase
        .from('conversion_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'payment_completed')
        .gte('created_at', sevenDaysAgoISO),

      // 10. Refunds del período (de cancellation_feedback con stripe_refund_id)
      supabase
        .from('cancellation_feedback')
        .select('id, refund_amount_cents', { count: 'exact' })
        .not('stripe_refund_id', 'is', null)
        .gte('created_at', daysAgoISO),

      // 11. Refunds últimos 7 días (fijo)
      supabase
        .from('cancellation_feedback')
        .select('id, refund_amount_cents', { count: 'exact' })
        .not('stripe_refund_id', 'is', null)
        .gte('created_at', sevenDaysAgoISO)
    ])

    const registrations = registrationsResult.data || []
    const totalUsersAllTime = (totalUsersResult as any).count || 0
    const firstTests = firstTestsResult.data || []
    const events = eventsResult.data || []
    const paidInPeriod = (paidPeriodResult as any).count || 0
    const paidIn7Days = (paid7DaysResult as any).count || 0

    // Refunds
    const refundsInPeriod = (refundsPeriodResult as any).count || 0
    const refundsIn7Days = (refunds7DaysResult as any).count || 0
    const refundsPeriodData = refundsPeriodResult.data || []
    const refunds7DaysData = refunds7DaysResult.data || []

    // Calcular monto total de refunds
    const refundAmountPeriod = refundsPeriodData.reduce((sum: number, r: any) => sum + (r.refund_amount_cents || 0), 0)
    const refundAmount7Days = refunds7DaysData.reduce((sum: number, r: any) => sum + (r.refund_amount_cents || 0), 0)

    // Pagos netos (brutos - refunds)
    const paidNetInPeriod = Math.max(0, paidInPeriod - refundsInPeriod)
    const paidNetIn7Days = Math.max(0, paidIn7Days - refundsIn7Days)

    // Calcular DAU únicos
    const dauPeriodUserIds = [...new Set((dauPeriodResult.data || []).map(t => t.user_id))]
    const dau7UserIds = [...new Set((dau7Result.data || []).map(t => t.user_id))]
    const activeRegUsers = new Set((activeFromRegResult.data || []).map(t => t.user_id))

    const dauTotal = dauPeriodUserIds.length
    const dau7Days = dau7UserIds.length
    const activeUsersFromRegistrations = activeRegUsers.size

    // Obtener plan_type de usuarios activos para calcular free vs premium
    let dauFree = 0, dauPremium = 0
    let dau7DaysFree = 0, dau7DaysPremium = 0

    if (dauPeriodUserIds.length > 0) {
      const { data: planData } = await supabase
        .from('user_profiles')
        .select('id, plan_type')
        .in('id', dauPeriodUserIds.slice(0, 1000))

      if (planData) {
        dauPremium = planData.filter(u => u.plan_type === 'premium').length
        dauFree = planData.filter(u => u.plan_type !== 'premium').length
      }
    }

    if (dau7UserIds.length > 0) {
      const { data: plan7Data } = await supabase
        .from('user_profiles')
        .select('id, plan_type')
        .in('id', dau7UserIds.slice(0, 1000))

      if (plan7Data) {
        dau7DaysPremium = plan7Data.filter(u => u.plan_type === 'premium').length
        dau7DaysFree = plan7Data.filter(u => u.plan_type !== 'premium').length
      }
    }

    // Agrupar por fuente
    const bySource: Record<string, number> = {}
    registrations.forEach(user => {
      const source = user.registration_source || 'organic'
      bySource[source] = (bySource[source] || 0) + 1
    })

    // Agrupar eventos por tipo
    const eventCounts: Record<string, number> = {}
    events.forEach(event => {
      eventCounts[event.event_type] = (eventCounts[event.event_type] || 0) + 1
    })

    // Agrupar por día
    const dailyStats: Record<string, Record<string, number>> = {}
    events.forEach(event => {
      const day = new Date(event.created_at).toLocaleDateString('es-ES')
      if (!dailyStats[day]) dailyStats[day] = {}
      if (!dailyStats[day][event.event_type]) dailyStats[day][event.event_type] = 0
      dailyStats[day][event.event_type]++
    })

    const dailyArray = Object.entries(dailyStats)
      .map(([date, evts]) => ({ date, ...evts }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Calcular tasas
    const activationRate = registrations.length > 0
      ? (activeUsersFromRegistrations / registrations.length) * 100
      : 0
    const monetizationRate = dauTotal > 0 ? (dauPremium / dauTotal) * 100 : 0
    const monetizationRate7Days = dau7Days > 0 ? (dau7DaysPremium / dau7Days) * 100 : 0

    // Tasa de conversión DAU Free → Pago (usando pagos NETOS)
    const freeToPayRate = dauFree > 0 ? (paidNetInPeriod / dauFree) * 100 : 0
    const freeToPayRate7Days = dau7DaysFree > 0 ? (paidNetIn7Days / dau7DaysFree) * 100 : 0

    return NextResponse.json({
      registrations: {
        total: registrations.length,
        totalAllTime: totalUsersAllTime,
        bySource,
        firstTestCompleted: firstTests.length,
        activeUsers: activeUsersFromRegistrations,
        activationRate: Math.round(activationRate * 10) / 10
      },
      activeUserMetrics: {
        // Período seleccionado
        dauTotal,
        dauFree,
        dauPremium,
        monetizationRate: Math.round(monetizationRate * 10) / 10,
        paidInPeriod,        // Pagos brutos
        refundsInPeriod,     // Refunds
        paidNetInPeriod,     // Pagos netos (brutos - refunds)
        refundAmountPeriod,  // Monto devuelto en centavos
        freeToPayRate: Math.round(freeToPayRate * 10) / 10,
        // Referencia fija 7 días
        dau7Days,
        dau7DaysFree,
        dau7DaysPremium,
        monetizationRate7Days: Math.round(monetizationRate7Days * 10) / 10,
        paidIn7Days,         // Pagos brutos 7 días
        refundsIn7Days,      // Refunds 7 días
        paidNetIn7Days,      // Pagos netos 7 días
        refundAmount7Days,   // Monto devuelto 7 días en centavos
        freeToPayRate7Days: Math.round(freeToPayRate7Days * 10) / 10
      },
      events,
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
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
