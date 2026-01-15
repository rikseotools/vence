// app/api/ai/chat-v2/route.ts
// Nueva arquitectura de chat con TypeScript, Drizzle y Zod

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  buildChatContext,
  getOrchestrator,
} from '@/lib/chat/core'
import { logger, handleError } from '@/lib/chat/shared'

// Cliente Supabase para logging (la tabla ai_chat_logs no está en Drizzle schema)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
})

const FREE_USER_DAILY_LIMIT = 5

/**
 * Obtener nombre del usuario desde user_profiles
 */
async function getUserName(userId: string): Promise<string | undefined> {
  if (!userId || userId === 'anonymous') return undefined

  try {
    const { data, error } = await supabase
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
 */
async function getUserDailyMessageCount(userId: string): Promise<number> {
  if (!userId) return 0

  try {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const { count, error } = await supabase
      .from('ai_chat_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString())
      .eq('had_error', false)

    if (error) {
      logger.error('Error counting daily messages', error)
      return 0
    }

    return count || 0
  } catch (error) {
    logger.error('Error counting daily messages', error)
    return 0
  }
}

/**
 * Guardar log de la interacción
 */
async function logChatInteraction(data: {
  userId?: string | null
  message: string
  response?: string | null
  sources?: string[]
  questionContextId?: string | null
  questionContextLaw?: string | null
  suggestionUsed?: string | null
  responseTimeMs?: number | null
  tokensUsed?: number | null
  hadError?: boolean
  errorMessage?: string | null
  userOposicion?: string | null
  detectedLaws?: string[]
}): Promise<string | null> {
  try {
    const { data: result, error } = await supabase
      .from('ai_chat_logs')
      .insert({
        user_id: data.userId || null,
        message: data.message,
        response_preview: data.response?.substring(0, 500) || null,
        full_response: data.response || null,
        sources_used: data.sources || [],
        question_context_id: data.questionContextId || null,
        question_context_law: data.questionContextLaw || null,
        suggestion_used: data.suggestionUsed || null,
        response_time_ms: data.responseTimeMs || null,
        tokens_used: data.tokensUsed || null,
        had_error: data.hadError || false,
        error_message: data.errorMessage || null,
        user_oposicion: data.userOposicion || null,
        detected_laws: data.detectedLaws || [],
      })
      .select('id')
      .single()

    if (error) {
      logger.error('Error logging chat interaction', error)
      return null
    }

    return result?.id || null
  } catch (error) {
    logger.error('Error logging chat interaction', error)
    return null
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
    if (data.userId && !data.isPremium) {
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

    // Obtener orquestador y procesar
    const orchestrator = getOrchestrator()

    if (data.stream) {
      // Respuesta streaming
      const originalStream = await orchestrator.processStream(context)

      // Crear un stream que capture la respuesta completa para logging
      let fullResponse = ''
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()

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
            } catch {
              // Ignorar chunks que no son JSON válido
            }
          }
        },
        async flush(controller) {
          // Cuando termina el stream, loguear la respuesta completa
          const logId = await logChatInteraction({
            userId: data.userId,
            message: data.message,
            response: fullResponse || null,
            questionContextId: data.questionContext?.questionId,
            questionContextLaw: data.questionContext?.lawName,
            suggestionUsed: data.suggestionUsed,
            userOposicion: data.userOposicion,
            responseTimeMs: Date.now() - startTime,
          })

          // Enviar logId para feedback
          if (logId) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'logId', logId })}\n\n`))
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
      // Respuesta normal (sin streaming)
      const response = await orchestrator.process(context)

      // Log
      await logChatInteraction({
        userId: data.userId,
        message: data.message,
        response: response.content,
        sources: response.metadata?.sources?.map(s => `${s.lawName} Art. ${s.articleNumber}`) || [],
        questionContextId: data.questionContext?.questionId,
        questionContextLaw: data.questionContext?.lawName,
        suggestionUsed: data.suggestionUsed,
        responseTimeMs: Date.now() - startTime,
        userOposicion: data.userOposicion,
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
