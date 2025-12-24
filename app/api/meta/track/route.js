// app/api/meta/track/route.js
// Endpoint para enviar eventos a Meta Conversions API

import { NextResponse } from 'next/server'
import {
  trackMetaRegistration,
  trackMetaLead,
  trackMetaPurchase,
  trackMetaInitiateCheckout,
  sendMetaEvent
} from '@/lib/services/metaConversionsAPI'

export async function POST(request) {
  try {
    const body = await request.json()
    const {
      eventName,
      email,
      userId,
      fbclid,
      fbc,
      fbp,
      eventSourceUrl,
      customData = {}
    } = body

    // Extraer IP y User Agent del request
    const clientIpAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                            request.headers.get('x-real-ip') ||
                            null
    const clientUserAgent = request.headers.get('user-agent') || null

    console.log('📥 Meta Track API:', {
      eventName,
      email: email ? '***' + email.slice(-10) : null,
      userId: userId?.slice(0, 8) + '...',
      hasFbclid: !!fbclid,
      hasFbc: !!fbc
    })

    let result

    switch (eventName) {
      case 'CompleteRegistration':
        result = await trackMetaRegistration({
          email,
          userId,
          registrationSource: customData.registration_source || 'meta',
          fbclid,
          fbc,
          fbp,
          clientIpAddress,
          clientUserAgent,
          eventSourceUrl
        })
        break

      case 'Lead':
        result = await trackMetaLead({
          email,
          userId,
          source: customData.source || 'meta',
          fbclid,
          fbc,
          fbp,
          clientIpAddress,
          clientUserAgent,
          eventSourceUrl
        })
        break

      case 'Purchase':
        result = await trackMetaPurchase({
          email,
          userId,
          value: customData.value,
          currency: customData.currency || 'EUR',
          orderId: customData.orderId,
          productName: customData.productName,
          fbclid,
          fbc,
          fbp,
          clientIpAddress,
          clientUserAgent,
          eventSourceUrl
        })
        break

      case 'InitiateCheckout':
        result = await trackMetaInitiateCheckout({
          email,
          userId,
          value: customData.value,
          currency: customData.currency || 'EUR',
          productName: customData.productName,
          fbclid,
          fbc,
          fbp,
          clientIpAddress,
          clientUserAgent,
          eventSourceUrl
        })
        break

      default:
        // Evento personalizado
        result = await sendMetaEvent({
          eventName,
          userData: { email, externalId: userId },
          customData,
          fbclid,
          fbc,
          fbp,
          clientIpAddress,
          clientUserAgent,
          eventSourceUrl
        })
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        eventId: result.eventId,
        message: `Evento ${eventName} enviado a Meta`
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        eventId: result.eventId
      }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ Meta Track API Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
