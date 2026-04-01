// app/api/webhooks/resend-inbound/route.ts
// Endpoint que recibe emails entrantes de Resend Inbound
//
// Lógica:
// - Reply (Re: ...) del mismo remitente → continuar conversación existente
// - Email nuevo o asunto diferente → nueva conversación
// - Usuario registrado → vincula con userId
// - Contacto externo → sin userId, respuesta se envía directo por Resend

import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb as getDb } from '@/db/client'
import { userFeedback, feedbackConversations, feedbackMessages, userProfiles } from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { Webhook } from 'svix'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

// Resend inbound webhook payload
interface ResendInboundEmail {
  from: string
  to: string | string[]
  subject: string
  html?: string
  text?: string
  reply_to?: string
  created_at: string
  attachments?: Array<{
    filename: string
    content_type: string
    size: number
    url: string
  }>
  headers?: Record<string, string>
  sender?: string
}

interface ResendWebhookEvent {
  type: string
  created_at: string
  data: ResendInboundEmail
}

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match ? match[1].toLowerCase() : from.toLowerCase().trim()
}

function extractName(from: string): string {
  const match = from.match(/^([^<]+)</)
  return match ? match[1].trim().replace(/"/g, '') : ''
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Detecta si es un reply por el asunto (Re: / RE: / Fwd:) */
function isReply(subject: string): boolean {
  return /^(Re|RE|Fwd|FW|RV):\s/i.test(subject.trim())
}

/** Extrae el asunto original quitando prefijos Re:/Fwd: */
function stripReplyPrefix(subject: string): string {
  return subject.replace(/^(Re|RE|Fwd|FW|RV):\s*/gi, '').trim()
}

/** Limpia el texto de un reply quitando el contenido citado */
function stripQuotedText(text: string): string {
  // Cortar en la línea "El día X, Y escribió:" o "On X, Y wrote:"
  const patterns = [
    /\n\s*El\s+\d.*escribi[óo]:\s*\n/i,
    /\n\s*On\s+.+wrote:\s*\n/i,
    /\n\s*---+\s*Original\s+Message/i,
    /\n\s*---+\s*Mensaje\s+original/i,
    /\n\s*>+\s/,
    /\n\s*De:\s+.*\n/i,
    /\n\s*From:\s+.*\n/i,
  ]

  let cleanText = text
  for (const pattern of patterns) {
    const match = cleanText.match(pattern)
    if (match?.index) {
      cleanText = cleanText.substring(0, match.index)
    }
  }

  return cleanText.trim()
}

async function _POST(request: NextRequest) {
  try {
    // Verificar firma del webhook (Resend usa Svix)
    const rawBody = await request.text()
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

    if (webhookSecret) {
      const svixId = request.headers.get('svix-id')
      const svixTimestamp = request.headers.get('svix-timestamp')
      const svixSignature = request.headers.get('svix-signature')

      if (svixId && svixTimestamp && svixSignature) {
        try {
          const wh = new Webhook(webhookSecret)
          wh.verify(rawBody, {
            'svix-id': svixId,
            'svix-timestamp': svixTimestamp,
            'svix-signature': svixSignature,
          })
        } catch {
          console.error('📧 [Inbound] Firma webhook inválida')
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }
      }
    }

    const body = JSON.parse(rawBody) as ResendWebhookEvent | ResendInboundEmail
    const email = 'data' in body ? body.data : body

    const fromEmail = extractEmail(email.from)
    const fromName = extractName(email.from)
    const subject = email.subject || '(sin asunto)'
    const rawText = email.text || (email.html ? htmlToText(email.html) : '(sin contenido)')

    console.log(`📧 [Inbound] Email de ${fromEmail} — "${subject}"`)

    const db = getDb()

    // 1. Buscar si el usuario existe
    const userResult = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.email, fromEmail))
      .limit(1)

    const userId = userResult[0]?.id || null

    // 2. Detectar si es reply → buscar conversación existente
    if (isReply(subject)) {
      const originalSubject = stripReplyPrefix(subject)
      const messageText = stripQuotedText(rawText)

      console.log(`📧 [Inbound] Reply detectado — asunto original: "${originalSubject}"`)

      // Buscar conversación abierta del mismo remitente con asunto similar
      const existingConversations = await db
        .select({
          convId: feedbackConversations.id,
          feedbackId: feedbackConversations.feedbackId,
        })
        .from(feedbackConversations)
        .innerJoin(userFeedback, eq(feedbackConversations.feedbackId, userFeedback.id))
        .where(
          and(
            eq(userFeedback.email, fromEmail),
            eq(userFeedback.type, 'email'),
            sql`${feedbackConversations.status} != 'closed'`
          )
        )
        .orderBy(desc(feedbackConversations.lastMessageAt))
        .limit(5)

      // Buscar la que matchea por asunto original
      let matchedConvId: string | null = null

      if (existingConversations.length > 0) {
        // Buscar por asunto en el mensaje original del feedback
        for (const conv of existingConversations) {
          const [fb] = await db
            .select({ message: userFeedback.message })
            .from(userFeedback)
            .where(eq(userFeedback.id, conv.feedbackId!))
            .limit(1)

          if (fb?.message?.includes(originalSubject)) {
            matchedConvId = conv.convId
            break
          }
        }

        // Si no matchea por asunto, usar la más reciente del mismo email
        if (!matchedConvId) {
          matchedConvId = existingConversations[0].convId
        }
      }

      if (matchedConvId) {
        // Añadir mensaje a conversación existente
        await db.insert(feedbackMessages).values({
          conversationId: matchedConvId,
          senderId: userId,
          isAdmin: false,
          message: messageText || '(sin contenido)',
        })

        // Actualizar timestamp y reabirir si estaba en espera
        await db.update(feedbackConversations).set({
          lastMessageAt: new Date().toISOString(),
          status: 'open',
        }).where(eq(feedbackConversations.id, matchedConvId))

        console.log(`📧 [Inbound] Reply añadido a conversación ${matchedConvId.substring(0, 8)}`)
        return NextResponse.json({ received: true, action: 'reply', conversationId: matchedConvId })
      }

      // No se encontró conversación → crear nueva (fallthrough)
      console.log(`📧 [Inbound] Reply sin conversación previa — creando nueva`)
    }

    // 3. Email nuevo → crear feedback + conversación + mensaje
    const messageText = isReply(subject) ? stripQuotedText(rawText) : rawText

    const [feedback] = await db.insert(userFeedback).values({
      userId: userId,
      email: fromEmail,
      type: 'email',
      message: `**${subject}**\n\n${messageText}`,
      url: 'email-inbound',
      status: 'pending',
      priority: 'medium',
      wantsResponse: true,
    }).returning({ id: userFeedback.id })

    const [conversation] = await db.insert(feedbackConversations).values({
      feedbackId: feedback.id,
      userId: userId,
      status: 'open',
    }).returning({ id: feedbackConversations.id })

    await db.insert(feedbackMessages).values({
      conversationId: conversation.id,
      senderId: userId,
      isAdmin: false,
      message: `**De:** ${fromName ? fromName + ' <' + fromEmail + '>' : fromEmail}\n**Asunto:** ${subject}\n\n${messageText}`,
    })

    console.log(`📧 [Inbound] Nueva conversación ${conversation.id.substring(0, 8)} para ${fromEmail}`)
    return NextResponse.json({ received: true, action: 'new', feedbackId: feedback.id })

  } catch (error) {
    console.error('📧 [Inbound] Error procesando email:', error)
    // Siempre devolver 200 para que Resend no reintente
    return NextResponse.json({ received: true, error: 'processing_error' })
  }
}

async function _GET() {
  return NextResponse.json({ status: 'ok', service: 'resend-inbound' })
}

export const POST = withErrorLogging('/api/webhooks/resend-inbound', _POST)
export const GET = withErrorLogging('/api/webhooks/resend-inbound', _GET)
