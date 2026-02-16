// lib/api/ai-traces/queries.ts
// Queries Drizzle para AI Chat Traces

import { getDb, getTraceDb } from '@/db/client'
import { aiChatTraces, aiChatLogs } from '@/db/schema'
import { eq, and, desc, asc, sql, isNull, isNotNull, lte, gte, inArray } from 'drizzle-orm'
import type { CreateTraceInput, TraceFilters, TraceTreeNode } from './schemas'

// ============================================
// GUARDAR TRACES
// ============================================

export interface SaveTraceInput {
  logId: string | null
  traceType: string
  startedAt: string
  endedAt: string | null
  durationMs: number | null
  inputData: Record<string, unknown>
  outputData: Record<string, unknown>
  metadata: Record<string, unknown>
  success: boolean
  errorMessage: string | null
  errorStack: string | null
  sequenceNumber: number
  parentTraceId: string | null
}

/**
 * Guarda múltiples traces en la BD
 * Inserta uno a uno con cliente dedicado (sin statement_timeout)
 * para evitar fallos en el contexto after() de Vercel
 */
export async function saveTraces(traces: SaveTraceInput[]): Promise<void> {
  if (traces.length === 0) return

  const db = getTraceDb()

  for (const trace of traces) {
    try {
      await db.insert(aiChatTraces).values({
        logId: trace.logId,
        traceType: trace.traceType,
        startedAt: trace.startedAt,
        endedAt: trace.endedAt,
        durationMs: trace.durationMs,
        inputData: trace.inputData,
        outputData: trace.outputData,
        metadata: trace.metadata,
        success: trace.success,
        errorMessage: trace.errorMessage,
        errorStack: trace.errorStack,
        sequenceNumber: trace.sequenceNumber,
        parentTraceId: trace.parentTraceId,
      })
    } catch (error) {
      // Log pero no fallar - que los demás traces se sigan guardando
      console.error(`[ai-traces] Error inserting trace seq=${trace.sequenceNumber}:`, error)
    }
  }
}

/**
 * Guarda un solo trace
 */
export async function saveTrace(trace: SaveTraceInput): Promise<string> {
  const db = getDb()

  const result = await db.insert(aiChatTraces).values({
    logId: trace.logId,
    traceType: trace.traceType,
    startedAt: trace.startedAt,
    endedAt: trace.endedAt,
    durationMs: trace.durationMs,
    inputData: trace.inputData,
    outputData: trace.outputData,
    metadata: trace.metadata,
    success: trace.success,
    errorMessage: trace.errorMessage,
    errorStack: trace.errorStack,
    sequenceNumber: trace.sequenceNumber,
    parentTraceId: trace.parentTraceId,
  }).returning({ id: aiChatTraces.id })

  return result[0].id
}

// ============================================
// OBTENER TRACES
// ============================================

/**
 * Obtiene traces por log ID
 */
export async function getTracesByLogId(logId: string) {
  const db = getDb()

  return db
    .select()
    .from(aiChatTraces)
    .where(eq(aiChatTraces.logId, logId))
    .orderBy(asc(aiChatTraces.sequenceNumber))
}

/**
 * Obtiene un trace por ID
 */
export async function getTraceById(id: string) {
  const db = getDb()

  const result = await db
    .select()
    .from(aiChatTraces)
    .where(eq(aiChatTraces.id, id))
    .limit(1)

  return result[0] || null
}

// ============================================
// LISTA CON FILTROS (ADMIN)
// ============================================

export interface TraceSummaryRow {
  logId: string
  message: string
  createdAt: string | null
  feedback: string | null
  hadError: boolean | null
  hadDiscrepancy: boolean | null
  traceCount: number
  totalDurationMs: number | null
  errorCount: number
  modelUsed: string | null
  selectedDomain: string | null
}

export interface GetTracesListParams {
  type?: string
  hasErrors?: boolean
  hasFeedback?: 'positive' | 'negative' | 'any'
  fromDate?: string
  toDate?: string
  limit?: number
  offset?: number
  orderBy?: 'created_at' | 'duration_ms' | 'trace_count'
  orderDir?: 'asc' | 'desc'
}

/**
 * Obtiene lista de logs con resumen de traces para admin
 */
