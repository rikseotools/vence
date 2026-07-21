// lib/api/admin-pending-counts/queries.ts - Queries para conteo de impugnaciones pendientes
import { getDb } from '@/db/client'
import { questionDisputes, psychometricQuestionDisputes } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import type { PendingCountsResponse } from './schemas'

// ============================================
// GET PENDING DISPUTE COUNTS
// ============================================

export async function getPendingDisputeCounts(): Promise<PendingCountsResponse> {
  try {
    const db = getDb()

    const [normalResult, psychometricResult] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(questionDisputes)
        .where(eq(questionDisputes.status, 'pending')),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(psychometricQuestionDisputes)
        .where(eq(psychometricQuestionDisputes.status, 'pending')),
    ])

    const normalCount = normalResult[0]?.count ?? 0
    const psychometricCount = psychometricResult[0]?.count ?? 0

    return {
      success: true,
      impugnaciones: normalCount + psychometricCount,
      detail: {
        normal: normalCount,
        psychometric: psychometricCount,
      },
    }
  } catch (error) {
    console.error('❌ [AdminPendingCounts] Error fetching pending counts:', error)
    throw error
  }
}
