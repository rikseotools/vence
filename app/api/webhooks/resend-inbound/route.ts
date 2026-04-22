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
  // Cortar en la línea "El día/Xday X, Y escribió:" o "On X, Y wrote:"
  // Gmail en español usa "El sáb, 11 abr 2026 a las 18:07, X escribió:"
  // Gmail en inglés usa "On Sat, Apr 11, 2026 at 6:07 PM, X wrote:"
  const patterns = [
    /\n\s*El\s+.+escribi[óo]:\s*\n/i,
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

  const stripped = cleanText.trim()
  // Si tras el stripping queda vacío pero el original no lo estaba,
  // devolver el original trimmed para no perder contenido.
  if (!stripped && text.trim()) return text.trim()
  return stripped
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

    // Capturar Message-ID original para email threading. Lo guardamos en
    // user_feedback.referrer (que para inbound emails es siempre null).
    // Resend a veces lo pone en email.headers['message-id'] y a veces como
    // 'Message-ID' (case-sensitive). También puede venir dentro de la
    // Received Emails API. Buscamos en todos los sitios posibles.
    function extractMessageId(src: Record<string, unknown> | undefined | null): string | null {
      if (!src) return null
      const h = src as Record<string, string>
      const candidates = [
        h['message-id'], h['Message-ID'], h['Message-Id'], h['MESSAGE-ID'],
      ]
      for (const c of candidates) {
        if (typeof c === 'string' && c.trim()) {
          // Limpieza: quitar < > si vienen pegados, y mantener formato <id@host>
          const trimmed = c.trim()
          return trimmed.startsWith('<') ? trimmed : `<${trimmed.replace(/[<>]/g, '')}>`
        }
      }
      return null
    }
    let originalMessageId: string | null = extractMessageId(email.headers)

    // Resend Inbound webhook NO incluye el body del email en el payload, solo metadata
    // + email_id. Para obtener text/html hay que hacer fetch a la Received Emails API:
    //   GET https://api.resend.com/emails/receiving/{id}
    // Ref: https://resend.com/docs/api-reference/emails/retrieve-received-email
    const e = email as unknown as Record<string, unknown>
    const emailId = typeof e.email_id === 'string' ? e.email_id : (typeof e.id === 'string' ? e.id : null)

    let rawText = ''
    let usedField = ''

    // Intento 1: leer text/html directamente del payload (por si Resend lo añade en el futuro)
    if (typeof e.text === 'string' && e.text.trim()) {
      rawText = e.text
      usedField = 'payload.text'
    } else if (typeof e.html === 'string' && e.html.trim()) {
      rawText = htmlToText(e.html)
      usedField = 'payload.html'
    }

    // Intento 2: fetch a la Received Emails API con el email_id
    if ((!rawText.trim() || !originalMessageId) && emailId) {
      try {
        const apiRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        })
        if (apiRes.ok) {
          const full = await apiRes.json() as { text?: string | null; html?: string | null; headers?: Record<string, string> | null }
          if (!rawText.trim()) {
            if (full.text && full.text.trim()) {
              rawText = full.text
              usedField = 'api.text'
            } else if (full.html && full.html.trim()) {
              rawText = htmlToText(full.html)
              usedField = 'api.html'
            } else {
              console.error(`📧 [Inbound] API de Resend devolvió text y html vacíos para email_id=${emailId}`)
            }
          }
          // Capturar Message-ID también de los headers de la Received API
          if (!originalMessageId && full.headers) {
            originalMessageId = extractMessageId(full.headers)
          }
        } else {
          const errBody = await apiRes.text().catch(() => '<no body>')
          console.error(`📧 [Inbound] Received Emails API falló: HTTP ${apiRes.status} para email_id=${emailId} — ${errBody.slice(0, 200)}`)
        }
      } catch (fetchErr) {
        console.error(`📧 [Inbound] Excepción llamando a Received Emails API para email_id=${emailId}:`, fetchErr)
      }
    }

    // Si seguimos sin contenido, loguear el payload completo para diagnóstico
    if (!rawText.trim()) {
      const payloadKeys = Object.keys(e).sort()
      const sample: Record<string, unknown> = {}
      for (const k of payloadKeys) {
        const v = e[k]
        if (typeof v === 'string') {
          sample[k] = v.length > 200 ? v.slice(0, 200) + '...' : v
        } else if (v === null || v === undefined || typeof v !== 'object') {
          sample[k] = v
        } else {
          sample[k] = `[${Array.isArray(v) ? 'array' : 'object'}]`
        }
      }
      console.error('📧 [Inbound] BODY VACÍO tras payload+API — snapshot del webhook:', JSON.stringify(sample))
    }

    console.log(`📧 [Inbound] Email de ${fromEmail} — "${subject}" (source=${usedField || 'NINGUNO'}, len=${rawText.length}, emailId=${emailId || 'NO'})`)

    // 0a. Filtrar emails automáticos que no son de usuarios reales
    const ignoredSenders = [
      'noreply-dmarc-support@google.com',
      'noreply@google.com',
      'mailer-daemon@',
      'postmaster@',
      'noreply@',
      'no-reply@',
      'ses@web-cursos.es', // spam: cursos IA (21/04/2026)
    ]

    const isAutomated = ignoredSenders.some(pattern =>
      pattern.endsWith('@') ? fromEmail.startsWith(pattern) : fromEmail === pattern
    )

    // También ignorar reportes DMARC por asunto
    const isDmarcReport = subject.toLowerCase().includes('report domain:') ||
      subject.toLowerCase().includes('dmarc report') ||
      subject.toLowerCase().includes('report-id:')

    if (isAutomated || isDmarcReport) {
      console.log(`📧 [Inbound] Email automático ignorado: ${fromEmail} — "${subject}"`)
      return NextResponse.json({ received: true, action: 'automated_ignored' })
    }

    const db = getDb()

    // 0b. Deduplicación: si ya existe un feedback con el mismo email + asunto creado en los últimos 60s, ignorar
    const recentDuplicates = await db
      .select({ id: userFeedback.id })
      .from(userFeedback)
      .where(
        and(
          eq(userFeedback.email, fromEmail),
          eq(userFeedback.type, 'email'),
          sql`${userFeedback.createdAt} > NOW() - INTERVAL '60 seconds'`
        )
      )
      .limit(1)

    if (recentDuplicates.length > 0) {
      // Verificar si el asunto matchea
      const [recent] = await db
        .select({ message: userFeedback.message })
        .from(userFeedback)
        .where(eq(userFeedback.id, recentDuplicates[0].id))
        .limit(1)

      if (recent?.message?.includes(subject) || recent?.message?.includes(rawText.substring(0, 50))) {
        console.log(`📧 [Inbound] Duplicado detectado — ignorando`)
        return NextResponse.json({ received: true, action: 'duplicate_ignored' })
      }
    }

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
        // Si no hay body, pero el subject tiene contenido útil, usarlo como mensaje
        // (típico: emails cortos con la info solo en el asunto).
        const finalMessage = messageText.trim()
          || (subject && subject !== '(sin asunto)' ? `📧 (Email sin cuerpo — asunto: "${subject}")` : '')

        if (!finalMessage) {
          console.error(`📧 [Inbound] Reply sin body y sin subject útil de ${fromEmail} — ignorando`)
          return NextResponse.json({ received: true, action: 'empty_body_ignored', conversationId: matchedConvId })
        }
        // Añadir mensaje a conversación existente
        await db.insert(feedbackMessages).values({
          conversationId: matchedConvId,
          senderId: userId,
          isAdmin: false,
          message: finalMessage,
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

    // Si no hay body pero sí subject útil, crear feedback con placeholder explícito.
    // Solo ignoramos si TANTO body como subject están vacíos.
    const finalMessage = messageText.trim()
      || (subject && subject !== '(sin asunto)' ? `📧 (Email sin cuerpo — asunto: "${subject}")` : '')

    if (!finalMessage) {
      console.error(`📧 [Inbound] Email sin body y sin subject útil de ${fromEmail} — no se crea feedback`)
      return NextResponse.json({ received: true, action: 'empty_body_ignored' })
    }

    // user_feedback.message guarda SOLO el subject (cabecera de "Solicitud original"
    // en el admin). El body va únicamente en feedback_messages para evitar duplicación
    // en la UI, que muestra ambos.
    const [feedback] = await db.insert(userFeedback).values({
      userId: userId,
      email: fromEmail,
      type: 'email',
      message: subject,
      url: 'email-inbound',
      status: 'pending',
      priority: 'medium',
      wantsResponse: true,
      // referrer se reusa para almacenar el Message-ID original del email
      // entrante. Permite hacer email threading correcto al responder
      // (In-Reply-To + References + Subject "Re: ..."). Si no hay header
      // Message-ID accesible, queda null y se manda como email nuevo.
      referrer: originalMessageId,
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
      message: finalMessage,
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
