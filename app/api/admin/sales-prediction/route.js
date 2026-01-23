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

// Guardar predicciones del día (para tracking de precisión)
async function saveDailyPredictions(supabase, predictions) {
  try {
    const today = new Date().toISOString().slice(0, 10)

    // Preparar datos para insertar
    const records = [
      {
        prediction_date: today,
        method_name: 'by_registrations',
        predicted_sales_per_month: predictions.byRegistrations.salesPerMonth,
        predicted_revenue_per_month: predictions.byRegistrations.revenuePerMonth,
        prediction_inputs: predictions.byRegistrations.inputs
      },
      {
        prediction_date: today,
        method_name: 'by_active_users',
        predicted_sales_per_month: predictions.byActiveUsers.salesPerMonth,
        predicted_revenue_per_month: predictions.byActiveUsers.revenuePerMonth,
        prediction_inputs: predictions.byActiveUsers.inputs
      },
      {
        prediction_date: today,
        method_name: 'by_historic',
        predicted_sales_per_month: predictions.byHistoric.salesPerMonth,
        predicted_revenue_per_month: predictions.byHistoric.revenuePerMonth,
        prediction_inputs: predictions.byHistoric.inputs
      },
      {
        prediction_date: today,
        method_name: 'combined',
        predicted_sales_per_month: predictions.combined.salesPerMonth,
        predicted_revenue_per_month: predictions.combined.revenuePerMonth,
        prediction_inputs: { methodsUsed: predictions.combined.methodsUsed }
      }
    ]

    // Upsert para evitar duplicados
    const { error } = await supabase
      .from('prediction_tracking')
      .upsert(records, { onConflict: 'prediction_date,method_name' })

    if (error) {
      console.log('Error guardando predicciones (tabla puede no existir):', error.message)
    }
  } catch (err) {
    console.log('Error en saveDailyPredictions:', err.message)
  }
}

// Obtener precisión histórica de predicciones
async function getPredictionAccuracy(supabase) {
  try {
    // Intentar obtener precisión por método
    const { data: accuracy, error } = await supabase
      .from('prediction_accuracy_by_method')
      .select('*')

    if (error) {
      // Vista no existe aún, retornar null
      return null
    }

    // Obtener últimas predicciones verificadas
    const { data: history } = await supabase
      .from('prediction_history')
      .select('*')
      .limit(10)

    return {
      byMethod: accuracy || [],
      recentHistory: history || [],
      hasData: (accuracy?.length || 0) > 0
    }
  } catch (err) {
    return null
  }
}

// Verificar predicciones de hace 3 días (comparar con realidad)
// Prorrateamos: si predijo 10 ventas/mes, en 3 días esperamos 10 * (3/30) = 1 venta
const VERIFICATION_DAYS = 3

async function verifyPastPredictions(supabase) {
  try {
    const targetDate = new Date(Date.now() - VERIFICATION_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)

    // Obtener ventas reales desde la fecha objetivo hasta hoy
    const { data: payments } = await supabase
      .from('conversion_events')
      .select('user_id, event_data')
      .eq('event_type', 'payment_completed')
      .gte('created_at', targetDate)
      .lt('created_at', today)

    const actualSales = new Set(payments?.map(p => p.user_id) || []).size
    const actualRevenue = payments?.reduce((sum, p) => sum + (p.event_data?.amount || 0), 0) || 0

    // Obtener predicciones sin verificar de esa fecha
    const { data: predictions } = await supabase
      .from('prediction_tracking')
      .select('*')
      .eq('prediction_date', targetDate)
      .is('verified_at', null)

    if (predictions && predictions.length > 0) {
      for (const pred of predictions) {
        // Prorratear la predicción mensual a 7 días
        const expectedSalesIn7Days = pred.predicted_sales_per_month * (VERIFICATION_DAYS / 30)

        let errorPercent = null
        let absoluteError = null

        if (expectedSalesIn7Days > 0) {
          // Comparar ventas reales vs esperadas (prorrateadas)
          errorPercent = ((actualSales - expectedSalesIn7Days) / expectedSalesIn7Days) * 100
          absoluteError = Math.abs(errorPercent)
        }

        await supabase
          .from('prediction_tracking')
          .update({
            actual_sales: actualSales,
            actual_revenue: actualRevenue,
            error_percent: errorPercent !== null ? Math.round(errorPercent * 100) / 100 : null,
            absolute_error: absoluteError !== null ? Math.round(absoluteError * 100) / 100 : null,
            verified_at: new Date().toISOString()
          })
          .eq('id', pred.id)
      }
    }

    return { verified: predictions?.length > 0, date: targetDate, actualSales, actualRevenue, days: VERIFICATION_DAYS }
  } catch (err) {
    console.log('Error en verifyPastPredictions:', err.message)
    return null
  }
}

