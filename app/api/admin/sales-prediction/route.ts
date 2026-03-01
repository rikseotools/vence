// app/api/admin/sales-prediction/route.ts
// API para predicciones de ventas con intervalos de confianza
import { NextResponse } from 'next/server'
import https from 'https'
import {
  getRegistrationData,
  getConversionData,
  getCancellationData,
  getActiveUsersData,
  getManualSubscriptions,
  saveDailyPredictions,
  getPredictionAccuracy,
  getUnverifiedPredictions,
  getActualSalesInPeriod,
  updatePredictionVerification,
  getVerifiedPredictionsWithHighError,
} from '@/lib/api/admin-sales-prediction'

// Helper para llamar a la API de Stripe directamente
function stripeGet(path: string): Promise<{ data: StripeSubscription[]; has_more: boolean }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.stripe.com',
      path,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk: string) => data += chunk)
      res.on('end', () => resolve(JSON.parse(data)))
    })
    req.on('error', reject)
    req.end()
  })
}

interface StripeSubscription {
  id: string
  status: string
  cancel_at_period_end: boolean
  current_period_start?: number
  current_period_end?: number
  created: number
  canceled_at?: number
  metadata?: Record<string, string>
  items: {
    data: Array<{
      price?: {
        recurring?: { interval: string; interval_count: number }
      }
      current_period_start?: number
      current_period_end?: number
    }>
  }
}

// Wilson score interval para proporciones con muestras pequeñas
function wilsonScoreInterval(successes: number, total: number, confidence = 0.95) {
  if (total === 0) return { lower: 0, upper: 0, center: 0 }

  const z = confidence === 0.95 ? 1.96 : 1.645
  const p = successes / total
  const n = total

  const denominator = 1 + z * z / n
  const center = (p + z * z / (2 * n)) / denominator
  const margin = (z / denominator) * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))

  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    center,
  }
}

function probabilityAtLeastOne(p: number, n: number) {
  if (p === 0 || n === 0) return 0
  return 1 - Math.pow(1 - p, n)
}

function trialsForProbability(p: number, targetProb: number) {
  if (p === 0) return Infinity
  return Math.ceil(Math.log(1 - targetProb) / Math.log(1 - p))
}

// Verificar predicciones de hace 7 días (comparar con realidad)
const VERIFICATION_DAYS = 7

// Calcula error usando sMAPE (Symmetric Mean Absolute Percentage Error)
// - Máximo posible: 200% (cuando uno de los valores es 0)
// - Evita el problema de % enormes cuando el valor esperado es < 1
// - Fórmula: |actual - expected| / ((|actual| + |expected|) / 2) * 100
function calculateSmapeError(actual: number, expected: number): { errorPercent: number; absoluteError: number } {
  const diff = Math.abs(actual - expected)
  const avg = (Math.abs(actual) + Math.abs(expected)) / 2
  const smape = avg > 0 ? (diff / avg) * 100 : 0
  // errorPercent con signo indica dirección (+ = vendimos más de lo predicho)
  const signed = avg > 0 ? ((actual - expected) / avg) * 100 : 0
  return { errorPercent: signed, absoluteError: smape }
}

async function verifyPastPredictions() {
  try {
    const targetDate = new Date(Date.now() - VERIFICATION_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)

    const payments = await getActualSalesInPeriod(targetDate, today)

    const actualSales = new Set(payments?.map(p => p.userId) || []).size
    const actualRevenue = payments?.reduce((sum, p) => sum + ((p.eventData as Record<string, number>)?.amount || 0), 0) || 0

    const predictions = await getUnverifiedPredictions(targetDate)

    if (predictions && predictions.length > 0) {
      for (const pred of predictions) {
        const expectedSalesInPeriod = parseFloat(pred.predictedSalesPerMonth) * (VERIFICATION_DAYS / 30)

        let errorPercent: number | null = null
        let absoluteError: number | null = null

        if (expectedSalesInPeriod > 0 || actualSales > 0) {
          const result = calculateSmapeError(actualSales, expectedSalesInPeriod)
          errorPercent = result.errorPercent
          absoluteError = result.absoluteError
        }

        await updatePredictionVerification(pred.id, actualSales, actualRevenue, errorPercent, absoluteError)
      }
    }

    // Recalcular predicciones antiguas que usaban la fórmula MAPE (error > 200% = fórmula vieja)
    await recalculateOldPredictions()

    return { verified: (predictions?.length ?? 0) > 0, date: targetDate, actualSales, actualRevenue, days: VERIFICATION_DAYS }
  } catch (err) {
    console.log('Error en verifyPastPredictions:', (err as Error).message)
    return null
  }
}