export async function getTracesList(params: GetTracesListParams): Promise<{
  items: TraceSummaryRow[]
  total: number
}> {
  const db = getDb()

  const {
    type,
    hasErrors,
    hasFeedback,
    fromDate,
    toDate,
    limit = 50,
    offset = 0,
    orderBy = 'created_at',
    orderDir = 'desc'
  } = params

  // Subquery para obtener stats de traces por log
  const traceStats = db
    .select({
      logId: aiChatTraces.logId,
      traceCount: sql<number>`count(*)::int`.as('trace_count'),
      totalDurationMs: sql<number>`sum(${aiChatTraces.durationMs})::int`.as('total_duration_ms'),
      errorCount: sql<number>`count(*) filter (where ${aiChatTraces.success} = false)::int`.as('error_count'),
      modelUsed: sql<string>`max(${aiChatTraces.metadata}->>'model')`.as('model_used'),
      selectedDomain: sql<string>`max(case when ${aiChatTraces.traceType} = 'routing' then ${aiChatTraces.outputData}->>'selectedDomain' end)`.as('selected_domain'),
    })
    .from(aiChatTraces)
    .where(isNotNull(aiChatTraces.logId))
    .groupBy(aiChatTraces.logId)
    .as('trace_stats')

  // Query principal con join
  let baseQuery = db
    .select({
      logId: aiChatLogs.id,
      message: aiChatLogs.message,
      createdAt: aiChatLogs.createdAt,
      feedback: aiChatLogs.feedback,
      hadError: aiChatLogs.hadError,
      hadDiscrepancy: aiChatLogs.hadDiscrepancy,
      traceCount: sql<number>`coalesce(${traceStats.traceCount}, 0)`.as('trace_count'),
      totalDurationMs: traceStats.totalDurationMs,
      errorCount: sql<number>`coalesce(${traceStats.errorCount}, 0)`.as('error_count'),
      modelUsed: traceStats.modelUsed,
      selectedDomain: traceStats.selectedDomain,
    })
    .from(aiChatLogs)
    .leftJoin(traceStats, eq(aiChatLogs.id, traceStats.logId))
    .$dynamic()

  // Aplicar filtros
  const conditions = []

  if (hasErrors === true) {
    conditions.push(eq(aiChatLogs.hadError, true))
  } else if (hasErrors === false) {
    conditions.push(eq(aiChatLogs.hadError, false))
  }

  if (hasFeedback === 'positive') {
    conditions.push(eq(aiChatLogs.feedback, 'positive'))
  } else if (hasFeedback === 'negative') {
    conditions.push(eq(aiChatLogs.feedback, 'negative'))
  } else if (hasFeedback === 'any') {
    conditions.push(isNotNull(aiChatLogs.feedback))
  }

  if (fromDate) {
    conditions.push(gte(aiChatLogs.createdAt, fromDate))
  }

  if (toDate) {
    conditions.push(lte(aiChatLogs.createdAt, toDate))
  }

  if (conditions.length > 0) {
    baseQuery = baseQuery.where(and(...conditions))
  }

  // Ordenamiento
  const orderColumn = orderBy === 'duration_ms'
    ? traceStats.totalDurationMs
    : orderBy === 'trace_count'
      ? sql`trace_count`
      : aiChatLogs.createdAt

  baseQuery = baseQuery.orderBy(
    orderDir === 'asc' ? asc(orderColumn) : desc(orderColumn)
  )

  // Paginación
  baseQuery = baseQuery.limit(limit).offset(offset)

  const items = await baseQuery

  // Contar total (sin paginación)
  const countQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiChatLogs)
    .$dynamic()

  if (conditions.length > 0) {
    const countResult = await countQuery.where(and(...conditions))
    return { items, total: countResult[0]?.count || 0 }
  }

  const countResult = await countQuery
  return { items, total: countResult[0]?.count || 0 }
}

// ============================================
// DETALLE DE UN LOG CON TRACES
// ============================================

export interface LogWithTraces {
  log: {
    id: string
    userId: string | null
    message: string
    fullResponse: string | null
    responseTimeMs: number | null
    tokensUsed: number | null
    feedback: string | null
    feedbackComment: string | null
    hadError: boolean | null
    hadDiscrepancy: boolean | null
    aiSuggestedAnswer: string | null
    dbAnswer: string | null
    detectedLaws: unknown
    questionContextLaw: string | null
    createdAt: string | null
  }
  traces: Array<{
    id: string
    traceType: string
    startedAt: string | null
    endedAt: string | null
    durationMs: number | null
    inputData: unknown
    outputData: unknown
    metadata: unknown
    success: boolean | null
    errorMessage: string | null
    sequenceNumber: number
    parentTraceId: string | null
  }>
}

