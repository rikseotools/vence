// lib/api/ai-traces/schemas.ts
// Schemas Zod para validación de AI Chat Traces

import { z } from 'zod'

// ============================================
// Tipos de trace válidos
// ============================================

export const traceTypeSchema = z.enum([
  'routing',
  'domain',
  'llm_call',
  'db_query',
  'post_process',
  'error'
])

export type TraceType = z.infer<typeof traceTypeSchema>

// ============================================
// Schema para crear un trace
// ============================================

export const createTraceSchema = z.object({
  logId: z.string().uuid(),
  traceType: traceTypeSchema,
  startedAt: z.string(),
  endedAt: z.string().nullable().optional(),
  durationMs: z.number().int().nullable().optional(),
  inputData: z.record(z.string(), z.unknown()).default({}),
  outputData: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
  success: z.boolean().default(true),
  errorMessage: z.string().nullable().optional(),
  errorStack: z.string().nullable().optional(),
  sequenceNumber: z.number().int(),
  parentTraceId: z.string().uuid().nullable().optional(),
})

export type CreateTraceInput = z.infer<typeof createTraceSchema>

// ============================================
// Schema para trace guardado
// ============================================

export const traceSchema = createTraceSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string(),
})

export type Trace = z.infer<typeof traceSchema>

// ============================================
// Schema para filtros de búsqueda
// ============================================

export const traceFiltersSchema = z.object({
  logId: z.string().uuid().optional(),
  traceType: traceTypeSchema.optional(),
  success: z.boolean().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(100),
  offset: z.number().int().min(0).default(0),
})

export type TraceFilters = z.infer<typeof traceFiltersSchema>

// ============================================
// Schema para resumen de trace
// ============================================

export const traceSummarySchema = z.object({
  logId: z.string().uuid(),
  message: z.string(),
  createdAt: z.string(),
  feedback: z.string().nullable(),
  hadError: z.boolean(),
  hadDiscrepancy: z.boolean(),
  traceCount: z.number().int(),
  totalDurationMs: z.number().int().nullable(),
  traceTypes: z.array(z.string()),
  errorCount: z.number().int(),
  modelUsed: z.string().nullable(),
  totalTokensIn: z.number().int().nullable(),
  totalTokensOut: z.number().int().nullable(),
})

export type TraceSummary = z.infer<typeof traceSummarySchema>

// ============================================
// Schema para árbol de trace
// ============================================

export const traceTreeNodeSchema: z.ZodType<TraceTreeNode> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    type: traceTypeSchema,
    startedAt: z.string(),
    endedAt: z.string().nullable(),
    durationMs: z.number().int().nullable(),
    input: z.record(z.string(), z.unknown()),
    output: z.record(z.string(), z.unknown()),
    metadata: z.record(z.string(), z.unknown()),
    success: z.boolean(),
    error: z.string().nullable(),
    sequenceNumber: z.number().int(),
    children: z.array(traceTreeNodeSchema),
  })
)

export interface TraceTreeNode {
  id: string
  type: TraceType
  startedAt: string
  endedAt: string | null
  durationMs: number | null
  input: Record<string, unknown>
  output: Record<string, unknown>
  metadata: Record<string, unknown>
  success: boolean
  error: string | null
  sequenceNumber: number
  children: TraceTreeNode[]
}

// ============================================
// Schema para request de API admin
// ============================================

export const getTracesRequestSchema = z.object({
  logId: z.string().uuid().optional(),
  type: traceTypeSchema.optional(),
  hasErrors: z.boolean().optional(),
  hasFeedback: z.enum(['positive', 'negative', 'any']).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  orderBy: z.enum(['created_at', 'duration_ms', 'trace_count']).default('created_at'),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
})

export type GetTracesRequest = z.infer<typeof getTracesRequestSchema>

// ============================================
// Schema para respuesta de lista
// ============================================

export const tracesListResponseSchema = z.object({
  traces: z.array(traceSummarySchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  hasMore: z.boolean(),
})

export type TracesListResponse = z.infer<typeof tracesListResponseSchema>

// ============================================
// Schema para detalle de un log con sus traces
// ============================================

export const traceDetailResponseSchema = z.object({
  log: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid().nullable(),
    message: z.string(),
    fullResponse: z.string().nullable(),
    responseTimeMs: z.number().int().nullable(),
    tokensUsed: z.number().int().nullable(),
    feedback: z.string().nullable(),
    feedbackComment: z.string().nullable(),
    hadError: z.boolean(),
    hadDiscrepancy: z.boolean(),
    aiSuggestedAnswer: z.string().nullable(),
    dbAnswer: z.string().nullable(),
    detectedLaws: z.array(z.unknown()),
    questionContextLaw: z.string().nullable(),
    createdAt: z.string(),
  }),
  traces: z.array(traceSchema),
  tree: z.array(traceTreeNodeSchema),
  stats: z.object({
    totalDurationMs: z.number().int(),
    llmCallCount: z.number().int(),
    dbQueryCount: z.number().int(),
    errorCount: z.number().int(),
    totalTokensIn: z.number().int(),
    totalTokensOut: z.number().int(),
    dominiosEvaluados: z.number().int(),
    dominioSeleccionado: z.string().nullable(),
  }),
})

export type TraceDetailResponse = z.infer<typeof traceDetailResponseSchema>

// ============================================
// Schema para analytics de traces
// ============================================

export const traceAnalyticsSchema = z.object({
  period: z.string(),
  totalLogs: z.number().int(),
  totalTraces: z.number().int(),
  avgResponseTimeMs: z.number(),
  avgTracesPerLog: z.number(),
  domainDistribution: z.record(z.string(), z.number().int()),
  traceTypeDistribution: z.record(z.string(), z.number().int()),
  errorRate: z.number(),
  feedbackPositiveRate: z.number(),
  topErrors: z.array(z.object({
    message: z.string(),
    count: z.number().int(),
  })),
  tokenUsage: z.object({
    totalIn: z.number().int(),
    totalOut: z.number().int(),
    avgPerRequest: z.number(),
  }),
})

export type TraceAnalytics = z.infer<typeof traceAnalyticsSchema>