async function recalculateOldPredictions() {
  try {
    const oldPredictions = await getVerifiedPredictionsWithHighError()
    if (!oldPredictions || oldPredictions.length === 0) return

    for (const pred of oldPredictions) {
      const expectedSalesInPeriod = parseFloat(pred.predictedSalesPerMonth ?? '0') * (VERIFICATION_DAYS / 30)
      const actual = pred.actualSales ?? 0

      if (expectedSalesInPeriod > 0 || actual > 0) {
        const result = calculateSmapeError(actual, expectedSalesInPeriod)
        await updatePredictionVerification(pred.id, actual, parseFloat(pred.actualRevenue ?? '0'), result.errorPercent, result.absoluteError)
      }
    }
    console.log(`📊 Recalculadas ${oldPredictions.length} predicciones antiguas con sMAPE`)
  } catch (err) {
    console.log('Error recalculando predicciones antiguas:', (err as Error).message)
  }
}

function calculateMethodWeights(accuracyData: { byMethod: Array<{ method_name: string | null; verified_predictions: number | null; avg_absolute_error: string | null }> } | null) {
  const defaultWeights: Record<string, number> = {
    by_registrations: 1,
    by_active_users: 1,
    by_historic: 1,
  }

  if (!accuracyData?.byMethod || accuracyData.byMethod.length === 0) {
    return defaultWeights
  }

  const weights: Record<string, number> = { ...defaultWeights }
  let totalInverseError = 0

  for (const method of accuracyData.byMethod) {
    if (method.method_name !== 'combined' && (method.verified_predictions ?? 0) > 0 && method.avg_absolute_error !== null) {
      const inverseError = 1 / (parseFloat(method.avg_absolute_error) + 1)
      weights[method.method_name!] = inverseError
      totalInverseError += inverseError
    }
  }

  if (totalInverseError > 0) {
    for (const key of Object.keys(weights)) {
      weights[key] = weights[key] / totalInverseError
    }
  } else {
    const equalWeight = 1 / 3
    weights.by_registrations = equalWeight
    weights.by_active_users = equalWeight
    weights.by_historic = equalWeight
  }

  return weights
}