/**
 * Obtiene el detalle completo de un log con sus traces
 */
export async function getLogWithTraces(logId: string): Promise<LogWithTraces | null> {
  const db = getDb()

  // Obtener el log
  const logResult = await db
    .select({
      id: aiChatLogs.id,
      userId: aiChatLogs.userId,
      message: aiChatLogs.message,
      fullResponse: aiChatLogs.fullResponse,
      responseTimeMs: aiChatLogs.responseTimeMs,
      tokensUsed: aiChatLogs.tokensUsed,
      feedback: aiChatLogs.feedback,
      feedbackComment: aiChatLogs.feedbackComment,
      hadError: aiChatLogs.hadError,
      hadDiscrepancy: aiChatLogs.hadDiscrepancy,
      aiSuggestedAnswer: aiChatLogs.aiSuggestedAnswer,
      dbAnswer: aiChatLogs.dbAnswer,
      detectedLaws: aiChatLogs.detectedLaws,
      questionContextLaw: aiChatLogs.questionContextLaw,
      createdAt: aiChatLogs.createdAt,
    })
    .from(aiChatLogs)
    .where(eq(aiChatLogs.id, logId))
    .limit(1)

  if (logResult.length === 0) {
    return null
  }

  // Obtener traces
  const traces = await db
    .select({
      id: aiChatTraces.id,
      traceType: aiChatTraces.traceType,
      startedAt: aiChatTraces.startedAt,
      endedAt: aiChatTraces.endedAt,
      durationMs: aiChatTraces.durationMs,
      inputData: aiChatTraces.inputData,
      outputData: aiChatTraces.outputData,
      metadata: aiChatTraces.metadata,
      success: aiChatTraces.success,
      errorMessage: aiChatTraces.errorMessage,
      sequenceNumber: aiChatTraces.sequenceNumber,
      parentTraceId: aiChatTraces.parentTraceId,
    })
    .from(aiChatTraces)
    .where(eq(aiChatTraces.logId, logId))
    .orderBy(asc(aiChatTraces.sequenceNumber))

  return {
    log: logResult[0],
    traces,
  }
}

// ============================================
// CONSTRUIR ÁRBOL DE TRACES
// ============================================

/**
 * Convierte una lista plana de traces en un árbol
 */
export function buildTraceTree(traces: Array<{
  id: string
  traceType: string
  startedAt: string | null
  endedAt: string | null
  durationMs: number | null
  inputData: unknown
  outputData: unknown
  metadata: unknown
  success: boolean | null
  errorMessage: string | null
  sequenceNumber: number
  parentTraceId: string | null
}>): TraceTreeNode[] {
  const nodeMap = new Map<string, TraceTreeNode>()
  const roots: TraceTreeNode[] = []

  // Crear nodos
  for (const trace of traces) {
    const node: TraceTreeNode = {
      id: trace.id,
      type: trace.traceType as TraceTreeNode['type'],
      startedAt: trace.startedAt || new Date().toISOString(),
      endedAt: trace.endedAt,
      durationMs: trace.durationMs,
      input: (trace.inputData || {}) as Record<string, unknown>,
      output: (trace.outputData || {}) as Record<string, unknown>,
      metadata: (trace.metadata || {}) as Record<string, unknown>,
      success: trace.success ?? true,
      error: trace.errorMessage,
      sequenceNumber: trace.sequenceNumber,
      children: [],
    }
    nodeMap.set(trace.id, node)
  }

  // Construir relaciones padre-hijo
  for (const trace of traces) {
    const node = nodeMap.get(trace.id)
    if (!node) continue

    if (trace.parentTraceId) {
      const parent = nodeMap.get(trace.parentTraceId)
      if (parent) {
        parent.children.push(node)
      } else {
        // Si no encontramos el padre, es un root
        roots.push(node)
      }
    } else {
      roots.push(node)
    }
  }

  // Ordenar children por sequenceNumber
  for (const node of nodeMap.values()) {
    node.children.sort((a, b) => a.sequenceNumber - b.sequenceNumber)
  }

  return roots.sort((a, b) => a.sequenceNumber - b.sequenceNumber)
}

// ============================================
// ANALYTICS
// ============================================

export interface TraceAnalyticsResult {
  totalLogs: number
  totalTraces: number
  avgResponseTimeMs: number
  avgTracesPerLog: number
  domainDistribution: Record<string, number>
  traceTypeDistribution: Record<string, number>
  errorRate: number
  feedbackPositiveRate: number
  tokenUsage: {
    totalIn: number
    totalOut: number
    avgPerRequest: number
  }
}

