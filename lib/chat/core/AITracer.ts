// lib/chat/core/AITracer.ts
// Sistema de trazabilidad para observabilidad del AI Chat

import { logger } from '../shared/logger'
import type { AITracerInterface, TraceSpanBuilderInterface } from './types'

// ============================================
// Tipos
// ============================================

export type TraceType =
  | 'routing'     // Decisión de qué dominio usar
  | 'domain'      // Procesamiento del dominio
  | 'llm_call'    // Llamada a OpenAI/Claude
  | 'db_query'    // Consulta a BD
  | 'post_process' // Post-procesamiento
  | 'error'       // Error capturado

export interface TraceSpan {
  id: string
  type: TraceType
  startedAt: Date
  endedAt?: Date
  durationMs?: number
  input: Record<string, unknown>
  output: Record<string, unknown>
  metadata: Record<string, unknown>
  success: boolean
  error?: string
  errorStack?: string
  sequenceNumber: number
  parentId?: string
}

export interface RoutingDecision {
  evaluatedDomains: Array<{
    name: string
    priority: number
    canHandle: boolean
    evalTimeMs: number
    reason?: string
  }>
  selectedDomain: string | null
  confidence: number
  // Contexto adicional para análisis completo
  userMessage?: string
  userId?: string | null
  isPremium?: boolean
  userDomain?: string
  conversationLength?: number
  hasQuestionContext?: boolean
  questionContext?: Record<string, unknown> | null
}

export interface DomainProcessData {
  domain: string
  patternDetected?: string
  patternConfidence?: number
  lawsDetected?: string[]
  articlesSearched?: number
}

export interface LLMCallData {
  model: string
  systemPrompt?: string
  userPrompt: string
  messages?: Array<{ role: string; content: string }>
  temperature?: number
  maxTokens?: number
}

export interface LLMResponseData {
  content: string
  tokensIn?: number
  tokensOut?: number
  finishReason?: string
}

export interface DBQueryData {
  operation: string
  table?: string
  filters?: Record<string, unknown>
  query?: string
}

export interface DBQueryResult {
  rowsReturned?: number
  executionTimeMs?: number
  data?: unknown
}

export interface PostProcessData {
  discrepancyCheckEnabled?: boolean
  discrepancyFound?: boolean
  reanalysisTriggered?: boolean
  sourcesCited?: number
}

// ============================================
// Utilidades
// ============================================

function generateId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Sanitiza datos para almacenamiento SIN truncamiento
 * Solo redacta campos sensibles de seguridad
 *
 * NOTA: Los datos se guardan completos para análisis.
 * El INSERT puede ser lento, por eso usamos after() en el route handler.
 */
function sanitizeForStorage(data: unknown, depth = 0): unknown {
  if (data === null || data === undefined) return data

  // Evitar recursión infinita
  if (depth > 20) return '[MAX_DEPTH]'

  // Strings: guardar completos
  if (typeof data === 'string') {
    return data
  }

  // Arrays: guardar completos
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForStorage(item, depth + 1))
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      const keyLower = key.toLowerCase()
      // Solo redactar campos de seguridad críticos
      if (['password', 'token', 'secret', 'apikey', 'api_key', 'authorization'].includes(keyLower)) {
        result[key] = '[REDACTED]'
      } else {
        result[key] = sanitizeForStorage(value, depth + 1)
      }
    }
    return result
  }

  return data
}

// ============================================
// Clase AITracer
// ============================================

export class AITracer implements AITracerInterface {
  private logId: string | null = null
  private spans: TraceSpan[] = []
  private sequence = 0
  private enabled = true
  private parentSpanId: string | null = null

  /**
   * Inicia una nueva traza asociada a un log
   */
  startTrace(logId: string): void {
    this.logId = logId
    this.spans = []
    this.sequence = 0
    this.parentSpanId = null
    logger.debug('Trace started', { domain: 'tracer', logId })
  }

  /**
   * Deshabilita el tracer (útil para tests)
   */
  disable(): void {
    this.enabled = false
  }

  /**
   * Habilita el tracer
   */
  enable(): void {
    this.enabled = true
  }

  /**
   * Obtiene el ID del log actual
   */
  getLogId(): string | null {
    return this.logId
  }

  /**
   * Crea un span de routing
   */
  spanRouting(input?: Partial<RoutingDecision>): TraceSpanBuilder {
    return this.createSpan('routing', input || { evaluatedDomains: [], selectedDomain: null, confidence: 0 })
  }

  /**
   * Crea un span de procesamiento de dominio
   */
  spanDomain(domain: string, input?: Partial<DomainProcessData>): TraceSpanBuilder {
    const parentId = this.parentSpanId
    const builder = this.createSpan('domain', { domain, ...input })
    builder.parentId = parentId

    // Los spans de dominio son padres de los siguientes spans
    if (builder.span) {
      this.parentSpanId = builder.span.id
    }

    return builder
  }

  /**
   * Crea un span de llamada a LLM
   */
  spanLLM(input: LLMCallData | Record<string, unknown>): TraceSpanBuilderInterface {
    return this.createSpan('llm_call', sanitizeForStorage(input) as Record<string, unknown>)
  }

  /**
   * Crea un span de consulta a BD
   */
  spanDB(operation: string, input?: Partial<DBQueryData> | Record<string, unknown>): TraceSpanBuilderInterface {
    return this.createSpan('db_query', { operation, ...input })
  }

  /**
   * Crea un span de post-procesamiento
   */
  spanPostProcess(input?: Partial<PostProcessData> | Record<string, unknown>): TraceSpanBuilderInterface {
    return this.createSpan('post_process', input || {})
  }

