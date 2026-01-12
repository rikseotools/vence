// app/api/admin/sales-prediction/route.js
// API para predicciones de ventas con intervalos de confianza
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getServiceSupabase = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Wilson score interval para proporciones con muestras pequenas
function wilsonScoreInterval(successes, total, confidence = 0.95) {
  if (total === 0) return { lower: 0, upper: 0, center: 0 }

  // z-score para 95% confianza
  const z = confidence === 0.95 ? 1.96 : 1.645
  const p = successes / total
  const n = total

  const denominator = 1 + z * z / n
  const center = (p + z * z / (2 * n)) / denominator
  const margin = (z / denominator) * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))

  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    center: center
  }
}

// Probabilidad de al menos una venta en n intentos
function probabilityAtLeastOne(p, n) {
  if (p === 0 || n === 0) return 0
  return 1 - Math.pow(1 - p, n)
}

// Intentos necesarios para alcanzar una probabilidad objetivo
function trialsForProbability(p, targetProb) {
  if (p === 0) return Infinity
  return Math.ceil(Math.log(1 - targetProb) / Math.log(1 - p))
}

export async function GET() {
  try {
    const supabase = getServiceSupabase()

    // 1. Obtener todos los usuarios con su fecha de registro
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, created_at, plan_type')

    if (usersError) throw usersError

    // 2. Obtener todos los eventos de pago (incluyendo importe)
    const { data: payments, error: paymentsError } = await supabase
      .from('conversion_events')
      .select('user_id, created_at, event_data')
      .eq('event_type', 'payment_completed')
      .order('created_at', { ascending: false })

    if (paymentsError) throw paymentsError

    // Calcular ticket medio
    const paymentAmounts = payments.map(p => p.event_data?.amount || 0).filter(a => a > 0)
    const totalRevenue = paymentAmounts.reduce((a, b) => a + b, 0)
    const avgTicket = paymentAmounts.length > 0 ? totalRevenue / paymentAmounts.length : 0

    const now = new Date()

    // 3. Calcular tasa de conversion REAL (usuarios únicos que han pagado)
    const payingUserIds = new Set(payments.map(p => p.user_id))
    const totalUsers = users.length
    const uniquePayingUsers = payingUserIds.size  // Usuarios únicos, no pagos totales

    // Tasa de conversion real (usuarios únicos / total usuarios)
    const conversionRate = totalUsers > 0 ? uniquePayingUsers / totalUsers : 0

    // Intervalo de confianza Wilson para la tasa
    const conversionCI = wilsonScoreInterval(uniquePayingUsers, totalUsers)

    // 3b. ALTERNATIVA: Conversión basada en usuarios activos (última semana)
    const sevenDaysAgoISO = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgoISO = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Obtener usuarios activos (han respondido preguntas en los últimos 7 días)
    const { data: weeklyActiveData, error: weeklyError } = await supabase
      .from('detailed_answers')
      .select('user_id')
      .gte('created_at', sevenDaysAgoISO)

    const weeklyActiveUsers = new Set(weeklyActiveData?.map(a => a.user_id) || [])
    const weeklyActiveCount = weeklyActiveUsers.size

    // Usuarios activos en último mes
    const { data: monthlyActiveData } = await supabase
      .from('detailed_answers')
      .select('user_id')
      .gte('created_at', thirtyDaysAgoISO)

    const monthlyActiveUsers = new Set(monthlyActiveData?.map(a => a.user_id) || [])
    const monthlyActiveCount = monthlyActiveUsers.size

    // Pagos en última semana y último mes
    const weeklyPayments = payments.filter(p => new Date(p.created_at) >= new Date(sevenDaysAgoISO))
    const monthlyPayments = payments.filter(p => new Date(p.created_at) >= new Date(thirtyDaysAgoISO))

    const weeklyPayingUsers = new Set(weeklyPayments.map(p => p.user_id))
    const monthlyPayingUsers = new Set(monthlyPayments.map(p => p.user_id))

    // Conversión alternativa: pagadores de la semana / activos de la semana
    const weeklyConversionRate = weeklyActiveCount > 0
      ? weeklyPayingUsers.size / weeklyActiveCount
      : 0

    const monthlyConversionRate = monthlyActiveCount > 0
      ? monthlyPayingUsers.size / monthlyActiveCount
      : 0

    // Wilson para conversión semanal
    const weeklyConversionCI = wilsonScoreInterval(weeklyPayingUsers.size, weeklyActiveCount)
    const monthlyConversionCI = wilsonScoreInterval(monthlyPayingUsers.size, monthlyActiveCount)

    // 3c. Análisis de tipo de conversión (inmediata vs después de probar)
    // Usuarios que pagaron el mismo día que se registraron
    const sameDayConversions = payments.filter(p => {
      const user = users.find(u => u.id === p.user_id)
      if (!user) return false
      const daysDiff = Math.round((new Date(p.created_at) - new Date(user.created_at)) / (1000 * 60 * 60 * 24))
      return daysDiff === 0
    })

    // Usuarios que probaron la plataforma antes de pagar (>= 1 día después de registro)
    const delayedConversions = payments.filter(p => {
      const user = users.find(u => u.id === p.user_id)
      if (!user) return false
      const daysDiff = Math.round((new Date(p.created_at) - new Date(user.created_at)) / (1000 * 60 * 60 * 24))
      return daysDiff >= 1
    })

    // De los usuarios activos esta semana, cuántos NO son premium (potenciales)
    const weeklyActiveFree = [...weeklyActiveUsers].filter(uid => {
      const user = users.find(u => u.id === uid)
      return user && user.plan_type !== 'premium' && user.plan_type !== 'legacy_free'
    })

    // 4. Calcular tiempo promedio hasta conversion
    let avgDaysToConvert = 0
    let conversionTimes = []
    for (const payment of payments) {
      const user = users.find(u => u.id === payment.user_id)
      if (user) {
        const days = Math.round((new Date(payment.created_at) - new Date(user.created_at)) / (1000 * 60 * 60 * 24))
        conversionTimes.push(days)
      }
    }
    if (conversionTimes.length > 0) {
      avgDaysToConvert = conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length
    }

    // 5. Pool de usuarios que pueden convertir (todos los que no han pagado)
    const lastPayment = payments[0]
    const lastPaymentDate = lastPayment ? new Date(lastPayment.created_at) : null

    const nonPayingUsers = users.filter(u => !payingUserIds.has(u.id))

    // Clasificar por antiguedad
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)

    const newUsers = nonPayingUsers.filter(u => new Date(u.created_at) >= sevenDaysAgo)
    const activeUsers = nonPayingUsers.filter(u => {
      const created = new Date(u.created_at)
      return created < sevenDaysAgo && created >= thirtyDaysAgo
    })
    const dormantUsers = nonPayingUsers.filter(u => new Date(u.created_at) < thirtyDaysAgo)

    // Probabilidad usando la tasa de conversion real
    const p = conversionRate
    const n = nonPayingUsers.length

    // Probabilidad actual de al menos 1 venta del pool
    const currentProbability = probabilityAtLeastOne(p, n)

    // Probabilidad con intervalo de confianza
    const probWithLowerCI = probabilityAtLeastOne(conversionCI.lower, n)
    const probWithUpperCI = probabilityAtLeastOne(conversionCI.upper, n)

    // 6. Estimacion de dias hasta proxima venta
    const recentRegistrations = users.filter(u => new Date(u.created_at) > sevenDaysAgo)
    const dailyRegistrationRate = recentRegistrations.length / 7

    // Registros necesarios para diferentes probabilidades
    const registrationsFor50 = trialsForProbability(p, 0.5)
    const registrationsFor75 = trialsForProbability(p, 0.75)
    const registrationsFor90 = trialsForProbability(p, 0.90)

    // Dias estimados basado en promedio historico entre pagos
    const additionalNeeded = Math.max(0, registrationsFor50 - n)
    const daysUntil50 = dailyRegistrationRate > 0
      ? Math.ceil(additionalNeeded / dailyRegistrationRate)
      : null

    // 7. Tendencia historica
    const paymentDates = payments.map(p => new Date(p.created_at)).sort((a, b) => a - b)
    const daysBetweenPayments = []
    for (let i = 1; i < paymentDates.length; i++) {
      const days = (paymentDates[i] - paymentDates[i - 1]) / (1000 * 60 * 60 * 24)
      daysBetweenPayments.push(days)
    }
    const avgDaysBetweenPayments = daysBetweenPayments.length > 0
      ? daysBetweenPayments.reduce((a, b) => a + b, 0) / daysBetweenPayments.length
      : null

    // Dias desde ultimo pago
    const daysSinceLastPayment = lastPaymentDate
      ? (now - lastPaymentDate) / (1000 * 60 * 60 * 24)
      : null

    // 8. MRR y previsión de renovaciones
    const { data: subscriptions, error: subsError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('status', 'active')

    if (subsError) throw subsError

    // Precios por plan (solo mensual y semestral)
    const PRICES = {
      premium_semester: 59,   // 6 meses
      premium_monthly: 20     // mensual
    }

    // Calcular MRR (ingresos recurrentes mensualizados)
    let mrr = 0
    const activeSubscriptions = subscriptions || []

    activeSubscriptions.forEach(sub => {
      if (sub.plan_type === 'premium_monthly') {
        mrr += PRICES.premium_monthly       // 20€/mes
      } else {
        // Semestral o fallback por duración del periodo
        const start = new Date(sub.current_period_start)
        const end = new Date(sub.current_period_end)
        const days = (end - start) / (1000 * 60 * 60 * 24)
        if (days <= 35) {
          mrr += PRICES.premium_monthly     // ~1 mes = mensual
        } else {
          mrr += PRICES.premium_semester / 6 // 6 meses = semestral (9.83€/mes)
        }
      }
    })

    // Proyección de renovaciones por mes (próximos 12 meses)
    const renewalProjection = []
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0)

      let renewalsInMonth = 0
      let revenueInMonth = 0
      const renewingUsers = []

      activeSubscriptions.forEach(sub => {
        if (!sub.cancel_at_period_end) {
          const renewDate = new Date(sub.current_period_end)
          if (renewDate >= monthStart && renewDate <= monthEnd) {
            renewalsInMonth++
            const price = PRICES[sub.plan_type] || PRICES.premium_semester
            revenueInMonth += price
            renewingUsers.push({
              userId: sub.user_id,
              renewDate: sub.current_period_end,
              amount: price
            })
          }
        }
      })

      renewalProjection.push({
        month: monthStart.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
        monthIndex: i,
        renewals: renewalsInMonth,
        revenue: revenueInMonth,
        users: renewingUsers
      })
    }

    // ========================================
    // 3 MÉTODOS DE PROYECCIÓN DE VENTAS
    // ========================================

    // MÉTODO 1: Por registros (largo plazo)
    // Fórmula: Registros/día × Tasa conversión global
    const method1_salesPerDay = dailyRegistrationRate * conversionRate
    const method1_salesPerMonth = method1_salesPerDay * 30

    // MÉTODO 2: Por usuarios activos (corto plazo)
    // Fórmula: Usuarios FREE activos × Tasa conversión semanal
    const method2_salesPerMonth = weeklyActiveFree.length * weeklyConversionRate * 4 // 4 semanas

    // MÉTODO 3: Por histórico (tendencia real)
    // Fórmula: 30 / Días promedio entre pagos
    const method3_salesPerMonth = avgDaysBetweenPayments
      ? 30 / avgDaysBetweenPayments
      : 0

    // Proyección combinada (promedio de los 3 métodos con datos válidos)
    const validMethods = [method1_salesPerMonth, method2_salesPerMonth, method3_salesPerMonth].filter(m => m > 0 && isFinite(m))
    const combinedSalesPerMonth = validMethods.length > 0
      ? validMethods.reduce((a, b) => a + b, 0) / validMethods.length
      : 0

    // Usar método 1 por defecto para compatibilidad
    const expectedSalesPerDay = method1_salesPerDay
    const expectedSalesPerMonth = method1_salesPerMonth

    // MRR por nueva suscripción (promedio ponderado)
    // Semestral: 59€/6 = 9.83€/mes, Mensual: 20€/mes
    const mrrPerNewSub = avgTicket > 30 ? avgTicket / 6 : avgTicket // Si ticket > 30, es semestral

    // Proyección de MRR (asumiendo 0% churn por ahora)
    const newSubsIn6Months = expectedSalesPerMonth * 6
    const newSubsIn12Months = expectedSalesPerMonth * 12

    const mrr6Months = mrr + (newSubsIn6Months * mrrPerNewSub)
    const mrr12Months = mrr + (newSubsIn12Months * mrrPerNewSub)

    // ARR proyectado
    const arr = mrr * 12
    const arr6Months = mrr6Months * 12
    const arr12Months = mrr12Months * 12

    // Facturación total (para referencia)
    const billing6Months = renewalProjection.slice(0, 6).reduce((acc, m) => acc + m.revenue, 0) +
                           (expectedSalesPerMonth * avgTicket * 6)
    const billing12Months = renewalProjection.reduce((acc, m) => acc + m.revenue, 0) +
                            (expectedSalesPerMonth * avgTicket * 12)

    // Churn info
    const cancelingSubscriptions = (subscriptions || []).filter(s => s.cancel_at_period_end)

    return NextResponse.json({
      // Tasa de conversion global (usuarios únicos / total registros)
      conversion: {
        totalUsers,
        uniquePayingUsers,
        totalPayments: payments.length,  // Para referencia: pagos totales incluyendo renovaciones
        rate: conversionRate,
        confidenceInterval: {
          lower: conversionCI.lower,
          upper: conversionCI.upper,
          confidence: 0.95
        },
        avgDaysToConvert: Math.round(avgDaysToConvert),
        conversionTimes: conversionTimes.sort((a, b) => a - b)
      },

      // Conversión alternativa basada en usuarios activos
      conversionByActivity: {
        // Última semana
        weekly: {
          activeUsers: weeklyActiveCount,
          activeFreeUsers: weeklyActiveFree.length,  // Potenciales clientes
          payingUsers: weeklyPayingUsers.size,
          rate: weeklyConversionRate,
          confidenceInterval: {
            lower: weeklyConversionCI.lower,
            upper: weeklyConversionCI.upper
          }
        },
        // Último mes
        monthly: {
          activeUsers: monthlyActiveCount,
          payingUsers: monthlyPayingUsers.size,
          rate: monthlyConversionRate,
          confidenceInterval: {
            lower: monthlyConversionCI.lower,
            upper: monthlyConversionCI.upper
          }
        },
        // Análisis de tipo de conversión
        conversionType: {
          sameDay: sameDayConversions.length,      // Pagaron día 0 (decisión inmediata)
          afterTrying: delayedConversions.length,  // Probaron antes de pagar
          sameDayPercent: payments.length > 0
            ? Math.round((sameDayConversions.length / payments.length) * 100)
            : 0
        }
      },

      // Ingresos
      revenue: {
        totalRevenue,
        avgTicket,
        payments: paymentAmounts
      },

      // Estado actual
      current: {
        totalUsers,
        totalPayments: payments.length,
        daysSinceLastPayment: daysSinceLastPayment ? Math.round(daysSinceLastPayment) : null,
        lastPaymentDate: lastPaymentDate?.toISOString() || null,
        // Pool de usuarios sin pagar por categoria
        pool: {
          total: nonPayingUsers.length,
          new: newUsers.length,        // ultimos 7 dias
          active: activeUsers.length,   // 7-30 dias
          dormant: dormantUsers.length  // 30+ dias
        }
      },

      // Prediccion
      prediction: {
        probability: currentProbability,
        probabilityCI: {
          lower: probWithLowerCI,
          upper: probWithUpperCI
        },
        registrationsFor50,
        registrationsFor75,
        registrationsFor90,
        daysUntil50Estimate: daysUntil50,
        dailyRegistrationRate: Math.round(dailyRegistrationRate * 10) / 10
      },

      // 3 Métodos de proyección de ventas
      projectionMethods: {
        // Método 1: Por registros (largo plazo)
        byRegistrations: {
          name: 'Por registros',
          description: 'Registros/día × Tasa conversión global',
          salesPerMonth: Math.round(method1_salesPerMonth * 100) / 100,
          revenuePerMonth: Math.round(method1_salesPerMonth * avgTicket * 100) / 100,
          inputs: {
            dailyRegistrations: Math.round(dailyRegistrationRate * 10) / 10,
            conversionRate: Math.round(conversionRate * 10000) / 100 // %
          },
          bestFor: 'Proyección a largo plazo'
        },
        // Método 2: Por usuarios activos (corto plazo)
        byActiveUsers: {
          name: 'Por activos',
          description: 'Usuarios FREE activos × Tasa conversión semanal × 4',
          salesPerMonth: Math.round(method2_salesPerMonth * 100) / 100,
          revenuePerMonth: Math.round(method2_salesPerMonth * avgTicket * 100) / 100,
          inputs: {
            activeFreeUsers: weeklyActiveFree.length,
            weeklyConversionRate: Math.round(weeklyConversionRate * 10000) / 100 // %
          },
          bestFor: 'Proyección a corto plazo (próximas semanas)'
        },
        // Método 3: Por histórico (tendencia real)
        byHistoric: {
          name: 'Por histórico',
          description: '30 / Días promedio entre pagos',
          salesPerMonth: Math.round(method3_salesPerMonth * 100) / 100,
          revenuePerMonth: Math.round(method3_salesPerMonth * avgTicket * 100) / 100,
          inputs: {
            avgDaysBetweenPayments: avgDaysBetweenPayments ? Math.round(avgDaysBetweenPayments * 10) / 10 : null
          },
          bestFor: 'Basado en tendencia real de pagos'
        },
        // Promedio de los 3 métodos
        combined: {
          name: 'Combinado',
          description: 'Promedio de los métodos válidos',
          salesPerMonth: Math.round(combinedSalesPerMonth * 100) / 100,
          revenuePerMonth: Math.round(combinedSalesPerMonth * avgTicket * 100) / 100,
          methodsUsed: validMethods.length
        }
      },

      // Tendencia
      trend: {
        avgDaysBetweenPayments: avgDaysBetweenPayments ? Math.round(avgDaysBetweenPayments) : null,
        paymentHistory: payments.slice(0, 10).map(p => ({
          date: p.created_at,
          userId: p.user_id
        }))
      },

      // Calidad de la prediccion (mejora con mas datos)
      quality: {
        sampleSize: payments.length,
        confidenceWidth: conversionCI.upper - conversionCI.lower,
        reliability: payments.length >= 20 ? 'alta' : payments.length >= 10 ? 'media' : 'baja',
        message: payments.length < 10
          ? `Con ${payments.length} ventas, las predicciones tienen alta varianza. Se necesitan ~20 ventas para predicciones fiables.`
          : payments.length < 20
          ? `Con ${payments.length} ventas, las predicciones son aproximadas. Mejoraran con mas datos.`
          : `Con ${payments.length} ventas, las predicciones son estadisticamente fiables.`
      },

      // MRR y proyecciones
      mrr: {
        current: Math.round(mrr * 100) / 100,  // MRR actual
        in6Months: Math.round(mrr6Months * 100) / 100,  // MRR proyectado 6 meses
        in12Months: Math.round(mrr12Months * 100) / 100, // MRR proyectado 12 meses
        arr: Math.round(arr * 100) / 100,       // ARR actual
        arrIn6Months: Math.round(arr6Months * 100) / 100,
        arrIn12Months: Math.round(arr12Months * 100) / 100,
        activeSubscriptions: activeSubscriptions.length,
        cancelingSubscriptions: cancelingSubscriptions.length,
        mrrPerNewSub: Math.round(mrrPerNewSub * 100) / 100, // MRR que añade cada nueva suscripción
        newSubsPerMonth: Math.round(expectedSalesPerMonth * 100) / 100,
        byPlan: {
          semester: activeSubscriptions.filter(s => s.plan_type === 'premium_semester').length,
          monthly: activeSubscriptions.filter(s => s.plan_type === 'premium_monthly').length
        }
      },

      // Calendario de renovaciones
      renewals: {
        next6Months: renewalProjection.slice(0, 6).reduce((acc, m) => acc + m.revenue, 0),
        next12Months: renewalProjection.reduce((acc, m) => acc + m.revenue, 0),
        byMonth: renewalProjection
      },

      // Facturación total (para referencia)
      billing: {
        next6Months: Math.round(billing6Months * 100) / 100,
        next12Months: Math.round(billing12Months * 100) / 100
      }
    })

  } catch (error) {
    console.error('Error in sales-prediction:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
