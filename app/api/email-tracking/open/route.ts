// app/api/email-tracking/open/route.ts - Pixel tracking para aperturas de email
import { NextResponse } from 'next/server'
import { emailOpenQuerySchema } from '@/lib/api/email-tracking/schemas'
import {
  getUserEmailByProfile,
  checkRecentEvent,
  recordEmailEvent,
} from '@/lib/api/email-tracking/queries'

const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

function pixelResponse(cacheControl = 'no-cache, no-store, must-revalidate') {
  return new NextResponse(TRANSPARENT_PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': TRANSPARENT_PIXEL.length.toString(),
      'Cache-Control': cacheControl,
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const parsed = emailOpenQuerySchema.safeParse({
      email_id: searchParams.get('email_id') ?? undefined,
      user_id: searchParams.get('user_id') ?? undefined,
      email_type: searchParams.get('type') ?? undefined,
      template_id: searchParams.get('template_id') ?? undefined,
      campaign_id: searchParams.get('campaign_id') ?? undefined,
    })

    const params = parsed.success ? parsed.data : {
      user_id: searchParams.get('user_id') ?? undefined,
      email_type: searchParams.get('type') ?? 'motivation',
      template_id: searchParams.get('template_id') ?? undefined,
      campaign_id: searchParams.get('campaign_id') ?? undefined,
    }

    const userId = params.user_id
    const type = params.email_type ?? 'motivation'
    const templateId = params.template_id
    const campaignId = params.campaign_id

    console.log('📧 Email abierto:', { userId, type, templateId, campaignId })

    if (userId) {
      const isDuplicate = await checkRecentEvent(userId, 'opened', type, 5)

      if (isDuplicate) {
        console.log('⏸️ Apertura duplicada ignorada - cooldown de 5 minutos activo')
      } else {
        const email = await getUserEmailByProfile(userId)

        await recordEmailEvent({
          userId,
          eventType: 'opened',
          emailType: type,
          emailAddress: email ?? 'unknown@tracking.vence.es',
          subject: `${type} Email - Opened`,
          templateId: templateId ?? type,
          campaignId,
          emailContentPreview: `${type} email opened - tracking event`,
        })

        console.log('✅ Evento de apertura registrado con deduplicación')
      }
    }

    return pixelResponse()
  } catch (error) {
    console.error('❌ Error tracking email open:', error)
    return pixelResponse('no-cache')
  }
}
