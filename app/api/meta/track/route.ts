// app/api/meta/track/route.ts
// Endpoint para enviar eventos a Meta Conversions API
import { NextResponse } from 'next/server'
import {
  trackMetaRegistration,
  trackMetaLead,
  trackMetaPurchase,
  trackMetaInitiateCheckout,
  sendMetaEvent,
} from '@/lib/services/metaConversionsAPI'
import { z } from 'zod/v3'

const metaTrackSchema = z.object({
  eventName: z.string().min(1),
  email: z.string().optional(),
  userId: z.string().optional(),
  fbclid: z.string().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
  eventSourceUrl: z.string().optional(),
  customData: z.record(z.unknown()).default({}),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = metaTrackSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload' },
        { status: 400 }
      )
    }

    const {
      eventName,
      email,
      userId,
      fbclid,
      fbc,
      fbp,
      eventSourceUrl,
      customData,
    } = parsed.data

    // Extraer IP y User Agent del request
    const clientIpAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null
    const clientUserAgent = request.headers.get('user-agent') ?? null

    console.log('📥 Meta Track API:', {
      eventName,
      email: email ? '***' + email.slice(-10) : null,
      userId: userId ? userId.slice(0, 8) + '...' : null,
      hasFbclid: !!fbclid,
      hasFbc: !!fbc,
    })

    let result: { success: boolean; eventId?: string; error?: string }

    // metaConversionsAPI.js uses JSDoc — TS infers strict param types.
    // All callers pass optional fields that may be undefined, matching the
    // original JS behaviour. We cast each call to silence the mismatch.
    switch (eventName) {
      case 'CompleteRegistration':
        result = await (trackMetaRegistration as Function)({
          email, userId,
          registrationSource: (customData.registration_source as string) ?? 'meta',
          fbclid, fbc, fbp, clientIpAddress, clientUserAgent, eventSourceUrl,
        })
        break

      case 'Lead':
        result = await (trackMetaLead as Function)({
          email, userId,
          source: (customData.source as string) ?? 'meta',
          fbclid, fbc, fbp, clientIpAddress, clientUserAgent, eventSourceUrl,
        })
        break

      case 'Purchase':
        result = await (trackMetaPurchase as Function)({
          email, userId,
          value: customData.value, currency: (customData.currency as string) ?? 'EUR',
          orderId: customData.orderId, productName: customData.productName,
          fbclid, fbc, fbp, clientIpAddress, clientUserAgent, eventSourceUrl,
        })
        break

      case 'InitiateCheckout':
        result = await (trackMetaInitiateCheckout as Function)({
          email, userId,
          value: customData.value, currency: (customData.currency as string) ?? 'EUR',
          productName: customData.productName,
          fbclid, fbc, fbp, clientIpAddress, clientUserAgent, eventSourceUrl,
        })
        break

      default:
        result = await (sendMetaEvent as Function)({
          eventName,
          userData: { email, externalId: userId },
          customData,
          fbclid, fbc, fbp, clientIpAddress, clientUserAgent, eventSourceUrl,
        })
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        eventId: result.eventId,
        message: `Evento ${eventName} enviado a Meta`,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          eventId: result.eventId,
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('❌ Meta Track API Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
