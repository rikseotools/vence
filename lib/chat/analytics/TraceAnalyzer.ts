// lib/chat/analytics/TraceAnalyzer.ts
// Analizador de traces para auto-mejora del sistema AI

import { getDb } from '@/db/client'
import { aiChatLogs, aiChatTraces } from '@/db/schema'
import { eq, and, desc, sql, gte, lte, isNotNull } from 'drizzle-orm'
import { logger } from '../shared/logger'

// ============================================
// TIPOS
// ============================================

export interface InsightReport {
  period: {
    from: Date
    to: Date
  }
  summary: {
    totalInteractions: number
    feedbackPositiveRate: number
    feedbackNegativeRate: number
    errorRate: number
    discrepancyRate: number
    avgResponseTimeMs: number
  }
  domainPerformance: DomainPerformance[]
  commonErrors: ErrorPattern[]
  routingIssues: RoutingIssue[]
  promptSuggestions: PromptSuggestion[]
}

export interface DomainPerformance {
  domain: string
  totalRequests: number
  avgResponseTimeMs: number
  errorCount: number
  feedbackPositiveRate: number
  feedbackNegativeRate: number
}

export interface ErrorPattern {
  errorMessage: string
  count: number
  domain: string | null
  examples: string[]
}

export interface RoutingIssue {
  type: 'wrong_domain' | 'low_confidence' | 'reformulation'
  description: string
  count: number
  examples: Array<{
    message: string
    selectedDomain: string
    expectedDomain?: string
    confidence?: number
  }>
}

export interface PromptSuggestion {
  domain: string
  issue: string
  suggestion: string
  impact: 'high' | 'medium' | 'low'
  basedOn: number // Cantidad de ejemplos analizados
}

export interface WeeklyReport {
  weekNumber: number
  year: number
  insights: InsightReport
  comparisonWithPrevious: {
    feedbackImprovement: number // porcentaje
    errorReduction: number // porcentaje
    responseTimeChange: number // ms
  } | null
  actionItems: string[]
}

// ============================================
// CLASE TraceAnalyzer
// ============================================

export class TraceAnalyzer {
  /**
   * Genera un reporte de insights para un periodo
   */
  async generateInsightReport(fromDate: Date, toDate: Date): Promise<InsightReport> {
    const db = getDb()

    logger.info('Generating insight report', {
      domain: 'analyzer',
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    })

    // 1. Obtener estadísticas generales
    const generalStats = await this.getGeneralStats(fromDate, toDate)

    // 2. Obtener rendimiento por dominio
    const domainPerformance = await this.getDomainPerformance(fromDate, toDate)

    // 3. Analizar patrones de error
    const commonErrors = await this.analyzeErrors(fromDate, toDate)

    // 4. Detectar problemas de routing
    const routingIssues = await this.analyzeRouting(fromDate, toDate)

    // 5. Generar sugerencias de prompts
    const promptSuggestions = await this.generatePromptSuggestions(
      domainPerformance,
      commonErrors,
      routingIssues
    )

    return {
      period: { from: fromDate, to: toDate },
      summary: generalStats,
      domainPerformance,
      commonErrors,
      routingIssues,
      promptSuggestions,
    }
  }

  /**
   * Obtiene estadísticas generales del periodo
   */
  private async getGeneralStats(fromDate: Date, toDate: Date) {
    const db = getDb()

    const result = await db
      .select({
        totalInteractions: sql<number>`count(*)::int`,
        positiveCount: sql<number>`count(*) filter (where ${aiChatLogs.feedback} = 'positive')::int`,
        negativeCount: sql<number>`count(*) filter (where ${aiChatLogs.feedback} = 'negative')::int`,
        errorCount: sql<number>`count(*) filter (where ${aiChatLogs.hadError} = true)::int`,
        discrepancyCount: sql<number>`count(*) filter (where ${aiChatLogs.hadDiscrepancy} = true)::int`,
        avgResponseTimeMs: sql<number>`avg(${aiChatLogs.responseTimeMs})::int`,
      })
      .from(aiChatLogs)
      .where(and(
        gte(aiChatLogs.createdAt, fromDate.toISOString()),
        lte(aiChatLogs.createdAt, toDate.toISOString())
      ))

    const stats = result[0]
    const total = stats?.totalInteractions || 0
    const withFeedback = (stats?.positiveCount || 0) + (stats?.negativeCount || 0)

    return {
      totalInteractions: total,
      feedbackPositiveRate: withFeedback > 0 ? (stats?.positiveCount || 0) / withFeedback : 0,
      feedbackNegativeRate: withFeedback > 0 ? (stats?.negativeCount || 0) / withFeedback : 0,
      errorRate: total > 0 ? (stats?.errorCount || 0) / total : 0,
      discrepancyRate: total > 0 ? (stats?.discrepancyCount || 0) / total : 0,
      avgResponseTimeMs: stats?.avgResponseTimeMs || 0,
    }
  }

