// app/api/webhooks/resend-inbound/route.ts
// Endpoint que recibe emails entrantes de Resend Inbound
// Docs: https://resend.com/docs/receive-emails

import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb as getDb } from '@/db/client'
import { userFeedback, feedbackConversations, feedbackMessages, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
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
  // Attachments
  attachments?: Array<{
    filename: string
    content_type: string
    size: number
    url: string
  }>
  // Headers
  headers?: Record<string, string>
  // Raw sender info
  sender?: string
}

interface ResendWebhookEvent {
  type: string
  created_at: string
  data: ResendInboundEmail
}

// Extract email address from "Name <email>" format
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match ? match[1].toLowerCase() : from.toLowerCase().trim()
}

function extractName(from: string): string {
  const match = from.match(/^([^<]+)</)
  return match ? match[1].trim().replace(/"/g, '') : ''
}

// Convert HTML to plain text (basic)
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

    // Resend puede enviar el evento envuelto o directo
    const email = 'data' in body ? body.data : body

    const fromEmail = extractEmail(email.from)
    const fromName = extractName(email.from)
    const subject = email.subject || '(sin asunto)'
    const messageText = email.text || (email.html ? htmlToText(email.html) : '(sin contenido)')

    console.log(`📧 [Inbound] Email de ${fromEmail} — "${subject}"`)

    const db = getDb()

    // 1. Buscar si el usuario existe por email
    const userResult = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.email, fromEmail))
      .limit(1)

    const userId = userResult[0]?.id || null

    // 2. Crear entrada en user_feedback
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

    console.log(`📧 [Inbound] Feedback creado: ${feedback.id.substring(0, 8)}`)

    // 3. Crear conversación
    const [conversation] = await db.insert(feedbackConversations).values({
      feedbackId: feedback.id,
      userId: userId,
      status: 'open',
    }).returning({ id: feedbackConversations.id })

    // 4. Crear primer mensaje
    await db.insert(feedbackMessages).values({
      conversationId: conversation.id,
      senderId: userId,
      isAdmin: false,
      message: `**De:** ${fromName ? fromName + ' <' + fromEmail + '>' : fromEmail}\n**Asunto:** ${subject}\n\n${messageText}`,
    })

    console.log(`📧 [Inbound] Conversación ${conversation.id.substring(0, 8)} creada para ${fromEmail}`)

    return NextResponse.json({ received: true, feedbackId: feedback.id })
  } catch (error) {
    console.error('📧 [Inbound] Error procesando email:', error)
    // Siempre devolver 200 para que Resend no reintente
    return NextResponse.json({ received: true, error: 'processing_error' })
  }
}

// Resend puede hacer GET para verificar el endpoint
async function _GET() {
  return NextResponse.json({ status: 'ok', service: 'resend-inbound' })
}

export const POST = withErrorLogging(_POST, '/api/webhooks/resend-inbound')
export const GET = withErrorLogging(_GET, '/api/webhooks/resend-inbound')