/**
 * Obtiene analytics de traces para un período
 */
export async function getTraceAnalytics(
  fromDate: string,
  toDate: string
): Promise<TraceAnalyticsResult> {
  const db = getDb()

  // Stats de logs
  const logStats = await db
    .select({
      totalLogs: sql<number>`count(*)::int`,
      avgResponseTimeMs: sql<number>`avg(${aiChatLogs.responseTimeMs})::int`,
      positiveCount: sql<number>`count(*) filter (where ${aiChatLogs.feedback} = 'positive')::int`,
      negativeCount: sql<number>`count(*) filter (where ${aiChatLogs.feedback} = 'negative')::int`,
      errorCount: sql<number>`count(*) filter (where ${aiChatLogs.hadError} = true)::int`,
    })
    .from(aiChatLogs)
    .where(and(
      gte(aiChatLogs.createdAt, fromDate),
      lte(aiChatLogs.createdAt, toDate)
    ))

  // Stats de traces
  const traceStats = await db
    .select({
      totalTraces: sql<number>`count(*)::int`,
      totalTokensIn: sql<number>`sum((${aiChatTraces.metadata}->>'tokensIn')::int)::int`,
      totalTokensOut: sql<number>`sum((${aiChatTraces.metadata}->>'tokensOut')::int)::int`,
    })
    .from(aiChatTraces)
    .where(and(
      gte(aiChatTraces.createdAt, fromDate),
      lte(aiChatTraces.createdAt, toDate)
    ))

  // Distribución por tipo de trace
  const traceTypeResults = await db
    .select({
      traceType: aiChatTraces.traceType,
      count: sql<number>`count(*)::int`,
    })
    .from(aiChatTraces)
    .where(and(
      gte(aiChatTraces.createdAt, fromDate),
      lte(aiChatTraces.createdAt, toDate)
    ))
    .groupBy(aiChatTraces.traceType)

  // Distribución por dominio
  const domainResults = await db
    .select({
      domain: sql<string>`${aiChatTraces.outputData}->>'selectedDomain'`.as('domain'),
      count: sql<number>`count(*)::int`,
    })
    .from(aiChatTraces)
    .where(and(
      eq(aiChatTraces.traceType, 'routing'),
      gte(aiChatTraces.createdAt, fromDate),
      lte(aiChatTraces.createdAt, toDate)
    ))
    .groupBy(sql`${aiChatTraces.outputData}->>'selectedDomain'`)

  const totalLogs = logStats[0]?.totalLogs || 0
  const totalTraces = traceStats[0]?.totalTraces || 0
  const positiveCount = logStats[0]?.positiveCount || 0
  const negativeCount = logStats[0]?.negativeCount || 0
  const errorCount = logStats[0]?.errorCount || 0
  const totalFeedback = positiveCount + negativeCount

  return {
    totalLogs,
    totalTraces,
    avgResponseTimeMs: logStats[0]?.avgResponseTimeMs || 0,
    avgTracesPerLog: totalLogs > 0 ? totalTraces / totalLogs : 0,
    domainDistribution: Object.fromEntries(
      domainResults
        .filter(r => r.domain)
        .map(r => [r.domain, r.count])
    ),
    traceTypeDistribution: Object.fromEntries(
      traceTypeResults.map(r => [r.traceType, r.count])
    ),
    errorRate: totalLogs > 0 ? errorCount / totalLogs : 0,
    feedbackPositiveRate: totalFeedback > 0 ? positiveCount / totalFeedback : 0,
    tokenUsage: {
      totalIn: traceStats[0]?.totalTokensIn || 0,
      totalOut: traceStats[0]?.totalTokensOut || 0,
      avgPerRequest: totalLogs > 0
        ? ((traceStats[0]?.totalTokensIn || 0) + (traceStats[0]?.totalTokensOut || 0)) / totalLogs
        : 0,
    },
  }
}

// ============================================
// LIMPIEZA
// ============================================

/**
 * Elimina traces antiguos (para mantenimiento)
 */
export async function deleteOldTraces(olderThanDays: number): Promise<number> {
  const db = getDb()

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

  const result = await db
    .delete(aiChatTraces)
    .where(lte(aiChatTraces.createdAt, cutoffDate.toISOString()))
    .returning({ id: aiChatTraces.id })

  return result.length
}
