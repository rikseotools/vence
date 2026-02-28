// app/api/email-tracking/click/route.ts - Tracking de clicks en botones de email
import { NextResponse } from 'next/server'
import { emailClickQuerySchema } from '@/lib/api/email-tracking/schemas'
import {
  getUserEmailByProfile,
  checkRecentEvent,
  recordEmailEvent,
} from '@/lib/api/email-tracking/queries'

const DEFAULT_REDIRECT = 'https://www.vence.es/auxiliar-administrativo-estado/test'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  try {
    const parsed = emailClickQuerySchema.safeParse({
      email_id: searchParams.get('email_id') ?? undefined,
      user_id: searchParams.get('user_id') ?? undefined,
      action: searchParams.get('action') ?? undefined,
      email_type: searchParams.get('type') ?? undefined,
      template_id: searchParams.get('template_id') ?? undefined,
      campaign_id: searchParams.get('campaign_id') ?? undefined,
      redirect: searchParams.get('redirect') ?? undefined,
    })

    const params = parsed.success ? parsed.data : {
      user_id: searchParams.get('user_id') ?? undefined,
      action: searchParams.get('action') ?? 'unknown',
      email_type: searchParams.get('type') ?? 'motivation',
      template_id: searchParams.get('template_id') ?? undefined,
      campaign_id: searchParams.get('campaign_id') ?? undefined,
      redirect: searchParams.get('redirect') ?? undefined,
    }

    const userId = params.user_id
    const type = params.email_type ?? 'motivation'
    const action = params.action ?? 'unknown'
    const redirect = params.redirect
    const templateId = params.template_id
    const campaignId = params.campaign_id

    console.log('🖱️ Email click:', { userId, action, type, templateId, campaignId, redirect })

    if (userId) {
      const isDuplicate = await checkRecentEvent(userId, 'clicked', type, 2)

      if (isDuplicate) {
        console.log('⏸️ Click duplicado ignorado - cooldown de 2 minutos activo')
      } else {
        const email = await getUserEmailByProfile(userId)

        await recordEmailEvent({
          userId,
          eventType: 'clicked',
          emailType: type,
          emailAddress: email ?? 'unknown@tracking.vence.es',
          subject: `${type} Email - Clicked`,
          templateId: templateId ?? type,
          campaignId,
          emailContentPreview: `${type} email link clicked: ${action} -> ${redirect}`,
        })

        console.log('✅ Evento de click registrado con deduplicación')
      }
    }

    if (redirect) {
      return NextResponse.redirect(redirect, { status: 302 })
    }

    return NextResponse.redirect(DEFAULT_REDIRECT, { status: 302 })
  } catch (error) {
    console.error('❌ Error tracking email click:', error)

    const fallbackUrl = searchParams.get('redirect') ?? DEFAULT_REDIRECT
    return NextResponse.redirect(fallbackUrl, { status: 302 })
  }
}
