// app/api/ai/chat-v2/route.ts
// Nueva arquitectura de chat con TypeScript, Drizzle y Zod

// Streaming responses pueden tardar más que el default de Vercel (30s)
// 60s permite respuestas largas sin timeout
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { getAdminDb } from '@/db/client'
import { userProfiles, aiChatLogs } from '@/db/schema'
import { eq, and, gte } from 'drizzle-orm'
import { z } from 'zod'
import {
  buildChatContext,
  getOrchestrator,
} from '@/lib/chat/core'
import { logger, handleError } from '@/lib/chat/shared'
import {
  detectDiscrepancy,
  hasUncertaintyIndicators,
  reanalyzeWithSuperiorModel,
} from '@/lib/chat/domains/verification'
import { insertChatLog } from '@/lib/api/ai-chat-logs'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { checkRateLimit, getClientIp, RATE_LIMIT_CHAT } from '@/lib/api/rateLimit'
import { getDeviceIdFromRequest } from '@/lib/api/deviceLimit'
import {
  getChatLimitStatus,
  incrementChatUsage,
  getChatLimitMode,
  type ChatBucket,
} from '@/lib/api/chatLimit'
import { emitFireAndForget } from '@/lib/observability/emit'

// getAdminDb() = Drizzle/DATABASE_URL (bypass RLS, equivalente al service_role).
// Agnóstico de proveedor.

/**
 * Generar UUID para el logId antes de procesar
 * Esto permite vincular los traces con el log
 */
function generateLogId(): string {
  return crypto.randomUUID()
}

// Schema para el request del chat (compatible con el actual)
const chatApiRequestSchema = z.object({
  message: z.string().min(1, 'Se requiere un mensaje'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).default([]),
  questionContext: z.object({
    // Acepta tanto 'id' como 'questionId' del frontend
    id: z.string().nullable().optional(),
    questionId: z.string().nullable().optional(),
    questionText: z.string().nullable().optional(),
    // Options puede ser array o objeto {a,b,c,d}
    options: z.union([
      z.array(z.string()),
      z.object({
        a: z.string().optional(),
        b: z.string().optional(),
        c: z.string().optional(),
        d: z.string().optional(),
      }),
    ]).nullable().optional(),
    // Acepta número o string para correctAnswer/selectedAnswer
    selectedAnswer: z.union([z.number(), z.string()]).nullable().optional(),
    correctAnswer: z.union([z.number(), z.string()]).nullable().optional(),
    lawName: z.string().nullable().optional(),
    articleNumber: z.string().nullable().optional(),
    explanation: z.string().nullable().optional(),
    // Campos adicionales del frontend
    difficulty: z.string().nullable().optional(),
    source: z.string().nullable().optional(),
    isPsicotecnico: z.boolean().optional(),
    questionSubtype: z.string().nullable().optional(),
    questionCategory: z.string().nullable().optional(),
    questionTypeName: z.string().nullable().optional(),
    contentData: z.any().nullable().optional(),
  }).nullable().optional(),
  userOposicion: z.string().nullable().optional(),
  stream: z.boolean().default(true),
  userId: z.string().nullable().optional(),
  suggestionUsed: z.string().nullable().optional(),
  isPremium: z.boolean().default(false),
  debugAuthState: z.object({
    userExists: z.boolean(),
    authLoading: z.boolean(),
    userIdExists: z.boolean(),
  }).nullable().optional(),
})

// Sugerencias que cuentan como "explicación de pregunta" (flujo de estudio) en
// vez de "chat libre". Determinan el cubo de límite: explain vs free. El tope
// diario real vive en lib/api/chatLimit.ts (Redis).
const EXEMPT_SUGGESTIONS = [
  'explicar_respuesta',
  'explicar_psico',
  'analizar_psico',
  'Explícame la respuesta correcta',
]

// NOTA: getUserName() se eliminó (código muerto) — la query paralela a
// user_profiles en _POST ya obtiene nickname/full_name junto con plan_type.

