// lib/api/admin-validation-errors/queries.ts
import { getDb } from '@/db/client'
import { validationErrorLogs } from '@/db/schema'
import { desc, gte, eq, sql, and, count, isNull, inArray } from 'drizzle-orm'
import type { ValidationErrorsQuery, ValidationErrorsResponse, ValidationErrorsSummary, ValidationErrorEntry } from './schemas'

export async function getValidationErrors(params: ValidationErrorsQuery): Promise<ValidationErrorsResponse> {
  const db = getDb()
  const cutoffDate = new Date(Date.now() - params.timeRange * 24 * 60 * 60 * 1000).toISOString()

  // Build where conditions
  const conditions = [gte(validationErrorLogs.createdAt, cutoffDate)]

  if (params.endpoint !== 'all') {
    conditions.push(eq(validationErrorLogs.endpoint, params.endpoint))
  }
  if (params.errorType !== 'all') {
    conditions.push(eq(validationErrorLogs.errorType, params.errorType))
  }
  if (params.userId) {
    conditions.push(eq(validationErrorLogs.userId, params.userId))
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions)

  // Fetch errors + summary + unreviewed count in parallel
  const [errors, summaryRows, unreviewed] = await Promise.all([
    db
      .select({
        id: validationErrorLogs.id,
        endpoint: validationErrorLogs.endpoint,
        errorType: validationErrorLogs.errorType,
        errorMessage: validationErrorLogs.errorMessage,
        userId: validationErrorLogs.userId,
        questionId: validationErrorLogs.questionId,
        testId: validationErrorLogs.testId,
        deployVersion: validationErrorLogs.deployVersion,
        vercelRegion: validationErrorLogs.vercelRegion,
        httpStatus: validationErrorLogs.httpStatus,
        durationMs: validationErrorLogs.durationMs,
        userAgent: validationErrorLogs.userAgent,
        severity: validationErrorLogs.severity,
        createdAt: validationErrorLogs.createdAt,
        reviewedAt: validationErrorLogs.reviewedAt,
      })
      .from(validationErrorLogs)
      .where(whereClause)
      .orderBy(desc(validationErrorLogs.createdAt))
      .limit(params.limit),

    db
      .select({
        endpoint: validationErrorLogs.endpoint,
        errorType: validationErrorLogs.errorType,
        deployVersion: validationErrorLogs.deployVersion,
        totalCount: count(),
        uniqueUsers: sql<number>`count(distinct ${validationErrorLogs.userId})`,
        avgDuration: sql<number>`avg(${validationErrorLogs.durationMs})`,
      })
      .from(validationErrorLogs)
      .where(gte(validationErrorLogs.createdAt, cutoffDate))
      .groupBy(
        validationErrorLogs.endpoint,
        validationErrorLogs.errorType,
        validationErrorLogs.deployVersion,
      ),

    // Solo contar critical no revisados (para badge)
    db
      .select({ count: count() })
      .from(validationErrorLogs)
      .where(and(
        gte(validationErrorLogs.createdAt, cutoffDate),
        isNull(validationErrorLogs.reviewedAt),
        eq(validationErrorLogs.severity, 'critical'),
      )),
  ])

  // Build summary from aggregated rows
  const summary = buildSummary(summaryRows)

  return {
    errors: errors as unknown as ValidationErrorEntry[],
    summary,
    unreviewedCount: Number(unreviewed[0]?.count ?? 0),
    timeRange: params.timeRange,
    timestamp: new Date().toISOString(),
  }
}

function buildSummary(
  rows: {
    endpoint: string
    errorType: string
    deployVersion: string | null
    totalCount: number
    uniqueUsers: number
    avgDuration: number | null
  }[],
): ValidationErrorsSummary {
  const byEndpoint: Record<string, number> = {}
  const byErrorType: Record<string, number> = {}
  const byDeployVersion: Record<string, number> = {}
  let totalErrors = 0
  let totalDuration = 0
  let durationCount = 0
  const uniqueUserSet = new Set<number>()

  for (const row of rows) {
    const cnt = Number(row.totalCount)
    totalErrors += cnt

    byEndpoint[row.endpoint] = (byEndpoint[row.endpoint] || 0) + cnt
    byErrorType[row.errorType] = (byErrorType[row.errorType] || 0) + cnt

    const version = row.deployVersion || 'unknown'
    byDeployVersion[version] = (byDeployVersion[version] || 0) + cnt

    if (row.avgDuration != null) {
      totalDuration += row.avgDuration * cnt
      durationCount += cnt
    }

    uniqueUserSet.add(Number(row.uniqueUsers))
  }

  // Approximate unique users (sum of per-group uniques, may overcount)
  // For exact count we'd need a separate query, but this is good enough for admin overview
  let affectedUsers = 0
  for (const row of rows) {
    affectedUsers = Math.max(affectedUsers, Number(row.uniqueUsers))
  }

  return {
    totalErrors,
    byEndpoint,
    byErrorType,
    byDeployVersion,
    affectedUsers,
    avgDurationMs: durationCount > 0 ? Math.round(totalDuration / durationCount) : null,
  }
}

export async function markErrorsReviewed(ids: string[]): Promise<number> {
  const db = getDb()
  await db
    .update(validationErrorLogs)
    .set({ reviewedAt: new Date().toISOString() })
    .where(and(inArray(validationErrorLogs.id, ids), isNull(validationErrorLogs.reviewedAt)))
  return ids.length
}
