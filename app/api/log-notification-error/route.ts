// app/api/log-notification-error/route.ts
// API para recibir logs de errores de notificaciones y mostrarlos en Vercel
import { NextResponse } from 'next/server'
import { z } from 'zod/v3'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
const notificationErrorSchema = z.object({
  error: z.string(),
  details: z.object({
    userId: z.string().optional(),
    userEmail: z.string().optional(),
    type: z.string().optional(),
    title: z.string().optional(),
    body: z.string().optional(),
  }),
  timestamp: z.string().optional(),
})

async function _POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = notificationErrorSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { error, details, timestamp } = parsed.data

    // Log estructurado que aparecerá en Vercel logs
    console.error('🚨 NOTIFICATION_ERROR:', {
      error_type: error,
      timestamp,
      user_id: details.userId,
      user_email: details.userEmail,
      missing_fields: {
        type: details.type === 'MISSING' ? 'MISSING' : 'OK',
        title: details.title === 'MISSING' ? 'MISSING' : 'OK',
        body: details.body === 'MISSING' ? 'MISSING' : 'OK',
      },
    })

    return NextResponse.json({
      status: 'logged',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ Error in log-notification-error API:', error)
    return NextResponse.json(
      { error: 'Failed to log notification error' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/log-notification-error', _POST)
