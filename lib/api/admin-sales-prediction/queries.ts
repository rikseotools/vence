// lib/api/admin-sales-prediction/queries.ts - Queries para predicciones de ventas
import { getDb } from '@/db/client'
import {
  userProfiles,
  conversionEvents,
  cancellationFeedback,
  dailyQuestionUsage,
  userSubscriptions,
  predictionTracking,
  predictionAccuracyByMethod,
  predictionHistory,
} from '@/db/schema'
import { eq, gte, lt, and, isNull, sql } from 'drizzle-orm'

// ============================================
// GET REGISTRATION DATA (all users with dates)
// ============================================

export async function getRegistrationData() {
  const db = getDb()
  return db
    .select({
      id: userProfiles.id,
      createdAt: userProfiles.createdAt,
      planType: userProfiles.planType,
    })
    .from(userProfiles)
}

// ============================================
// GET CONVERSION DATA (payment_completed events)
// ============================================

export async function getConversionData() {
  const db = getDb()
  return db
    .select({
      userId: conversionEvents.userId,
      createdAt: conversionEvents.createdAt,
      eventData: conversionEvents.eventData,
    })
    .from(conversionEvents)
    .where(eq(conversionEvents.eventType, 'payment_completed'))
    .orderBy(sql`${conversionEvents.createdAt} DESC`)
}

// ============================================
// GET CANCELLATION DATA
// ============================================

export async function getCancellationData() {
  const db = getDb()
  try {
    return await db
      .select({
        userId: cancellationFeedback.userId,
        createdAt: cancellationFeedback.createdAt,
        refundAmountCents: cancellationFeedback.refundAmountCents,
      })
      .from(cancellationFeedback)
  } catch {
    return []
  }
}

// ============================================
// GET ACTIVE USERS DATA (daily_question_usage)
// ============================================

export async function getActiveUsersData(sinceDate: string) {
  const db = getDb()
  return db
    .select({ userId: dailyQuestionUsage.userId })
    .from(dailyQuestionUsage)
    .where(gte(dailyQuestionUsage.usageDate, sinceDate))
}

// ============================================
// GET MANUAL SUBSCRIPTIONS (no stripe_subscription_id)
// ============================================

export async function getManualSubscriptions() {
  const db = getDb()
  return db
    .select()
    .from(userSubscriptions)
    .where(
      and(
        eq(userSubscriptions.status, 'active'),
        isNull(userSubscriptions.stripeSubscriptionId)
      )
    )
}

// ============================================
// SAVE DAILY PREDICTIONS (upsert)
// ============================================

export async function saveDailyPredictions(records: Array<{
  prediction_date: string
  method_name: string
  predicted_sales_per_month: number
  predicted_revenue_per_month: number
  prediction_inputs?: Record<string, unknown>
}>) {
  try {
    const db = getDb()
    for (const record of records) {
      await db
        .insert(predictionTracking)
        .values({
          predictionDate: record.prediction_date,
          methodName: record.method_name,
          predictedSalesPerMonth: String(record.predicted_sales_per_month),
          predictedRevenuePerMonth: String(record.predicted_revenue_per_month),
          predictionInputs: record.prediction_inputs ?? {},
        })
        .onConflictDoUpdate({
          target: [predictionTracking.predictionDate, predictionTracking.methodName],
          set: {
            predictedSalesPerMonth: String(record.predicted_sales_per_month),
            predictedRevenuePerMonth: String(record.predicted_revenue_per_month),
            predictionInputs: record.prediction_inputs ?? {},
            updatedAt: new Date().toISOString(),
          },
        })
    }
  } catch (err) {
    console.log('Error guardando predicciones:', (err as Error).message)
  }
}

// ============================================
// GET PREDICTION ACCURACY
// ============================================

export async function getPredictionAccuracy() {
  try {
    const db = getDb()

    const accuracy = await db.select().from(predictionAccuracyByMethod)
    const history = await db.select().from(predictionHistory).limit(10)

    return {
      byMethod: accuracy || [],
      recentHistory: history || [],
      hasData: (accuracy?.length || 0) > 0,
    }
  } catch {
    return null
  }
}

// ============================================
// VERIFY PAST PREDICTIONS (compare with actual after N days)
// ============================================

export async function getUnverifiedPredictions(targetDate: string) {
  const db = getDb()
  return db
    .select()
    .from(predictionTracking)
    .where(
      and(
        eq(predictionTracking.predictionDate, targetDate),
        isNull(predictionTracking.verifiedAt)
      )
    )
}

export async function getActualSalesInPeriod(startDate: string, endDate: string) {
  const db = getDb()
  return db
    .select({
      userId: conversionEvents.userId,
      eventData: conversionEvents.eventData,
    })
    .from(conversionEvents)
    .where(
      and(
        eq(conversionEvents.eventType, 'payment_completed'),
        gte(conversionEvents.createdAt, startDate),
        lt(conversionEvents.createdAt, endDate)
      )
    )
}

export async function updatePredictionVerification(
  predictionId: string,
  actualSales: number,
  actualRevenue: number,
  errorPercent: number | null,
  absoluteError: number | null
) {
  const db = getDb()
  await db
    .update(predictionTracking)
    .set({
      actualSales,
      actualRevenue: actualRevenue != null ? String(actualRevenue) : null,
      errorPercent: errorPercent != null ? String(Math.round(errorPercent * 100) / 100) : null,
      absoluteError: absoluteError != null ? String(Math.round(absoluteError * 100) / 100) : null,
      verifiedAt: new Date().toISOString(),
    })
    .where(eq(predictionTracking.id, predictionId))
}

// ============================================
// GET PENDING SETTLEMENTS (for stripe-fees-summary inline usage)
// ============================================

export async function getPendingSettlements() {
  const db = getDb()
  const { paymentSettlements } = await import('@/db/schema')
  return db
    .select()
    .from(paymentSettlements)
    .where(eq(paymentSettlements.manuelConfirmedReceived, false))
}
