// app/api/email/track-click/route.ts - API para tracking de clicks en emails (v2 con UA parsing)
import { NextResponse } from 'next/server'
import { emailTrackClickQuerySchema } from '@/lib/api/email-tracking/schemas'
import { getUserEmailByProfile, recordEmailEvent } from '@/lib/api/email-tracking/queries'
import { getDeviceType, getEmailClient } from '@/lib/api/email-tracking/helpers'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const parsed = emailTrackClickQuerySchema.safeParse({
      user_id: searchParams.get('user_id') ?? undefined,
      email_type: searchParams.get('email_type') ?? undefined,
      campaign_id: searchParams.get('campaign_id') ?? undefined,
      template_id: searchParams.get('template_id') ?? undefined,
      url: searchParams.get('url') ?? undefined,
      redirect: searchParams.get('redirect') ?? undefined,
    })

    const params = parsed.success ? parsed.data : {
      user_id: searchParams.get('user_id') ?? undefined,
      email_type: searchParams.get('email_type') ?? undefined,
      campaign_id: searchParams.get('campaign_id') ?? undefined,
      template_id: searchParams.get('template_id') ?? undefined,
      url: searchParams.get('url') ?? undefined,
      redirect: searchParams.get('redirect') ?? undefined,
    }

    const userId = params.user_id
    const emailType = params.email_type
    const linkClicked = params.url
    const redirectUrl = params.redirect ?? linkClicked ?? '/es'

    const userAgent = request.headers.get('user-agent') ?? ''
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const clientIp = forwardedFor?.split(',')[0] ?? realIp ?? 'unknown'

    const deviceType = getDeviceType(userAgent)
    const emailClient = getEmailClient(userAgent)

    if (userId && emailType && linkClicked) {
      const email = await getUserEmailByProfile(userId)

      await recordEmailEvent({
        userId,
        eventType: 'clicked',
        emailType,
        emailAddress: email ?? 'unknown@tracking.vence.es',
        linkClicked,
        clickCount: 1,
        deviceType,
        clientName: emailClient,
        ipAddress: clientIp,
        userAgent,
        campaignId: params.campaign_id ?? null,
        templateId: params.template_id ?? null,
      })

      console.log(`📧 Email click tracked: ${emailType} -> ${linkClicked}`)
    }

    return NextResponse.redirect(new URL(redirectUrl, request.url))
  } catch (error) {
    console.error('Error in email click tracking:', error)
    return NextResponse.redirect(new URL('/es', request.url))
  }
}