  /**
   * Crea un span de error
   */
  spanError(error: Error | string, context?: Record<string, unknown>): TraceSpanBuilderInterface {
    const errorMessage = error instanceof Error ? error.message : error
    const errorStack = error instanceof Error ? error.stack : undefined

    return this.createSpan('error', {
      errorMessage,
      context
    }).setError(errorMessage, errorStack) as TraceSpanBuilderInterface
  }

  /**
   * Crea un span genérico
   */
  private createSpan(type: TraceType, input: Record<string, unknown>): TraceSpanBuilder {
    if (!this.enabled) {
      return new TraceSpanBuilder(null, this)
    }

    this.sequence++
    const span: TraceSpan = {
      id: generateId(),
      type,
      startedAt: new Date(),
      input: sanitizeForStorage(input) as Record<string, unknown>,
      output: {},
      metadata: {},
      success: true,
      sequenceNumber: this.sequence,
      parentId: this.parentSpanId || undefined,
    }

    this.spans.push(span)
    logger.debug(`Span created: ${type}`, { domain: 'tracer', spanId: span.id })

    return new TraceSpanBuilder(span, this)
  }

  /**
   * Obtiene todos los spans
   */
  getSpans(): TraceSpan[] {
    return [...this.spans]
  }

  /**
   * Guarda todos los spans en la base de datos
   * NOTA: Esta operación puede ser lenta con JSON grandes.
   * Se recomienda usar getFlushCallback() con after() en route handlers.
   */
  async flush(): Promise<void> {
    if (!this.enabled || !this.logId || this.spans.length === 0) {
      return
    }

    const spansToSave = this.spans.map(span => ({
      logId: this.logId,
      traceType: span.type,
      startedAt: span.startedAt.toISOString(),
      endedAt: span.endedAt?.toISOString() || null,
      durationMs: span.durationMs || null,
      inputData: span.input,
      outputData: span.output,
      metadata: span.metadata,
      success: span.success,
      errorMessage: span.error || null,
      errorStack: span.errorStack || null,
      sequenceNumber: span.sequenceNumber,
      // parentTraceId debe ser UUID, pero span.parentId es string interno
      // Usamos null - el sequenceNumber ya provee el orden
      parentTraceId: null,
    }))

    try {
      // Importar dinámicamente para evitar dependencias circulares
      const { saveTraces } = await import('@/lib/api/ai-traces/queries')
      await saveTraces(spansToSave)

      logger.info(`Flushed ${spansToSave.length} traces`, {
        domain: 'tracer',
        logId: this.logId,
        spanCount: spansToSave.length
      })
    } catch (error) {
      // No fallar si no podemos guardar los traces
      logger.error('Failed to flush traces', error, { domain: 'tracer' })
    }
  }

  /**
   * Retorna una función de flush para usar con after() de Next.js
   * Esto permite ejecutar el INSERT después de enviar la respuesta
   */
  getFlushCallback(): () => Promise<void> {
    return () => this.flush()
  }

  /**
   * Limpia el tracer para reutilización
   */
  reset(): void {
    this.logId = null
    this.spans = []
    this.sequence = 0
    this.parentSpanId = null
  }
}

// ============================================
// Builder para spans
// ============================================

export class TraceSpanBuilder implements TraceSpanBuilderInterface {
  span: TraceSpan | null
  parentId: string | null = null
  private tracer: AITracer

  constructor(span: TraceSpan | null, tracer: AITracer) {
    this.span = span
    this.tracer = tracer
  }

  /**
   * Establece los datos de salida
   */
  setOutput(output: Record<string, unknown>): TraceSpanBuilderInterface {
    if (this.span) {
      this.span.output = sanitizeForStorage(output) as Record<string, unknown>
    }
    return this
  }

  /**
   * Añade datos al output existente
   */
  addOutput(key: string, value: unknown): TraceSpanBuilderInterface {
    if (this.span) {
      this.span.output[key] = sanitizeForStorage(value)
    }
    return this
  }

  /**
   * Establece metadata
   */
  setMetadata(metadata: Record<string, unknown>): TraceSpanBuilderInterface {
    if (this.span) {
      this.span.metadata = { ...this.span.metadata, ...metadata }
    }
    return this
  }

  /**
   * Añade un campo de metadata
   */
  addMetadata(key: string, value: unknown): TraceSpanBuilderInterface {
    if (this.span) {
      this.span.metadata[key] = value
    }
    return this
  }

  /**
   * Marca como error
   */
  setError(message: string, stack?: string): TraceSpanBuilderInterface {
    if (this.span) {
      this.span.success = false
      this.span.error = message
      this.span.errorStack = stack
    }
    return this
  }

  /**
   * Finaliza el span
   */
  end(): TraceSpanBuilderInterface {
    if (this.span && !this.span.endedAt) {
      this.span.endedAt = new Date()
      this.span.durationMs = this.span.endedAt.getTime() - this.span.startedAt.getTime()

      if (this.parentId) {
        this.span.parentId = this.parentId
      }

      logger.debug(`Span ended: ${this.span.type}`, {
        domain: 'tracer',
        spanId: this.span.id,
        durationMs: this.span.durationMs
      })
    }
    return this
  }

  /**
   * Obtiene el ID del span
   */
  getId(): string | null {
    return this.span?.id || null
  }
}

// ============================================
// Singleton global (opcional)
// ============================================

let globalTracer: AITracer | null = null

/**
 * Obtiene el tracer global
 */
export function getTracer(): AITracer {
  if (!globalTracer) {
    globalTracer = new AITracer()
  }
  return globalTracer
}

/**
 * Crea un nuevo tracer (para uso por request)
 */
export function createTracer(): AITracer {
  return new AITracer()
}

/**
 * Resetea el tracer global
 */
export function resetTracer(): void {
  globalTracer = null
}
