// app/api/ai/chat-v2/route.ts
// Nueva arquitectura de chat con TypeScript, Drizzle y Zod

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

// Cliente Supabase para queries que no están en Drizzle (getUserDailyMessageCount, getUserName)
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

const FREE_USER_DAILY_LIMIT = 5

// Sugerencias que NO cuentan contra el límite diario (explicaciones de preguntas)
// Estas son parte del flujo de estudio, no "chat libre"
const EXEMPT_SUGGESTIONS = [
  'explicar_respuesta',
  'explicar_psico',
  'analizar_psico',
  'Explícame la respuesta correcta',
]

/**
 * Obtener nombre del usuario desde user_profiles
 */
async function getUserName(userId: string): Promise<string | undefined> {
  if (!userId || userId === 'anonymous') return undefined

  try {
    const { data, error } = await getSupabase()
      .from('user_profiles')
      .select('nickname, full_name')
      .eq('id', userId)
      .single()

    if (error || !data) return undefined

    // Preferir nickname, luego full_name
    const name = data.nickname || data.full_name
    if (!name) return undefined

    // Extraer solo el primer nombre
    return name.split(' ')[0]
  } catch {
    return undefined
  }
}

/**
 * Obtener conteo de mensajes del día para rate limiting
 * Excluye las explicaciones de preguntas (EXEMPT_SUGGESTIONS)
 */
async function getUserDailyMessageCount(userId: string): Promise<number> {
  if (!userId) return 0

  try {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    // Contar mensajes del día excluyendo las explicaciones de preguntas
    const { data, error } = await getSupabase()
      .from('ai_chat_logs')
      .select('suggestion_used')
      .eq('user_id', userId)
      .gte('created_at', today.toISOString())
      .eq('had_error', false)

    if (error) {
      logger.error('Error counting daily messages', error)
      return 0
    }

    // Filtrar: solo contar mensajes que NO son explicaciones exentas
    const countableMessages = data?.filter(msg =>
      !msg.suggestion_used || !EXEMPT_SUGGESTIONS.includes(msg.suggestion_used)
    ) || []

    return countableMessages.length
  } catch (error) {
    logger.error('Error counting daily messages', error)
    return 0
  }
}

export async function POST(request: NextRequest) {
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

    // Rate limiting para usuarios free
    // Las explicaciones de preguntas (EXEMPT_SUGGESTIONS) no cuentan contra el límite
    const isExemptSuggestion = data.suggestionUsed && EXEMPT_SUGGESTIONS.includes(data.suggestionUsed)

    if (data.userId && !data.isPremium && !isExemptSuggestion) {
      const dailyCount = await getUserDailyMessageCount(data.userId)
      if (dailyCount >= FREE_USER_DAILY_LIMIT) {
        logger.warn('Rate limit exceeded', {
          domain: 'api',
          userId: data.userId,
          count: dailyCount,
        })

        return NextResponse.json(
          {
            success: false,
            error: 'Límite diario de mensajes alcanzado',
            code: 'RATE_LIMIT',
            dailyUsed: dailyCount,
            dailyLimit: FREE_USER_DAILY_LIMIT,
          },
          { status: 429 }
        )
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
        questionTypeName: qc.questionTypeName || undefined,
        contentData: qc.contentData || undefined,
      }
    }

    // Obtener nombre del usuario para personalización
    const userName = data.userId ? await getUserName(data.userId) : undefined
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

      // Variables para capturar metadata del SSE (sources, tokens)
      let capturedSources: string[] = []
      let capturedTokensUsed: number | null = null

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
              // Capturar metadata (sources, tokensUsed) del chunk tipo 'meta'
              if (parsed.type === 'meta' && parsed.sources) {
                capturedSources = parsed.sources.map((s: { law?: string; article?: string }) =>
                  `${s.law || ''} Art. ${s.article || ''}`
                )
                capturedTokensUsed = parsed.tokensUsed || null
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
          })

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
      })

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
export async function GET() {
  return NextResponse.json(
    { error: 'Método no permitido. Usa POST.' },
    { status: 405 }
  )
}
