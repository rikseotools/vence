// app/api/admin/ai-traces/[logId]/route.ts
// API para obtener detalle de un log con sus traces (admin)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getLogWithTraces, buildTraceTree } from '@/lib/api/ai-traces/queries'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Emails de administradores autorizados
const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]

function isAdmin(email: string | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string }> }
) {
  try {
    // Get auth token
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)

    // Verificar autenticación
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verificar que es admin
    if (!isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      )
    }

    const { logId } = await params

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(logId)) {
      return NextResponse.json(
        { error: 'ID de log inválido' },
        { status: 400 }
      )
    }

    // Obtener log con traces
    const result = await getLogWithTraces(logId)

    if (!result) {
      return NextResponse.json(
        { error: 'Log no encontrado' },
        { status: 404 }
      )
    }

    // Construir árbol de traces
    const tree = buildTraceTree(result.traces)

    // Calcular estadísticas
    const stats = {
      totalDurationMs: result.traces.reduce((sum, t) => sum + (t.durationMs || 0), 0),
      llmCallCount: result.traces.filter(t => t.traceType === 'llm_call').length,
      dbQueryCount: result.traces.filter(t => t.traceType === 'db_query').length,
      errorCount: result.traces.filter(t => !t.success).length,
      totalTokensIn: result.traces.reduce((sum, t) => {
        const meta = t.metadata as Record<string, unknown> | null
        return sum + (Number(meta?.tokensIn) || 0)
      }, 0),
      totalTokensOut: result.traces.reduce((sum, t) => {
        const meta = t.metadata as Record<string, unknown> | null
        return sum + (Number(meta?.tokensOut) || 0)
      }, 0),
      dominiosEvaluados: 0,
      dominioSeleccionado: null as string | null,
    }

    // Extraer info de routing
    const routingTrace = result.traces.find(t => t.traceType === 'routing')
    if (routingTrace) {
      const output = routingTrace.outputData as Record<string, unknown> | null
      if (output) {
        const evaluated = output.evaluatedDomains as unknown[] | undefined
        stats.dominiosEvaluados = evaluated?.length || 0
        stats.dominioSeleccionado = (output.selectedDomain as string) || null
      }
    }

    // Formatear respuesta
    const response = {
      log: {
        id: result.log.id,
        userId: result.log.userId,
        message: result.log.message,
        fullResponse: result.log.fullResponse,
        responseTimeMs: result.log.responseTimeMs,
        tokensUsed: result.log.tokensUsed,
        feedback: result.log.feedback,
        feedbackComment: result.log.feedbackComment,
        hadError: result.log.hadError,
        hadDiscrepancy: result.log.hadDiscrepancy,
        aiSuggestedAnswer: result.log.aiSuggestedAnswer,
        dbAnswer: result.log.dbAnswer,
        detectedLaws: result.log.detectedLaws || [],
        questionContextLaw: result.log.questionContextLaw,
        createdAt: result.log.createdAt,
      },
      traces: result.traces.map(t => ({
        id: t.id,
        traceType: t.traceType,
        startedAt: t.startedAt,
        endedAt: t.endedAt,
        durationMs: t.durationMs,
        inputData: t.inputData,
        outputData: t.outputData,
        metadata: t.metadata,
        success: t.success,
        errorMessage: t.errorMessage,
        sequenceNumber: t.sequenceNumber,
        parentTraceId: t.parentTraceId,
      })),
      tree,
      stats,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API/admin/ai-traces/[logId]] Error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