async function _POST(request: NextRequest) {
  const startTime = Date.now()
  logger.info('Chat v2 request started', { domain: 'api' })

  try {
    // Parsear y validar request
    const body = await request.json()
    const validation = chatApiRequestSchema.safeParse(body)

    if (!validation.success) {
      logger.warn('Invalid request', {
        domain: 'api',
        errors: validation.error.flatten(),
      })
      return NextResponse.json(
        { success: false, error: 'Request inválido', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // ── Límite de uso del chat (free + anónimos) ────────────────────────────
    // Las explicaciones (EXEMPT_SUGGESTIONS) van al cubo 'explain'; el resto a
    // 'free'. Para anónimos chatLimit.ts normaliza ambos a un único cubo 'anon'.
    const isExemptSuggestion = !!(data.suggestionUsed && EXEMPT_SUGGESTIONS.includes(data.suggestionUsed))
    const limitBucket: ChatBucket = isExemptSuggestion ? 'explain' : 'free'
    const clientIp = getClientIp(request)
    const deviceId = getDeviceIdFromRequest(request)
    const limitMode = getChatLimitMode()

    // Capa burst: corta ráfagas de bots por IP (anti-hammering, coste cero).
    const burst = checkRateLimit(clientIp, RATE_LIMIT_CHAT)
    if (!burst.allowed) {
      logger.warn('Chat burst rate limit exceeded', { domain: 'api', ip: clientIp, resetMs: burst.resetMs })
      return NextResponse.json(
        {
          success: false,
          error: 'Demasiadas solicitudes seguidas. Espera unos segundos.',
          code: 'RATE_LIMIT',
          limitReached: true,
          retryAfterMs: burst.resetMs,
        },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(burst.resetMs / 1000)) } }
      )
    }

    // Verificar premium contra BD (no fiarse del isPremium del cliente) + nickname.
    let isPremiumVerified = data.isPremium
    let userName: string | undefined
    if (data.userId && data.userId !== 'anonymous') {
      const profileRows = await getAdminDb()
        .select({ plan_type: userProfiles.planType, nickname: userProfiles.nickname, full_name: userProfiles.fullName })
        .from(userProfiles)
        .where(eq(userProfiles.id, data.userId))
        .limit(1)

      const profile = profileRows[0]
      if (profile) {
        isPremiumVerified = profile.plan_type === 'premium' || profile.plan_type === 'trial'
        const name = profile.nickname || profile.full_name
        userName = name ? name.split(' ')[0] : undefined
      }
    }

    // Capa tope diario (Redis, cross-lambda). Premium salta. 'off' desactiva todo.
    const countUsage = !isPremiumVerified && limitMode !== 'off'
    if (countUsage) {
      const status = await getChatLimitStatus({
        userId: data.userId,
        deviceId,
        ip: clientIp,
        bucket: limitBucket,
        isPremium: false,
      })

      if (!status.allowed) {
        // Registrar siempre (en shadow es el would-block; en on es el bloqueo real).
        emitFireAndForget({
          source: 'vercel',
          severity: 'warn',
          eventType: 'chat_limit_reached',
          endpoint: '/api/ai/chat-v2',
          userId: data.userId ?? null,
          httpStatus: limitMode === 'on' ? 429 : 200,
          metadata: {
            scope: status.scope,
            bucket: status.bucket,
            used: status.used,
            limit: status.limit,
            mode: limitMode,
            deviceId: deviceId || null,
          },
        })
        logger.warn('Chat daily limit reached', {
          domain: 'api',
          userId: data.userId ?? undefined,
          scope: status.scope,
          bucket: status.bucket,
          used: status.used,
          limit: status.limit,
          mode: limitMode,
        })

        if (limitMode === 'on') {
          return NextResponse.json(
            {
              success: false,
              error: 'Límite diario de mensajes alcanzado',
              code: 'RATE_LIMIT',
              limitReached: true,
              dailyUsed: status.used,
              dailyLimit: status.limit,
              scope: status.scope,
              bucket: status.bucket,
            },
            { status: 429 }
          )
        }
        // shadow: continúa sin bloquear.
      }
    }

    // Construir mensajes para el contexto
    const messages = [
      ...data.history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: data.message },
    ]

    // Normalizar questionContext para el orquestador
    let normalizedQuestionContext = undefined
    if (data.questionContext) {
      const qc = data.questionContext
      // Convertir options de objeto a array si es necesario
      let optionsArray: string[] | undefined = undefined
      if (qc.options) {
        if (Array.isArray(qc.options)) {
          optionsArray = qc.options
        } else {
          // Es objeto {a, b, c, d}
          optionsArray = [qc.options.a || '', qc.options.b || '', qc.options.c || '', qc.options.d || '']
        }
      }

      normalizedQuestionContext = {
        questionId: qc.questionId || qc.id || undefined,
        questionText: qc.questionText || undefined,
        options: optionsArray,
        selectedAnswer: qc.selectedAnswer != null ? Number(qc.selectedAnswer) : undefined,
        correctAnswer: qc.correctAnswer != null ? Number(qc.correctAnswer) : undefined,
        lawName: qc.lawName || undefined,
        articleNumber: qc.articleNumber || undefined,
        explanation: qc.explanation || undefined,
        // Campos de psicotécnicos
        isPsicotecnico: qc.isPsicotecnico || false,
        questionSubtype: qc.questionSubtype || undefined,
        questionCategory: qc.questionCategory || undefined,
        questionTypeName: qc.questionTypeName || undefined,
        contentData: qc.contentData || undefined,
      }
    }

    // Log warning si explicar_respuesta llega sin contexto (indica componente sin setQuestionContext)
    const isExplainSuggestion = data.suggestionUsed && ['explicar_respuesta', 'explicar_psico', 'analizar_psico'].includes(data.suggestionUsed)
    if (isExplainSuggestion && !normalizedQuestionContext?.questionText) {
      logger.warn('explicar_respuesta without questionContext — componente no llama setQuestionContext', {
        domain: 'api',
        suggestionUsed: data.suggestionUsed,
        message: data.message?.substring(0, 100),
      })
    }

    // userName ya obtenido arriba junto con el perfil (query paralela)
    logger.info(`👤 User info: userId=${data.userId}, userName=${userName}`, { domain: 'api' })

    // Construir contexto de chat
    const context = buildChatContext(
      {
        messages,
        questionContext: normalizedQuestionContext,
        isPremium: data.isPremium,
      },
      {
        userId: data.userId || 'anonymous',
        userName,
        userDomain: data.userOposicion || 'auxiliar_administrativo_estado',
        isPremium: data.isPremium,
      }
    )

    // Generar logId antes de procesar para vincular traces y disputas
    const logId = generateLogId()
    context.logId = logId

    // Re-explicación: ¿este usuario YA pidió explicar esta MISMA pregunta antes?
    // Detección server-side contra ai_chat_logs (fuente de verdad persistente),
    // robusta aunque el frontend limpie el historial al cambiar de pregunta
    // (causa de los negativos a8ee13db/80496a64: "Explícame" repetido → idéntico).
    // Si ya existe, el tutor variará el enfoque en vez de repetir.
    if (isExplainSuggestion && data.userId && normalizedQuestionContext?.questionId) {
      try {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const prior = await getAdminDb()
          .select({ id: aiChatLogs.id })
          .from(aiChatLogs)
          .where(and(
            eq(aiChatLogs.userId, data.userId),
            eq(aiChatLogs.questionContextId, normalizedQuestionContext.questionId),
            gte(aiChatLogs.createdAt, cutoff)
          ))
          .limit(1)
        if (prior.length > 0) {
          context.isRepeatExplanation = true
          logger.info('🔁 Re-explicación detectada → el tutor variará el enfoque', {
            domain: 'api', userId: data.userId, questionId: normalizedQuestionContext.questionId,
          })
        }
      } catch (e) {
        // Degradación elegante: si la query falla, seguimos sin variar (no rompe el chat)
        logger.warn('No se pudo comprobar re-explicación', { domain: 'api', error: e instanceof Error ? e.message : String(e) })
      }
    }

    // Obtener orquestador y procesar
    const orchestrator = getOrchestrator()

    if (data.stream) {
      // Respuesta streaming - pasar logId para traces
      // Usar after() para ejecutar el flush de traces en background (no bloquea la respuesta)
      const originalStream = await orchestrator.processStream(context, logId, {
        onFlush: (flushFn) => after(flushFn)
      })

      // Crear un stream que capture la respuesta completa para logging
      let fullResponse = ''
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()

      // Capturar el questionContext normalizado para usarlo en flush
      const qContext = normalizedQuestionContext

      // Variables para capturar metadata del SSE (sources, tokens, modelo)
      let capturedSources: string[] = []
      let capturedTokensUsed: number | null = null
      let capturedModelProvider: string | null = null
      let capturedModelId: string | null = null

      const transformStream = new TransformStream({
        transform(chunk, controller) {
          // Pasar el chunk al cliente
          controller.enqueue(chunk)

          // Acumular para logging
          const text = decoder.decode(chunk, { stream: true })
          // Extraer contenido del formato SSE (data: {"content":"..."})
          const matches = text.matchAll(/data: ({.*})/g)
          for (const match of matches) {
            try {
              const parsed = JSON.parse(match[1])
              if (parsed.content) {
                fullResponse += parsed.content
              }
              // Capturar metadata del chunk tipo 'meta'
              if (parsed.type === 'meta') {
                if (parsed.sources) {
                  capturedSources = parsed.sources.map((s: { law?: string; article?: string }) =>
                    `${s.law || ''} Art. ${s.article || ''}`
                  )
                }
                capturedTokensUsed = parsed.tokensUsed || capturedTokensUsed
                capturedModelProvider = parsed.modelProvider || capturedModelProvider
                capturedModelId = parsed.modelId || capturedModelId
              }
            } catch {
              // Ignorar chunks que no son JSON válido
            }
          }
        },
        async flush(controller) {
          // Variables para logging de discrepancia
          let hadDiscrepancy = false
          let aiSuggestedAnswer: string | null = null
          let dbAnswer: string | null = null
          let reanalysisResponse: string | null = null

          // Detectar discrepancia SOLO para preguntas psicotécnicas con respuesta correcta conocida
          if (
            qContext?.isPsicotecnico &&
            qContext?.correctAnswer !== undefined &&
            qContext?.questionText &&
            qContext?.options &&
            fullResponse.length > 50 // Respuesta suficientemente larga
          ) {
            try {
              // Verificar si la IA muestra incertidumbre (no vale la pena re-analizar)
              const hasUncertainty = hasUncertaintyIndicators(fullResponse)

              if (!hasUncertainty) {
                const discrepancy = detectDiscrepancy(fullResponse, qContext.correctAnswer)

                if (discrepancy.hasDiscrepancy && discrepancy.aiSuggestedAnswer) {
                  hadDiscrepancy = true
                  aiSuggestedAnswer = discrepancy.aiSuggestedAnswer
                  dbAnswer = discrepancy.dbAnswer

                  logger.info('Discrepancy detected, initiating reanalysis', {
                    domain: 'verification',
                    aiSuggested: aiSuggestedAnswer,
                    dbAnswer,
                    confidence: discrepancy.confidence,
                    questionType: qContext.questionTypeName
                  })

                  // Enviar mensaje de que vamos a hacer análisis avanzado
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'reanalysis_start',
                    message: '\n\n---\n\n⚠️ **Algo no cuadra, voy a hacer un análisis más avanzado...**\n\n'
                  })}\n\n`))

                  // Preparar opciones en formato objeto
                  const optionsObj = Array.isArray(qContext.options)
                    ? {
                        a: qContext.options[0] || '',
                        b: qContext.options[1] || '',
                        c: qContext.options[2] || '',
                        d: qContext.options[3] || ''
                      }
                    : qContext.options

                  // Re-analizar con modelo superior
                  const reanalysis = await reanalyzeWithSuperiorModel({
                    questionText: qContext.questionText,
                    options: optionsObj as { a: string; b: string; c: string; d: string },
                    correctAnswer: dbAnswer,
                    aiSuggestedAnswer: aiSuggestedAnswer,
                    originalAnalysis: fullResponse,
                    questionTypeName: qContext.questionTypeName,
                    questionSubtype: qContext.questionSubtype,
                    contentData: qContext.contentData
                  })

                  reanalysisResponse = reanalysis.analysis

                  // Enviar resultado del re-análisis
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'reanalysis_result',
                    content: `🔍 **Análisis avanzado:**\n\n${reanalysis.analysis}`
                  })}\n\n`))

                  logger.info('Reanalysis completed and sent to client', {
                    domain: 'verification',
                    tokensUsed: reanalysis.tokensUsed
                  })
                }
              }
            } catch (reanalysisError) {
              // No bloquear la respuesta si falla el re-análisis
              logger.error('Error during discrepancy detection/reanalysis', reanalysisError, {
                domain: 'verification'
              })
            }
          }

          // Cuando termina el stream, loguear la respuesta completa
          // Usar el logId pre-generado para vincular con los traces
          const savedLogId = await insertChatLog({
            logId,  // ID pre-generado para vincular traces
            userId: data.userId,
            message: data.message,
            response: fullResponse || null,
            sources: capturedSources,
            detectedLaws: [...new Set(capturedSources.map(s => s.split(' Art.')[0]).filter(Boolean))],
            tokensUsed: capturedTokensUsed,
            questionContextId: qContext?.questionId || null,
            questionContextLaw: qContext?.lawName || data.questionContext?.lawName || null,
            suggestionUsed: data.suggestionUsed,
            userOposicion: data.userOposicion,
            responseTimeMs: Date.now() - startTime,
            errorMessage: !data.userId && data.debugAuthState
              ? `DEBUG_AUTH: ${JSON.stringify(data.debugAuthState)}`
              : null,
            // Datos de discrepancia
            hadDiscrepancy,
            aiSuggestedAnswer,
            dbAnswer,
            reanalysisResponse,
            // Modelo LLM usado (para métricas)
            modelProvider: capturedModelProvider,
            modelId: capturedModelId,
          })

          // Consumir 1 unidad de cuota SOLO si hubo respuesta real (no en error).
          if (countUsage && fullResponse) {
            await incrementChatUsage({ userId: data.userId, deviceId, ip: clientIp, bucket: limitBucket, isPremium: false })
          }

          // Enviar logId para feedback
          if (savedLogId) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'logId', logId: savedLogId })}\n\n`))
          }
        },
      })

      const stream = originalStream.pipeThrough(transformStream)

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } else {
      // Respuesta normal (sin streaming) - pasar logId para traces
      // Usar after() para ejecutar el flush de traces en background (no bloquea la respuesta)
      const response = await orchestrator.process(context, logId, {
        onFlush: (flushFn) => after(flushFn)
      })

      // Log - usar el logId pre-generado para vincular con los traces
      const responseSources = response.metadata?.sources?.map(s => `${s.lawName} Art. ${s.articleNumber}`) || []
      await insertChatLog({
        logId,  // ID pre-generado para vincular traces
        userId: data.userId,
        message: data.message,
        response: response.content,
        sources: responseSources,
        detectedLaws: [...new Set(responseSources.map(s => s.split(' Art.')[0]).filter(Boolean))],
        tokensUsed: response.metadata?.tokensUsed ?? null,
        questionContextId: normalizedQuestionContext?.questionId || null,
        questionContextLaw: normalizedQuestionContext?.lawName || data.questionContext?.lawName || null,
        suggestionUsed: data.suggestionUsed,
        responseTimeMs: Date.now() - startTime,
        userOposicion: data.userOposicion,
        errorMessage: !data.userId && data.debugAuthState
          ? `DEBUG_AUTH: ${JSON.stringify(data.debugAuthState)}`
          : null,
        // Modelo LLM usado (para métricas)
        modelProvider: response.metadata?.modelProvider ?? null,
        modelId: response.metadata?.modelId ?? null,
      })

      // Consumir 1 unidad de cuota SOLO si hubo respuesta real (no en error).
      if (countUsage && response.content) {
        await incrementChatUsage({ userId: data.userId, deviceId, ip: clientIp, bucket: limitBucket, isPremium: false })
      }

      return NextResponse.json({
        success: true,
        response: response.content,
        sources: response.metadata?.sources || [],
        metadata: response.metadata,
      })
    }
  } catch (error) {
    const chatError = handleError(error)

    logger.error('Chat v2 error', chatError, { domain: 'api' })

    return NextResponse.json(
      {
        success: false,
        error: chatError.message,
        code: chatError.code,
      },
      { status: chatError.statusCode }
    )
  }
}

// Bloquear GET
async function _GET() {
  return NextResponse.json(
    { error: 'Método no permitido. Usa POST.' },
    { status: 405 }
  )
}

export const POST = withErrorLogging('/api/ai/chat-v2', _POST)
export const GET = withErrorLogging('/api/ai/chat-v2', _GET)
