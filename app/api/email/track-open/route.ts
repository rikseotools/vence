// app/api/email/track-open/route.ts - API para tracking de apertura de emails (v2 con UA parsing)
import { NextResponse } from 'next/server'
import { emailTrackOpenQuerySchema } from '@/lib/api/email-tracking/schemas'
import { getUserEmailByProfile, recordEmailEvent } from '@/lib/api/email-tracking/queries'
import { getDeviceType, getEmailClient } from '@/lib/api/email-tracking/helpers'

const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

function pixelResponse() {
  return new NextResponse(TRACKING_PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': TRACKING_PIXEL.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const parsed = emailTrackOpenQuerySchema.safeParse({
      user_id: searchParams.get('user_id') ?? undefined,
      email_type: searchParams.get('email_type') ?? undefined,
      campaign_id: searchParams.get('campaign_id') ?? undefined,
      template_id: searchParams.get('template_id') ?? undefined,
      timestamp: searchParams.get('timestamp') ?? undefined,
    })

    const params = parsed.success ? parsed.data : {
      user_id: searchParams.get('user_id') ?? undefined,
      email_type: searchParams.get('email_type') ?? undefined,
      campaign_id: searchParams.get('campaign_id') ?? undefined,
      template_id: searchParams.get('template_id') ?? undefined,
    }

    const userId = params.user_id
    const emailType = params.email_type

    const userAgent = request.headers.get('user-agent') ?? ''
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const clientIp = forwardedFor?.split(',')[0] ?? realIp ?? 'unknown'

    const deviceType = getDeviceType(userAgent)
    const emailClient = getEmailClient(userAgent)

    if (userId && emailType) {
      const email = await getUserEmailByProfile(userId)

      await recordEmailEvent({
        userId,
        eventType: 'opened',
        emailType,
        emailAddress: email ?? 'unknown@tracking.vence.es',
        openCount: 1,
        deviceType,
        clientName: emailClient,
        ipAddress: clientIp,
        userAgent,
        campaignId: params.campaign_id ?? null,
        templateId: params.template_id ?? null,
      })

      console.log(`📧 Email open tracked via pixel: ${emailType}`)
    }

    return pixelResponse()
  } catch (error) {
    console.error('Error in email tracking pixel:', error)
    return pixelResponse()
  }
}