// Calcular pesos para cada método basado en su precisión histórica
// Menor error = mayor peso
function calculateMethodWeights(accuracyData) {
  const defaultWeights = {
    by_registrations: 1,
    by_active_users: 1,
    by_historic: 1
  }

  if (!accuracyData?.byMethod || accuracyData.byMethod.length === 0) {
    return defaultWeights
  }

  const weights = { ...defaultWeights }
  let totalInverseError = 0

  // Calcular peso inverso al error (menor error = mayor peso)
  for (const method of accuracyData.byMethod) {
    if (method.method_name !== 'combined' && method.verified_predictions > 0 && method.avg_absolute_error !== null) {
      // Usar 1 / (error + 1) para evitar división por cero y dar más peso a errores bajos
      const inverseError = 1 / (method.avg_absolute_error + 1)
      weights[method.method_name] = inverseError
      totalInverseError += inverseError
    }
  }

  // Normalizar pesos para que sumen 1
  if (totalInverseError > 0) {
    for (const key of Object.keys(weights)) {
      weights[key] = weights[key] / totalInverseError
    }
  } else {
    // Sin datos, pesos iguales
    const equalWeight = 1 / 3
    weights.by_registrations = equalWeight
    weights.by_active_users = equalWeight
    weights.by_historic = equalWeight
  }

  return weights
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

    // 2b. Obtener refunds de cancellation_feedback
    const { data: refunds, error: refundsError } = await supabase
      .from('cancellation_feedback')
      .select('user_id, created_at, refund_amount_cents')
      .not('stripe_refund_id', 'is', null)

    if (refundsError) {
      console.warn('Error obteniendo refunds (tabla puede no existir):', refundsError.message)
    }

    // Set de usuarios que han sido reembolsados
    const refundedUserIds = new Set((refunds || []).map(r => r.user_id).filter(Boolean))

    // Calcular ticket medio
    const paymentAmounts = payments.map(p => p.event_data?.amount || 0).filter(a => a > 0)
    const totalRevenue = paymentAmounts.reduce((a, b) => a + b, 0)
    const avgTicket = paymentAmounts.length > 0 ? totalRevenue / paymentAmounts.length : 0

    const now = new Date()

    // 3. Calcular tasa de conversion REAL NETA (usuarios únicos que han pagado - refunds)
    const payingUserIds = new Set(payments.map(p => p.user_id))
    const totalUsers = users.length
    const uniquePayingUsersGross = payingUserIds.size  // Usuarios únicos brutos

    // Usuarios netos = pagadores - reembolsados
    const netPayingUserIds = new Set([...payingUserIds].filter(id => !refundedUserIds.has(id)))
    const uniquePayingUsers = netPayingUserIds.size  // Usuarios únicos NETOS
    const totalRefunds = refundedUserIds.size

    // Tasa de conversion real NETA (usuarios únicos netos / total usuarios)
    const conversionRate = totalUsers > 0 ? uniquePayingUsers / totalUsers : 0

    // Intervalo de confianza Wilson para la tasa
    const conversionCI = wilsonScoreInterval(uniquePayingUsers, totalUsers)

    // 3b. ALTERNATIVA: Conversión basada en usuarios activos (última semana)
    const sevenDaysAgoISO = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgoISO = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgoDate = sevenDaysAgoISO.slice(0, 10)  // Para daily_question_usage (tipo date)
    const thirtyDaysAgoDate = thirtyDaysAgoISO.slice(0, 10)

    // Obtener usuarios activos (han respondido preguntas en los últimos 7 días)
    const { data: weeklyActiveData, error: weeklyError } = await supabase
      .from('daily_question_usage')
      .select('user_id')
      .gte('usage_date', sevenDaysAgoDate)

    const weeklyActiveUsers = new Set(weeklyActiveData?.map(a => a.user_id) || [])
    const weeklyActiveCount = weeklyActiveUsers.size

    // Usuarios activos en último mes
    const { data: monthlyActiveData } = await supabase
      .from('daily_question_usage')
      .select('user_id')
      .gte('usage_date', thirtyDaysAgoDate)

    const monthlyActiveUsers = new Set(monthlyActiveData?.map(a => a.user_id) || [])
    const monthlyActiveCount = monthlyActiveUsers.size

    // Pagos en última semana y último mes
    const weeklyPayments = payments.filter(p => new Date(p.created_at) >= new Date(sevenDaysAgoISO))
    const monthlyPayments = payments.filter(p => new Date(p.created_at) >= new Date(thirtyDaysAgoISO))

    // Pagadores NETOS (excluyendo refunds)
    const weeklyPayingUsersGross = new Set(weeklyPayments.map(p => p.user_id))
    const monthlyPayingUsersGross = new Set(monthlyPayments.map(p => p.user_id))

    // Filtrar refunds del período
    const weeklyRefunds = (refunds || []).filter(r => new Date(r.created_at) >= new Date(sevenDaysAgoISO))
    const monthlyRefunds = (refunds || []).filter(r => new Date(r.created_at) >= new Date(thirtyDaysAgoISO))
    const weeklyRefundedIds = new Set(weeklyRefunds.map(r => r.user_id).filter(Boolean))
    const monthlyRefundedIds = new Set(monthlyRefunds.map(r => r.user_id).filter(Boolean))

    // Usuarios netos = pagadores - reembolsados del período
    const weeklyPayingUsers = new Set([...weeklyPayingUsersGross].filter(id => !weeklyRefundedIds.has(id)))
    const monthlyPayingUsers = new Set([...monthlyPayingUsersGross].filter(id => !monthlyRefundedIds.has(id)))

    // Conversión alternativa NETA: pagadores netos de la semana / activos de la semana
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

    // Obtener precisión histórica para calcular pesos
    const accuracyData = await getPredictionAccuracy(supabase)
    const methodWeights = calculateMethodWeights(accuracyData)

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

    // Proyección combinada PONDERADA por precisión histórica
    // Los métodos con menor error tienen mayor peso
    let combinedSalesPerMonth = 0
    let totalWeight = 0

    if (method1_salesPerMonth > 0 && isFinite(method1_salesPerMonth)) {
      combinedSalesPerMonth += method1_salesPerMonth * methodWeights.by_registrations
      totalWeight += methodWeights.by_registrations
    }
    if (method2_salesPerMonth > 0 && isFinite(method2_salesPerMonth)) {
      combinedSalesPerMonth += method2_salesPerMonth * methodWeights.by_active_users
      totalWeight += methodWeights.by_active_users
    }
    if (method3_salesPerMonth > 0 && isFinite(method3_salesPerMonth)) {
      combinedSalesPerMonth += method3_salesPerMonth * methodWeights.by_historic
      totalWeight += methodWeights.by_historic
    }

    // Normalizar si no todos los métodos tienen datos
    if (totalWeight > 0 && totalWeight < 1) {
      combinedSalesPerMonth = combinedSalesPerMonth / totalWeight
    }

    const validMethods = [method1_salesPerMonth, method2_salesPerMonth, method3_salesPerMonth].filter(m => m > 0 && isFinite(m))

    // Usar proyección combinada ponderada para todas las estimaciones
    const expectedSalesPerMonth = combinedSalesPerMonth > 0 ? combinedSalesPerMonth : method1_salesPerMonth
    const expectedSalesPerDay = expectedSalesPerMonth / 30

    // MRR por nueva suscripción (ponderado por distribución real de planes)
    // Semestral: 59€/6 = 9.83€/mes, Mensual: 20€/mes
    const MRR_SEMESTER = 59 / 6  // 9.83€
    const MRR_MONTHLY = 20       // 20€

    const semesterCount = activeSubscriptions.filter(s => s.plan_type === 'premium_semester').length
    const monthlyCount = activeSubscriptions.filter(s => s.plan_type === 'premium_monthly').length
    const totalSubs = semesterCount + monthlyCount

    // Calcular MRR promedio basado en distribución actual de planes
    let mrrPerNewSub
    if (totalSubs > 0) {
      const pctSemester = semesterCount / totalSubs
      const pctMonthly = monthlyCount / totalSubs
      mrrPerNewSub = (pctSemester * MRR_SEMESTER) + (pctMonthly * MRR_MONTHLY)
    } else {
      // Sin datos, asumir 50/50
      mrrPerNewSub = (MRR_SEMESTER + MRR_MONTHLY) / 2  // 14.92€
    }

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

    const responseData = {
      // Tasa de conversion global NETA (usuarios únicos netos / total registros)
      conversion: {
        totalUsers,
        uniquePayingUsers,        // NETO (ya descontados refunds)
        uniquePayingUsersGross,   // Bruto (sin descontar)
        totalRefunds,             // Total usuarios reembolsados
        totalPayments: payments.length,  // Para referencia: pagos totales incluyendo renovaciones
        rate: conversionRate,     // Tasa NETA
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
          weight: Math.round(methodWeights.by_registrations * 100),  // Peso en %
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
          weight: Math.round(methodWeights.by_active_users * 100),  // Peso en %
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
          weight: Math.round(methodWeights.by_historic * 100),  // Peso en %
          bestFor: 'Basado en tendencia real de pagos'
        },
        // Promedio PONDERADO de los 3 métodos
        combined: {
          name: 'Combinado Ponderado',
          description: 'Promedio ponderado por precisión histórica',
          salesPerMonth: Math.round(combinedSalesPerMonth * 100) / 100,
          revenuePerMonth: Math.round(combinedSalesPerMonth * avgTicket * 100) / 100,
          methodsUsed: validMethods.length,
          isWeighted: accuracyData?.hasData || false  // true si usa pesos basados en precisión
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
        mrrPerNewSub: Math.round(mrrPerNewSub * 100) / 100,
        newSubsPerMonth: Math.round(expectedSalesPerMonth * 100) / 100,
        byPlan: {
          semester: semesterCount,
          monthly: monthlyCount,
          pctSemester: totalSubs > 0 ? Math.round((semesterCount / totalSubs) * 100) : 50,
          pctMonthly: totalSubs > 0 ? Math.round((monthlyCount / totalSubs) * 100) : 50
        },
        // Explicación de las fórmulas
        explanation: {
          mrrCurrent: `Suma del MRR de ${activeSubscriptions.length} suscripciones activas (semestrales aportan 9.83€/mes, mensuales 20€/mes)`,
          mrrPerNewSub: `(${totalSubs > 0 ? Math.round((semesterCount / totalSubs) * 100) : 50}% × 9.83€) + (${totalSubs > 0 ? Math.round((monthlyCount / totalSubs) * 100) : 50}% × 20€) = ${Math.round(mrrPerNewSub * 100) / 100}€`,
          newSubsSource: 'Proyección combinada ponderada de los 3 métodos',
          projection6m: `MRR actual (${Math.round(mrr * 100) / 100}€) + (${Math.round(expectedSalesPerMonth * 100) / 100} nuevas/mes × 6 meses × ${Math.round(mrrPerNewSub * 100) / 100}€)`,
          churnNote: 'Asume 0% churn (sin cancelaciones)'
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
      },

      // Precisión histórica de predicciones (ya obtenida para calcular pesos)
      predictionAccuracy: accuracyData ? {
        ...accuracyData,
        verificationDays: VERIFICATION_DAYS,  // Cada cuántos días se verifica
        methodWeights: {
          by_registrations: Math.round(methodWeights.by_registrations * 100),
          by_active_users: Math.round(methodWeights.by_active_users * 100),
          by_historic: Math.round(methodWeights.by_historic * 100)
        }
      } : null
    }

    const response = NextResponse.json(responseData)

    // Guardar predicciones del día para tracking (en background, no bloquea respuesta)
    const predictionsToTrack = {
      byRegistrations: {
        salesPerMonth: Math.round(method1_salesPerMonth * 100) / 100,
        revenuePerMonth: Math.round(method1_salesPerMonth * avgTicket * 100) / 100,
        inputs: {
          dailyRegistrations: Math.round(dailyRegistrationRate * 10) / 10,
          conversionRate: Math.round(conversionRate * 10000) / 100
        }
      },
      byActiveUsers: {
        salesPerMonth: Math.round(method2_salesPerMonth * 100) / 100,
        revenuePerMonth: Math.round(method2_salesPerMonth * avgTicket * 100) / 100,
        inputs: {
          activeFreeUsers: weeklyActiveFree.length,
          weeklyConversionRate: Math.round(weeklyConversionRate * 10000) / 100
        }
      },
      byHistoric: {
        salesPerMonth: Math.round(method3_salesPerMonth * 100) / 100,
        revenuePerMonth: Math.round(method3_salesPerMonth * avgTicket * 100) / 100,
        inputs: {
          avgDaysBetweenPayments: avgDaysBetweenPayments ? Math.round(avgDaysBetweenPayments * 10) / 10 : null
        }
      },
      combined: {
        salesPerMonth: Math.round(combinedSalesPerMonth * 100) / 100,
        revenuePerMonth: Math.round(combinedSalesPerMonth * avgTicket * 100) / 100,
        methodsUsed: validMethods.length
      }
    }

    // Guardar y verificar en background (no bloquea la respuesta)
    saveDailyPredictions(supabase, predictionsToTrack)
    verifyPastPredictions(supabase)

    return response

  } catch (error) {
    console.error('Error in sales-prediction:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