  /**
   * Obtiene rendimiento por dominio
   */
  private async getDomainPerformance(fromDate: Date, toDate: Date): Promise<DomainPerformance[]> {
    const db = getDb()

    // Subquery para obtener dominio de cada log desde traces
    const logsWithDomain = await db
      .select({
        logId: aiChatLogs.id,
        feedback: aiChatLogs.feedback,
        hadError: aiChatLogs.hadError,
        responseTimeMs: aiChatLogs.responseTimeMs,
        domain: sql<string>`(
          SELECT ${aiChatTraces.outputData}->>'selectedDomain'
          FROM ${aiChatTraces}
          WHERE ${aiChatTraces.logId} = ${aiChatLogs.id}
          AND ${aiChatTraces.traceType} = 'routing'
          LIMIT 1
        )`.as('domain'),
      })
      .from(aiChatLogs)
      .where(and(
        gte(aiChatLogs.createdAt, fromDate.toISOString()),
        lte(aiChatLogs.createdAt, toDate.toISOString())
      ))

    // Agrupar por dominio
    const byDomain = new Map<string, {
      requests: number
      responseTimes: number[]
      errors: number
      positive: number
      negative: number
    }>()

    for (const log of logsWithDomain) {
      const domain = log.domain || 'fallback'

      if (!byDomain.has(domain)) {
        byDomain.set(domain, {
          requests: 0,
          responseTimes: [],
          errors: 0,
          positive: 0,
          negative: 0,
        })
      }

      const stats = byDomain.get(domain)!
      stats.requests++
      if (log.responseTimeMs) stats.responseTimes.push(log.responseTimeMs)
      if (log.hadError) stats.errors++
      if (log.feedback === 'positive') stats.positive++
      if (log.feedback === 'negative') stats.negative++
    }

    // Convertir a array
    return Array.from(byDomain.entries()).map(([domain, stats]) => {
      const withFeedback = stats.positive + stats.negative
      return {
        domain,
        totalRequests: stats.requests,
        avgResponseTimeMs: stats.responseTimes.length > 0
          ? Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length)
          : 0,
        errorCount: stats.errors,
        feedbackPositiveRate: withFeedback > 0 ? stats.positive / withFeedback : 0,
        feedbackNegativeRate: withFeedback > 0 ? stats.negative / withFeedback : 0,
      }
    }).sort((a, b) => b.totalRequests - a.totalRequests)
  }

  /**
   * Analiza patrones de error
   */
  private async analyzeErrors(fromDate: Date, toDate: Date): Promise<ErrorPattern[]> {
    const db = getDb()

    // Obtener traces con errores
    const errorTraces = await db
      .select({
        errorMessage: aiChatTraces.errorMessage,
        traceType: aiChatTraces.traceType,
        logId: aiChatTraces.logId,
      })
      .from(aiChatTraces)
      .where(and(
        eq(aiChatTraces.success, false),
        isNotNull(aiChatTraces.errorMessage),
        gte(aiChatTraces.createdAt, fromDate.toISOString()),
        lte(aiChatTraces.createdAt, toDate.toISOString())
      ))
      .limit(1000)

    // Agrupar por mensaje de error (normalizado)
    const byError = new Map<string, {
      count: number
      domain: string | null
      examples: string[]
    }>()

    for (const trace of errorTraces) {
      const msg = this.normalizeErrorMessage(trace.errorMessage || '')

      if (!byError.has(msg)) {
        byError.set(msg, {
          count: 0,
          domain: trace.traceType,
          examples: [],
        })
      }

      const pattern = byError.get(msg)!
      pattern.count++
      if (pattern.examples.length < 3 && trace.logId) {
        pattern.examples.push(trace.logId)
      }
    }

    // Convertir a array y ordenar por frecuencia
    return Array.from(byError.entries())
      .map(([errorMessage, data]) => ({
        errorMessage,
        count: data.count,
        domain: data.domain,
        examples: data.examples,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  /**
   * Normaliza mensajes de error para agruparlos
   */
  private normalizeErrorMessage(msg: string): string {
    return msg
      // Remover IDs específicos
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[UUID]')
      // Remover timestamps
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '[TIMESTAMP]')
      // Remover números largos
      .replace(/\d{10,}/g, '[NUMBER]')
      // Truncar
      .substring(0, 100)
  }

  /**
   * Analiza problemas de routing
   */
  private async analyzeRouting(fromDate: Date, toDate: Date): Promise<RoutingIssue[]> {
    const db = getDb()
    const issues: RoutingIssue[] = []

    // 1. Buscar casos de baja confianza
    const lowConfidenceTraces = await db
      .select({
        logId: aiChatTraces.logId,
        outputData: aiChatTraces.outputData,
      })
      .from(aiChatTraces)
      .where(and(
        eq(aiChatTraces.traceType, 'routing'),
        gte(aiChatTraces.createdAt, fromDate.toISOString()),
        lte(aiChatTraces.createdAt, toDate.toISOString())
      ))
      .limit(500)

    const lowConfidenceExamples: Array<{
      message: string
      selectedDomain: string
      confidence: number
    }> = []

    for (const trace of lowConfidenceTraces) {
      const output = trace.outputData as Record<string, unknown> | null
      if (output) {
        const confidence = Number(output.confidence) || 0
        if (confidence < 0.7 && confidence > 0) {
          lowConfidenceExamples.push({
            message: trace.logId || '',
            selectedDomain: String(output.selectedDomain || 'unknown'),
            confidence,
          })
        }
      }
    }

    if (lowConfidenceExamples.length > 0) {
      issues.push({
        type: 'low_confidence',
        description: 'Casos donde el routing tiene baja confianza (<70%)',
        count: lowConfidenceExamples.length,
        examples: lowConfidenceExamples.slice(0, 5),
      })
    }

    // 2. Buscar logs con feedback negativo seguidos de reformulación
    const negativeLogs = await db
      .select({
        id: aiChatLogs.id,
        message: aiChatLogs.message,
        createdAt: aiChatLogs.createdAt,
      })
      .from(aiChatLogs)
      .where(and(
        eq(aiChatLogs.feedback, 'negative'),
        gte(aiChatLogs.createdAt, fromDate.toISOString()),
        lte(aiChatLogs.createdAt, toDate.toISOString())
      ))
      .orderBy(desc(aiChatLogs.createdAt))
      .limit(50)

    if (negativeLogs.length > 0) {
      issues.push({
        type: 'reformulation',
        description: 'Logs con feedback negativo (posible necesidad de reformulación)',
        count: negativeLogs.length,
        examples: negativeLogs.slice(0, 5).map(log => ({
          message: log.message?.substring(0, 100) || '',
          selectedDomain: 'unknown',
        })),
      })
    }

    return issues
  }

  /**
   * Genera sugerencias para mejorar prompts
   */
  private async generatePromptSuggestions(
    domainPerformance: DomainPerformance[],
    errors: ErrorPattern[],
    routingIssues: RoutingIssue[]
  ): Promise<PromptSuggestion[]> {
    const suggestions: PromptSuggestion[] = []

    // 1. Sugerencias basadas en rendimiento de dominios
    for (const domain of domainPerformance) {
      // Dominio con alta tasa de feedback negativo
      if (domain.feedbackNegativeRate > 0.3 && domain.totalRequests >= 10) {
        suggestions.push({
          domain: domain.domain,
          issue: `Alta tasa de feedback negativo (${Math.round(domain.feedbackNegativeRate * 100)}%)`,
          suggestion: `Revisar el system prompt del dominio ${domain.domain}. Considerar añadir más contexto o ejemplos.`,
          impact: domain.feedbackNegativeRate > 0.5 ? 'high' : 'medium',
          basedOn: domain.totalRequests,
        })
      }

      // Dominio con alto tiempo de respuesta
      if (domain.avgResponseTimeMs > 5000 && domain.totalRequests >= 10) {
        suggestions.push({
          domain: domain.domain,
          issue: `Tiempo de respuesta alto (${domain.avgResponseTimeMs}ms)`,
          suggestion: `Optimizar el dominio ${domain.domain}. Considerar reducir el contexto enviado o usar un modelo más rápido.`,
          impact: 'medium',
          basedOn: domain.totalRequests,
        })
      }
    }

    // 2. Sugerencias basadas en errores frecuentes
    for (const error of errors.slice(0, 3)) {
      if (error.count >= 5) {
        suggestions.push({
          domain: error.domain || 'general',
          issue: `Error frecuente: ${error.errorMessage.substring(0, 50)}`,
          suggestion: `Investigar causa raíz del error. Revisar manejo de errores en ${error.domain || 'el sistema'}.`,
          impact: error.count > 20 ? 'high' : 'medium',
          basedOn: error.count,
        })
      }
    }

    // 3. Sugerencias basadas en problemas de routing
    for (const issue of routingIssues) {
      if (issue.type === 'low_confidence' && issue.count >= 10) {
        suggestions.push({
          domain: 'routing',
          issue: `${issue.count} casos de routing con baja confianza`,
          suggestion: 'Revisar los patrones de detección en cada dominio. Considerar añadir más indicadores o mejorar los existentes.',
          impact: 'high',
          basedOn: issue.count,
        })
      }
    }

    return suggestions.sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 }
      return impactOrder[a.impact] - impactOrder[b.impact]
    })
  }

  /**
   * Genera reporte semanal completo
   */
  async generateWeeklyReport(): Promise<WeeklyReport> {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay()) // Inicio de semana (domingo)
    weekStart.setHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    // Calcular número de semana
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const weekNumber = Math.ceil(
      ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
    )

    // Generar insights de esta semana
    const insights = await this.generateInsightReport(weekStart, weekEnd)

    // Generar action items
    const actionItems = this.generateActionItems(insights)

    // Intentar comparar con semana anterior
    let comparisonWithPrevious = null
    try {
      const prevWeekStart = new Date(weekStart)
      prevWeekStart.setDate(prevWeekStart.getDate() - 7)
      const prevWeekEnd = new Date(weekStart)

      const prevInsights = await this.generateInsightReport(prevWeekStart, prevWeekEnd)

      if (prevInsights.summary.totalInteractions > 0) {
        comparisonWithPrevious = {
          feedbackImprovement:
            (insights.summary.feedbackPositiveRate - prevInsights.summary.feedbackPositiveRate) * 100,
          errorReduction:
            (prevInsights.summary.errorRate - insights.summary.errorRate) * 100,
          responseTimeChange:
            insights.summary.avgResponseTimeMs - prevInsights.summary.avgResponseTimeMs,
        }
      }
    } catch (error) {
      logger.warn('Could not generate comparison with previous week', { domain: 'analyzer' })
    }

    return {
      weekNumber,
      year: now.getFullYear(),
      insights,
      comparisonWithPrevious,
      actionItems,
    }
  }

  /**
   * Genera action items basados en los insights
   */
  private generateActionItems(insights: InsightReport): string[] {
    const items: string[] = []

    // Basado en tasas
    if (insights.summary.errorRate > 0.05) {
      items.push(`Prioridad ALTA: Reducir tasa de errores (actual: ${Math.round(insights.summary.errorRate * 100)}%)`)
    }

    if (insights.summary.feedbackNegativeRate > 0.2) {
      items.push(`Revisar calidad de respuestas: ${Math.round(insights.summary.feedbackNegativeRate * 100)}% feedback negativo`)
    }

    if (insights.summary.avgResponseTimeMs > 3000) {
      items.push(`Optimizar tiempo de respuesta (actual: ${insights.summary.avgResponseTimeMs}ms)`)
    }

    // Basado en sugerencias de prompts
    const highImpactSuggestions = insights.promptSuggestions.filter(s => s.impact === 'high')
    for (const suggestion of highImpactSuggestions) {
      items.push(`[${suggestion.domain}] ${suggestion.suggestion}`)
    }

    // Si no hay action items, añadir uno positivo
    if (items.length === 0) {
      items.push('Sistema funcionando correctamente. Continuar monitoreando métricas.')
    }

    return items
  }
}

// ============================================
// SINGLETON
// ============================================

let analyzerInstance: TraceAnalyzer | null = null

export function getTraceAnalyzer(): TraceAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new TraceAnalyzer()
  }
  return analyzerInstance
}