export async function GET() {
  try {
    // 1. Obtener todos los usuarios con su fecha de registro
    const users = await getRegistrationData()

    // 2. Obtener todos los eventos de pago (incluyendo importe)
    const payments = await getConversionData()

    // 2b. Obtener TODAS las cancelaciones
    const cancellations = await getCancellationData()

    const refunds = cancellations.filter(c => (c.refundAmountCents || 0) > 0)
    const allCancellations = cancellations

    const cancelledUserIds = new Set(allCancellations.map(c => c.userId).filter(Boolean))
    const refundedUserIds = new Set(refunds.map(r => r.userId).filter(Boolean))

    // Calcular ticket medio
    const paymentAmounts = payments.map(p => (p.eventData as Record<string, number>)?.amount || 0).filter(a => a > 0)
    const totalRevenue = paymentAmounts.reduce((a, b) => a + b, 0)
    const avgTicket = paymentAmounts.length > 0 ? totalRevenue / paymentAmounts.length : 0

    const now = new Date()

    // 3. Calcular tasa de conversión REAL NETA
    const payingUserIds = new Set(payments.map(p => p.userId))
    const totalUsers = users.length
    const uniquePayingUsersGross = payingUserIds.size

    const netPayingUserIds = new Set([...payingUserIds].filter(id => !refundedUserIds.has(id!)))
    const uniquePayingUsers = netPayingUserIds.size
    const totalRefunds = refundedUserIds.size

    const conversionRate = totalUsers > 0 ? uniquePayingUsers / totalUsers : 0
    const conversionCI = wilsonScoreInterval(uniquePayingUsers, totalUsers)

    // 3b. Conversión basada en usuarios activos
    const sevenDaysAgoISO = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgoISO = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgoDate = sevenDaysAgoISO.slice(0, 10)
    const thirtyDaysAgoDate = thirtyDaysAgoISO.slice(0, 10)

    const weeklyActiveData = await getActiveUsersData(sevenDaysAgoDate)
    const weeklyActiveUsers = new Set(weeklyActiveData?.map(a => a.userId) || [])
    const weeklyActiveCount = weeklyActiveUsers.size

    const monthlyActiveData = await getActiveUsersData(thirtyDaysAgoDate)
    const monthlyActiveUsers = new Set(monthlyActiveData?.map(a => a.userId) || [])
    const monthlyActiveCount = monthlyActiveUsers.size

    // Pagos en última semana y último mes
    const weeklyPayments = payments.filter(p => new Date(p.createdAt!) >= new Date(sevenDaysAgoISO))
    const monthlyPayments = payments.filter(p => new Date(p.createdAt!) >= new Date(thirtyDaysAgoISO))

    const weeklyPayingUsersGross = new Set(weeklyPayments.map(p => p.userId))
    const monthlyPayingUsersGross = new Set(monthlyPayments.map(p => p.userId))

    const weeklyRefunds = refunds.filter(r => new Date(r.createdAt!) >= new Date(sevenDaysAgoISO))
    const monthlyRefunds = refunds.filter(r => new Date(r.createdAt!) >= new Date(thirtyDaysAgoISO))
    const weeklyRefundedIds = new Set(weeklyRefunds.map(r => r.userId).filter(Boolean))
    const monthlyRefundedIds = new Set(monthlyRefunds.map(r => r.userId).filter(Boolean))

    const weeklyPayingUsers = new Set([...weeklyPayingUsersGross].filter(id => !weeklyRefundedIds.has(id!)))
    const monthlyPayingUsers = new Set([...monthlyPayingUsersGross].filter(id => !monthlyRefundedIds.has(id!)))

    const weeklyConversionRate = weeklyActiveCount > 0 ? weeklyPayingUsers.size / weeklyActiveCount : 0
    const monthlyConversionRate = monthlyActiveCount > 0 ? monthlyPayingUsers.size / monthlyActiveCount : 0

    const weeklyConversionCI = wilsonScoreInterval(weeklyPayingUsers.size, weeklyActiveCount)
    const monthlyConversionCI = wilsonScoreInterval(monthlyPayingUsers.size, monthlyActiveCount)

    // 3c. Análisis de tipo de conversión
    const sameDayConversions = payments.filter(p => {
      const user = users.find(u => u.id === p.userId)
      if (!user) return false
      const daysDiff = Math.round((new Date(p.createdAt!).getTime() - new Date(user.createdAt!).getTime()) / (1000 * 60 * 60 * 24))
      return daysDiff === 0
    })

    const delayedConversions = payments.filter(p => {
      const user = users.find(u => u.id === p.userId)
      if (!user) return false
      const daysDiff = Math.round((new Date(p.createdAt!).getTime() - new Date(user.createdAt!).getTime()) / (1000 * 60 * 60 * 24))
      return daysDiff >= 1
    })

    const weeklyActiveFree = [...weeklyActiveUsers].filter(uid => {
      const user = users.find(u => u.id === uid)
      return user && user.planType !== 'premium' && user.planType !== 'legacy_free'
    })

    // 4. Calcular tiempo promedio hasta conversión
    let avgDaysToConvert = 0
    const conversionTimes: number[] = []
    for (const payment of payments) {
      const user = users.find(u => u.id === payment.userId)
      if (user) {
        const days = Math.round((new Date(payment.createdAt!).getTime() - new Date(user.createdAt!).getTime()) / (1000 * 60 * 60 * 24))
        conversionTimes.push(days)
      }
    }
    if (conversionTimes.length > 0) {
      avgDaysToConvert = conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length
    }

    // 5. Pool de usuarios que pueden convertir
    const lastPayment = payments[0]
    const lastPaymentDate = lastPayment ? new Date(lastPayment.createdAt!) : null

    const nonPayingUsers = users.filter(u => !payingUserIds.has(u.id))

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const newUsers = nonPayingUsers.filter(u => new Date(u.createdAt!) >= sevenDaysAgo)
    const activeUsers = nonPayingUsers.filter(u => {
      const created = new Date(u.createdAt!)
      return created < sevenDaysAgo && created >= thirtyDaysAgo
    })
    const dormantUsers = nonPayingUsers.filter(u => new Date(u.createdAt!) < thirtyDaysAgo)

    const p = conversionRate
    const n = nonPayingUsers.length

    const currentProbability = probabilityAtLeastOne(p, n)
    const probWithLowerCI = probabilityAtLeastOne(conversionCI.lower, n)
    const probWithUpperCI = probabilityAtLeastOne(conversionCI.upper, n)

    // 6. Estimación de días hasta próxima venta
    const recentRegistrations = users.filter(u => new Date(u.createdAt!) > sevenDaysAgo)
    const dailyRegistrationRate = recentRegistrations.length / 7

    const registrationsFor50 = trialsForProbability(p, 0.5)
    const registrationsFor75 = trialsForProbability(p, 0.75)
    const registrationsFor90 = trialsForProbability(p, 0.90)

    const additionalNeeded = Math.max(0, registrationsFor50 - n)
    const daysUntil50 = dailyRegistrationRate > 0 ? Math.ceil(additionalNeeded / dailyRegistrationRate) : null

    // 7. Tendencia histórica
    const paymentDates = payments.map(p2 => new Date(p2.createdAt!)).sort((a, b) => a.getTime() - b.getTime())
    const daysBetweenPayments: number[] = []
    for (let i = 1; i < paymentDates.length; i++) {
      const days = (paymentDates[i].getTime() - paymentDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
      daysBetweenPayments.push(days)
    }
    const avgDaysBetweenPayments = daysBetweenPayments.length > 0
      ? daysBetweenPayments.reduce((a, b) => a + b, 0) / daysBetweenPayments.length
      : null

    const daysSinceLastPayment = lastPaymentDate
      ? (now.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24)
      : null

    // 8. MRR y previsión de renovaciones
    let allStripeSubs: StripeSubscription[] = []
    let hasMore = true
    let startingAfter: string | null = null
    while (hasMore) {
      let path = '/v1/subscriptions?limit=100&status=all'
      if (startingAfter) path += '&starting_after=' + startingAfter
      const result = await stripeGet(path)
      allStripeSubs = allStripeSubs.concat(result.data)
      hasMore = result.has_more
      if (result.data.length > 0) startingAfter = result.data[result.data.length - 1].id
    }
    const stripeSubs = allStripeSubs.filter(s => s.status === 'active')
    const stripeCanceledSubs = allStripeSubs.filter(s => s.status === 'canceled')

    const manualSubsData = await getManualSubscriptions()

    const PRICES: Record<string, number> = {
      premium_monthly: 20,
      premium_quarterly: 35,
      premium_semester: 59,
    }

    const MRR_RATES: Record<string, number> = {
      premium_monthly: 20,
      premium_quarterly: 35 / 3,
      premium_semester: 59 / 6,
    }

    // Unificar subs
    interface ActiveSub {
      plan_type: string
      cancel_at_period_end: boolean
      current_period_start: string | null
      current_period_end: string | null
      user_id: string | null
      source: string
      created?: number
    }

    const activeSubscriptions: ActiveSub[] = []
    for (const sub of stripeSubs) {
      const item = sub.items.data[0]
      const interval = item?.price?.recurring?.interval
      const intervalCount = item?.price?.recurring?.interval_count

      const periodStart = item?.current_period_start || sub.current_period_start
      const periodEnd = item?.current_period_end || sub.current_period_end

      let planType: string
      if (interval === 'month' && intervalCount === 1) planType = 'premium_monthly'
      else if (interval === 'month' && intervalCount === 3) planType = 'premium_quarterly'
      else planType = 'premium_semester'

      activeSubscriptions.push({
        plan_type: planType,
        cancel_at_period_end: sub.cancel_at_period_end,
        current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        user_id: sub.metadata?.supabase_user_id || sub.metadata?.user_id || null,
        source: 'stripe',
        created: sub.created,
      })
    }

    for (const sub of (manualSubsData || [])) {
      const start = new Date(sub.currentPeriodStart!)
      const end = new Date(sub.currentPeriodEnd!)
      const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)

      let planType: string
      if (days <= 35) planType = 'premium_monthly'
      else if (days <= 100) planType = 'premium_quarterly'
      else planType = 'premium_semester'

      activeSubscriptions.push({
        plan_type: planType,
        cancel_at_period_end: sub.cancelAtPeriodEnd ?? false,
        current_period_start: sub.currentPeriodStart,
        current_period_end: sub.currentPeriodEnd,
        user_id: sub.userId,
        source: 'manual',
      })
    }

    // MRR
    let mrr = 0
    activeSubscriptions.forEach(sub => {
      if (!sub.cancel_at_period_end) {
        mrr += MRR_RATES[sub.plan_type] || MRR_RATES.premium_semester
      }
    })

    // Proyección de renovaciones por mes (próximos 12 meses)
    const renewalProjection: Array<{
      month: string; monthIndex: number; renewals: number; revenue: number
      users: Array<{ userId: string | null; renewDate: string | null; amount: number }>
    }> = []
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0)

      let renewalsInMonth = 0
      let revenueInMonth = 0
      const renewingUsers: Array<{ userId: string | null; renewDate: string | null; amount: number }> = []

      activeSubscriptions.forEach(sub => {
        if (!sub.cancel_at_period_end && sub.current_period_end) {
          const renewDate = new Date(sub.current_period_end)
          if (!isNaN(renewDate.getTime()) && renewDate >= monthStart && renewDate <= monthEnd) {
            renewalsInMonth++
            const price = PRICES[sub.plan_type] || PRICES.premium_semester
            revenueInMonth += price
            renewingUsers.push({ userId: sub.user_id, renewDate: sub.current_period_end, amount: price })
          }
        }
      })

      renewalProjection.push({
        month: monthStart.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
        monthIndex: i,
        renewals: renewalsInMonth,
        revenue: revenueInMonth,
        users: renewingUsers,
      })
    }

    // Antigüedad del negocio
    const allCreatedDates = allStripeSubs.map(s => s.created).filter(Boolean)
    const oldestStripeSub = allCreatedDates.length > 0 ? Math.min(...allCreatedDates) : Date.now() / 1000
    const businessAgeDays = (Date.now() / 1000 - oldestStripeSub) / (24 * 3600)
    const businessAgeMonths = Math.max(1, businessAgeDays / 30)

    // Obtener precisión histórica
    const accuracyData = await getPredictionAccuracy()

    // MÉTODO 1: Por registros
    const method1_salesPerDay = dailyRegistrationRate * conversionRate
    const method1_salesPerMonth = method1_salesPerDay * 30

    // MÉTODO 2: Por usuarios activos
    const method2_salesPerMonth = weeklyActiveFree.length * weeklyConversionRate * 4

    // MÉTODO 3: Por Stripe con ventana móvil y tendencia
    const nowTs = Date.now() / 1000
    const cancelPendingCount = stripeSubs.filter(s => s.cancel_at_period_end).length

    const windowDays = Math.min(90, businessAgeDays)
    const windowStartTs = nowTs - windowDays * 24 * 3600
    const subsInWindow = allStripeSubs.filter(s => s.created >= windowStartTs)
    const canceledInWindow = stripeCanceledSubs.filter(s => s.canceled_at && s.canceled_at >= windowStartTs)

    const weekSecs = 7 * 24 * 3600
    const numWeeks = Math.max(1, Math.ceil(windowDays / 7))
    const weeklyBuckets: Array<{ weekIndex: number; newSubs: number; canceled: number }> = []

    for (let i = 0; i < numWeeks; i++) {
      const wStart = windowStartTs + i * weekSecs
      const wEnd = wStart + weekSecs
      const newInWeek = subsInWindow.filter(s => s.created >= wStart && s.created < wEnd).length
      const canceledInWeek = canceledInWindow.filter(s => s.canceled_at! >= wStart && s.canceled_at! < wEnd).length
      weeklyBuckets.push({ weekIndex: i, newSubs: newInWeek, canceled: canceledInWeek })
    }

    // Regresión lineal
    const nW = weeklyBuckets.length
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
    for (const b of weeklyBuckets) {
      sumX += b.weekIndex
      sumY += b.newSubs
      sumXY += b.weekIndex * b.newSubs
      sumX2 += b.weekIndex * b.weekIndex
    }
    const meanX = sumX / nW
    const meanY = sumY / nW
    const slope = nW > 1 && (sumX2 - nW * meanX * meanX) !== 0
      ? (sumXY - nW * meanX * meanY) / (sumX2 - nW * meanX * meanX)
      : 0

    let trend = 'stable'
    let trendLabel = 'Estable'
    if (nW >= 3 && meanY > 0) {
      const slopePct = (slope / meanY) * 100
      if (slopePct > 20) { trend = 'accelerating'; trendLabel = 'Acelerando' }
      else if (slopePct < -20) { trend = 'decelerating'; trendLabel = 'Desacelerando' }
    }

    const avgPerWeek = meanY
    const recentWeeks = weeklyBuckets.slice(-2)
    const recentAvgPerWeek = recentWeeks.reduce((s, w) => s + w.newSubs, 0) / recentWeeks.length
    const recencyWeight = Math.min(0.6, nW / 12)
    const projectedPerWeek = avgPerWeek * (1 - recencyWeight) + recentAvgPerWeek * recencyWeight
    const method3_salesPerMonth = Math.round(projectedPerWeek * (30 / 7) * 100) / 100

    const thirtyDaysAgoTs = nowTs - 30 * 24 * 3600
    const newSubsLast30Days = allStripeSubs.filter(s => s.created >= thirtyDaysAgoTs).length
    const canceledLast30Days = stripeCanceledSubs.filter(s => s.canceled_at && s.canceled_at >= thirtyDaysAgoTs).length

    // Proyección combinada
    const WEIGHTS = { stripe: 0.70, registrations: 0.15, active: 0.15 }
    let combinedSalesPerMonth = 0
    let totalWeight = 0

    if (method3_salesPerMonth > 0) {
      combinedSalesPerMonth += method3_salesPerMonth * WEIGHTS.stripe
      totalWeight += WEIGHTS.stripe
    }
    if (method1_salesPerMonth > 0 && isFinite(method1_salesPerMonth)) {
      combinedSalesPerMonth += method1_salesPerMonth * WEIGHTS.registrations
      totalWeight += WEIGHTS.registrations
    }
    if (method2_salesPerMonth > 0 && isFinite(method2_salesPerMonth)) {
      combinedSalesPerMonth += method2_salesPerMonth * WEIGHTS.active
      totalWeight += WEIGHTS.active
    }
    if (totalWeight > 0) combinedSalesPerMonth /= totalWeight

    const methodWeights = {
      by_registrations: Math.round(WEIGHTS.registrations * 100),
      by_active_users: Math.round(WEIGHTS.active * 100),
      by_historic: Math.round(WEIGHTS.stripe * 100),
    }

    const validMethods = [method1_salesPerMonth, method2_salesPerMonth, method3_salesPerMonth].filter(m => m > 0 && isFinite(m))

    const expectedSalesPerMonth = combinedSalesPerMonth > 0 ? combinedSalesPerMonth : method3_salesPerMonth

    // MRR por nueva suscripción
    const semesterCount = activeSubscriptions.filter(s => s.plan_type === 'premium_semester').length
    const quarterlyCount = activeSubscriptions.filter(s => s.plan_type === 'premium_quarterly').length
    const monthlyCount = activeSubscriptions.filter(s => s.plan_type === 'premium_monthly').length
    const totalSubs = semesterCount + quarterlyCount + monthlyCount

    let mrrPerNewSub: number
    if (totalSubs > 0) {
      const pctSemester = semesterCount / totalSubs
      const pctQuarterly = quarterlyCount / totalSubs
      const pctMonthly = monthlyCount / totalSubs
      mrrPerNewSub = (pctSemester * MRR_RATES.premium_semester) + (pctQuarterly * MRR_RATES.premium_quarterly) + (pctMonthly * MRR_RATES.premium_monthly)
    } else {
      mrrPerNewSub = (MRR_RATES.premium_semester + MRR_RATES.premium_quarterly + MRR_RATES.premium_monthly) / 3
    }

    // Churn
    const totalRefundAmount = refunds.reduce((sum, r) => sum + (r.refundAmountCents || 0), 0) / 100
    const totalCancellations = cancelledUserIds.size
    const totalRefundsCount = refundedUserIds.size
    const cancelingSubscriptions = activeSubscriptions.filter(s => s.cancel_at_period_end)

    const stripeChurnedCount = stripeCanceledSubs.length
    const stripeCancelPendingCount = cancelingSubscriptions.length
    const totalStripeEver = allStripeSubs.length

    const canceledPerMonth = stripeChurnedCount / businessAgeMonths
    const churnMonthly = stripeSubs.length > 5
      ? Math.max(0.03, Math.min(0.15, canceledPerMonth / stripeSubs.length))
      : 0.05

    // Proyección de MRR CON CHURN
    const newSubsIn6Months = expectedSalesPerMonth * 6
    const newSubsIn12Months = expectedSalesPerMonth * 12

    const mrrAfterChurn6 = mrr * Math.pow(1 - churnMonthly, 6)
    const mrrAfterChurn12 = mrr * Math.pow(1 - churnMonthly, 12)

    const avgChurnFactor6 = Math.pow(1 - churnMonthly, 3)
    const avgChurnFactor12 = Math.pow(1 - churnMonthly, 6)

    const mrr6Months = mrrAfterChurn6 + (newSubsIn6Months * mrrPerNewSub * avgChurnFactor6)
    const mrr12Months = mrrAfterChurn12 + (newSubsIn12Months * mrrPerNewSub * avgChurnFactor12)

    const arr = mrr * 12
    const arr6Months = mrr6Months * 12
    const arr12Months = mrr12Months * 12

    const billing6Months = renewalProjection.slice(0, 6).reduce((acc, m) => acc + m.revenue, 0) * avgChurnFactor6 +
                           (expectedSalesPerMonth * avgTicket * 6 * avgChurnFactor6)
    const billing12Months = renewalProjection.reduce((acc, m) => acc + m.revenue, 0) * avgChurnFactor12 +
                            (expectedSalesPerMonth * avgTicket * 12 * avgChurnFactor12)

    const responseData = {
      conversion: {
        totalUsers,
        uniquePayingUsers,
        uniquePayingUsersGross,
        totalRefunds,
        totalPayments: payments.length,
        rate: conversionRate,
        confidenceInterval: { lower: conversionCI.lower, upper: conversionCI.upper, confidence: 0.95 },
        avgDaysToConvert: Math.round(avgDaysToConvert),
        conversionTimes: conversionTimes.sort((a, b) => a - b),
      },
      conversionByActivity: {
        weekly: {
          activeUsers: weeklyActiveCount,
          activeFreeUsers: weeklyActiveFree.length,
          payingUsers: weeklyPayingUsers.size,
          rate: weeklyConversionRate,
          confidenceInterval: { lower: weeklyConversionCI.lower, upper: weeklyConversionCI.upper },
        },
        monthly: {
          activeUsers: monthlyActiveCount,
          payingUsers: monthlyPayingUsers.size,
          rate: monthlyConversionRate,
          confidenceInterval: { lower: monthlyConversionCI.lower, upper: monthlyConversionCI.upper },
        },
        conversionType: {
          sameDay: sameDayConversions.length,
          afterTrying: delayedConversions.length,
          sameDayPercent: payments.length > 0 ? Math.round((sameDayConversions.length / payments.length) * 100) : 0,
        },
      },
      revenue: {
        totalRevenue,
        avgTicket,
        payments: paymentAmounts,
      },
      current: {
        totalUsers,
        totalPayments: payments.length,
        daysSinceLastPayment: daysSinceLastPayment ? Math.round(daysSinceLastPayment) : null,
        lastPaymentDate: lastPaymentDate?.toISOString() || null,
        pool: {
          total: nonPayingUsers.length,
          new: newUsers.length,
          active: activeUsers.length,
          dormant: dormantUsers.length,
        },
      },
      prediction: {
        probability: currentProbability,
        probabilityCI: { lower: probWithLowerCI, upper: probWithUpperCI },
        registrationsFor50,
        registrationsFor75,
        registrationsFor90,
        daysUntil50Estimate: daysUntil50,
        dailyRegistrationRate: Math.round(dailyRegistrationRate * 10) / 10,
      },
      projectionMethods: {
        byRegistrations: {
          name: 'Por registros',
          description: 'Registros/día × Tasa conversión global',
          salesPerMonth: Math.round(method1_salesPerMonth * 100) / 100,
          revenuePerMonth: Math.round(method1_salesPerMonth * avgTicket * 100) / 100,
          inputs: {
            dailyRegistrations: Math.round(dailyRegistrationRate * 10) / 10,
            conversionRate: Math.round(conversionRate * 10000) / 100,
          },
          weight: methodWeights.by_registrations,
          bestFor: 'Proyección a largo plazo',
        },
        byActiveUsers: {
          name: 'Por activos',
          description: 'Usuarios FREE activos × Tasa conversión semanal × 4',
          salesPerMonth: Math.round(method2_salesPerMonth * 100) / 100,
          revenuePerMonth: Math.round(method2_salesPerMonth * avgTicket * 100) / 100,
          inputs: {
            activeFreeUsers: weeklyActiveFree.length,
            weeklyConversionRate: Math.round(weeklyConversionRate * 10000) / 100,
          },
          weight: methodWeights.by_active_users,
          bestFor: 'Proyección a corto plazo (próximas semanas)',
        },
        byHistoric: {
          name: 'Por Stripe (real)',
          description: `Ventana ${Math.round(windowDays)} días con tendencia`,
          salesPerMonth: method3_salesPerMonth,
          revenuePerMonth: Math.round(method3_salesPerMonth * avgTicket * 100) / 100,
          inputs: {
            newLast30Days: newSubsLast30Days,
            canceledLast30Days,
            cancelPending: cancelPendingCount,
            windowDays: Math.round(windowDays),
            weeksAnalyzed: nW,
            avgPerWeek: Math.round(avgPerWeek * 10) / 10,
            recentAvgPerWeek: Math.round(recentAvgPerWeek * 10) / 10,
          },
          trend: {
            direction: trend,
            label: trendLabel,
            slopePerWeek: Math.round(slope * 100) / 100,
          },
          weeklyBuckets: weeklyBuckets.map(b => ({ new: b.newSubs, canceled: b.canceled })),
          weight: methodWeights.by_historic,
          bestFor: 'Dato real de crecimiento (fuente principal)',
        },
        combined: {
          name: 'Combinado',
          description: 'Stripe 70% + registros 15% + activos 15%',
          salesPerMonth: Math.round(combinedSalesPerMonth * 100) / 100,
          revenuePerMonth: Math.round(combinedSalesPerMonth * avgTicket * 100) / 100,
          methodsUsed: validMethods.length,
          weights: methodWeights,
        },
      },
      trend: {
        avgDaysBetweenPayments: avgDaysBetweenPayments ? Math.round(avgDaysBetweenPayments) : null,
        paymentHistory: payments.slice(0, 10).map(p2 => ({
          date: p2.createdAt,
          userId: p2.userId,
        })),
      },
      quality: {
        sampleSize: payments.length,
        confidenceWidth: conversionCI.upper - conversionCI.lower,
        reliability: payments.length >= 20 ? 'alta' : payments.length >= 10 ? 'media' : 'baja',
        message: payments.length < 10
          ? `Con ${payments.length} ventas, las predicciones tienen alta varianza. Se necesitan ~20 ventas para predicciones fiables.`
          : payments.length < 20
          ? `Con ${payments.length} ventas, las predicciones son aproximadas. Mejoraran con mas datos.`
          : `Con ${payments.length} ventas, las predicciones son estadisticamente fiables.`,
      },
      mrr: {
        current: Math.round(mrr * 100) / 100,
        in6Months: Math.round(mrr6Months * 100) / 100,
        in12Months: Math.round(mrr12Months * 100) / 100,
        arr: Math.round(arr * 100) / 100,
        arrIn6Months: Math.round(arr6Months * 100) / 100,
        arrIn12Months: Math.round(arr12Months * 100) / 100,
        activeSubscriptions: activeSubscriptions.length,
        cancelingSubscriptions: cancelingSubscriptions.length,
        mrrPerNewSub: Math.round(mrrPerNewSub * 100) / 100,
        newSubsPerMonth: Math.round(expectedSalesPerMonth * 100) / 100,
        churn: {
          monthlyRate: Math.round(churnMonthly * 1000) / 10,
          calculatedRate: Math.round(churnMonthly * 1000) / 10,
          lifetimeRate: uniquePayingUsersGross > 0
            ? Math.round((totalCancellations / uniquePayingUsersGross) * 1000) / 10
            : 0,
          businessAgeMonths: Math.round(businessAgeMonths * 10) / 10,
          payingUsers: uniquePayingUsersGross,
          totalCancellations,
          totalRefunds: totalRefundsCount,
          refundAmount: Math.round(totalRefundAmount * 100) / 100,
          isMinimum: churnMonthly <= 0.03,
        },
        byPlan: {
          semester: semesterCount,
          quarterly: quarterlyCount,
          monthly: monthlyCount,
          pctSemester: totalSubs > 0 ? Math.round((semesterCount / totalSubs) * 100) : 0,
          pctQuarterly: totalSubs > 0 ? Math.round((quarterlyCount / totalSubs) * 100) : 0,
          pctMonthly: totalSubs > 0 ? Math.round((monthlyCount / totalSubs) * 100) : 0,
        },
        explanation: {
          mrrCurrent: `${activeSubscriptions.filter(s => !s.cancel_at_period_end).length} subs activas (${stripeSubs.length} Stripe + ${(manualSubsData || []).length} manuales, excl. ${cancelingSubscriptions.length} cancelando)`,
          churnApplied: `Churn mensual ${Math.round(churnMonthly * 100)}% (${stripeChurnedCount} canceladas Stripe + ${stripeCancelPendingCount} pendientes en ${businessAgeMonths.toFixed(1)} meses)`,
          projection6m: `MRR × (1-churn)^6 + nuevas subs ajustadas por churn`,
          cancellationsNote: `${totalCancellations} cancelaciones de ${uniquePayingUsersGross} pagadores (${totalRefundsCount} con refund: ${Math.round(totalRefundAmount)}€)`,
        },
      },
      renewals: {
        next6Months: renewalProjection.slice(0, 6).reduce((acc, m) => acc + m.revenue, 0),
        next12Months: renewalProjection.reduce((acc, m) => acc + m.revenue, 0),
        byMonth: renewalProjection,
      },
      billing: {
        next6Months: Math.round(billing6Months * 100) / 100,
        next12Months: Math.round(billing12Months * 100) / 100,
      },
      predictionAccuracy: accuracyData ? {
        ...accuracyData,
        verificationDays: VERIFICATION_DAYS,
        methodWeights,
      } : null,
    }

    const response = NextResponse.json(responseData)

    // Guardar y verificar en background
    const predictionsToTrack = [
      {
        prediction_date: new Date().toISOString().slice(0, 10),
        method_name: 'by_registrations',
        predicted_sales_per_month: Math.round(method1_salesPerMonth * 100) / 100,
        predicted_revenue_per_month: Math.round(method1_salesPerMonth * avgTicket * 100) / 100,
        prediction_inputs: {
          dailyRegistrations: Math.round(dailyRegistrationRate * 10) / 10,
          conversionRate: Math.round(conversionRate * 10000) / 100,
        },
      },
      {
        prediction_date: new Date().toISOString().slice(0, 10),
        method_name: 'by_active_users',
        predicted_sales_per_month: Math.round(method2_salesPerMonth * 100) / 100,
        predicted_revenue_per_month: Math.round(method2_salesPerMonth * avgTicket * 100) / 100,
        prediction_inputs: {
          activeFreeUsers: weeklyActiveFree.length,
          weeklyConversionRate: Math.round(weeklyConversionRate * 10000) / 100,
        },
      },
      {
        prediction_date: new Date().toISOString().slice(0, 10),
        method_name: 'by_historic',
        predicted_sales_per_month: method3_salesPerMonth,
        predicted_revenue_per_month: Math.round(method3_salesPerMonth * avgTicket * 100) / 100,
        prediction_inputs: {
          newLast30Days: newSubsLast30Days,
          canceledLast30Days,
          trend,
        },
      },
      {
        prediction_date: new Date().toISOString().slice(0, 10),
        method_name: 'combined',
        predicted_sales_per_month: Math.round(combinedSalesPerMonth * 100) / 100,
        predicted_revenue_per_month: Math.round(combinedSalesPerMonth * avgTicket * 100) / 100,
        prediction_inputs: { methodsUsed: validMethods.length },
      },
    ]

    saveDailyPredictions(predictionsToTrack)
    verifyPastPredictions()

    return response
  } catch (error) {
    console.error('Error in sales-prediction:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
