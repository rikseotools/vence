// lib/services/metaConversionsAPI.ts
// Meta Conversions API (CAPI) - Server-side tracking para Facebook/Instagram Ads
// Docs: https://developers.facebook.com/docs/marketing-api/conversions-api

import crypto from 'crypto'

const META_PIXEL_ID = process.env.META_PIXEL_ID
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN
const META_API_VERSION = 'v21.0'
const META_API_URL = `https://graph.facebook.com/${META_API_VERSION}/${META_PIXEL_ID}/events`

interface MetaUserData {
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  city?: string
  country?: string
  externalId?: string
}

interface MetaEventParams {
  eventName: string
  userData?: MetaUserData
  customData?: Record<string, unknown>
  eventSourceUrl?: string
  fbclid?: string | null
  fbc?: string | null
  fbp?: string | null
  clientIpAddress?: string | null
  clientUserAgent?: string | null
  actionSource?: string
}

interface MetaEventResult {
  success: boolean
  error?: string
  eventId?: string
  result?: unknown
}

interface MetaRegistrationParams {
  email?: string
  userId?: string
  registrationSource?: string
  fbclid?: string | null
  fbc?: string | null
  fbp?: string | null
  clientIpAddress?: string | null
  clientUserAgent?: string | null
  eventSourceUrl?: string
}

interface MetaLeadParams {
  email?: string
  userId?: string
  source?: string
  fbclid?: string | null
  fbc?: string | null
  fbp?: string | null
  clientIpAddress?: string | null
  clientUserAgent?: string | null
  eventSourceUrl?: string
}

interface MetaPurchaseParams {
  email?: string
  userId?: string
  value?: number
  currency?: string
  orderId?: string
  productName?: string
  fbclid?: string | null
  fbc?: string | null
  fbp?: string | null
  clientIpAddress?: string | null
  clientUserAgent?: string | null
  eventSourceUrl?: string
}

interface MetaCheckoutParams {
  email?: string
  userId?: string
  value?: number
  currency?: string
  productName?: string
  fbclid?: string | null
  fbc?: string | null
  fbp?: string | null
  clientIpAddress?: string | null
  clientUserAgent?: string | null
  eventSourceUrl?: string
}

interface MetaTrafficParams {
  fbclid?: string | null
  fbc?: string | null
  fbp?: string | null
  utmSource?: string | null
}

interface MetaExtractedParams {
  fbclid: string | null
  fbc: string | null
  fbp: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  clientIpAddress: string | null
  clientUserAgent: string | null
  isFromMeta: boolean
}

function hashData(data: string | null | undefined): string | null {
  if (!data) return null
  const normalized = String(data).toLowerCase().trim()
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null
  return email.toLowerCase().trim()
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  // Eliminar todo excepto números y +
  let normalized = phone.replace(/[^\d+]/g, '')
  // Añadir código de país si no lo tiene
  if (!normalized.startsWith('+')) {
    normalized = '+34' + normalized // España por defecto
  }
  return normalized
}

function generateEventId(): string {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`
}

export async function sendMetaEvent({
  eventName,
  userData = {},
  customData = {},
  eventSourceUrl,
  fbclid,
  fbc,
  fbp,
  clientIpAddress,
  clientUserAgent,
  actionSource = 'website'
}: MetaEventParams): Promise<MetaEventResult> {
  // Validar configuración
  if (!META_PIXEL_ID || !META_ACCESS_TOKEN) {
    console.warn('⚠️ Meta CAPI: Faltan credenciales (META_PIXEL_ID o META_ACCESS_TOKEN)')
    return { success: false, error: 'Missing credentials' }
  }

  const eventId = generateEventId()
  const eventTime = Math.floor(Date.now() / 1000)

  // Construir datos de usuario hasheados
  const userDataHashed: Record<string, unknown> = {}

  if (userData.email) {
    userDataHashed.em = [hashData(normalizeEmail(userData.email))]
  }
  if (userData.phone) {
    userDataHashed.ph = [hashData(normalizePhone(userData.phone))]
  }
  if (userData.firstName) {
    userDataHashed.fn = [hashData(userData.firstName)]
  }
  if (userData.lastName) {
    userDataHashed.ln = [hashData(userData.lastName)]
  }
  if (userData.city) {
    userDataHashed.ct = [hashData(userData.city)]
  }
  if (userData.country) {
    userDataHashed.country = [hashData(userData.country)]
  }
  if (userData.externalId) {
    userDataHashed.external_id = [hashData(userData.externalId)]
  }

  // Añadir identificadores de click si están disponibles
  if (fbc) {
    userDataHashed.fbc = fbc
  } else if (fbclid) {
    // Construir fbc desde fbclid: fb.1.timestamp.fbclid
    userDataHashed.fbc = `fb.1.${eventTime}.${fbclid}`
  }

  if (fbp) {
    userDataHashed.fbp = fbp
  }

  // IP y User Agent
  if (clientIpAddress) {
    userDataHashed.client_ip_address = clientIpAddress
  }
  if (clientUserAgent) {
    userDataHashed.client_user_agent = clientUserAgent
  }

  // Construir payload
  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        event_id: eventId,
        action_source: actionSource,
        event_source_url: eventSourceUrl,
        user_data: userDataHashed,
        custom_data: customData
      }
    ]
  }

  // Si es test, añadir test_event_code
  if (process.env.META_TEST_EVENT_CODE) {
    payload.test_event_code = process.env.META_TEST_EVENT_CODE
  }

  try {
    console.log('📤 Meta CAPI: Enviando evento', eventName, {
      event_id: eventId,
      has_email: !!userData.email,
      has_fbclid: !!fbclid,
      has_fbc: !!fbc
    })

    const response = await fetch(`${META_API_URL}?access_token=${META_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('❌ Meta CAPI Error:', result)
      return { success: false, error: result.error?.message || 'Unknown error', eventId }
    }

    console.log('✅ Meta CAPI: Evento enviado correctamente', {
      event_name: eventName,
      event_id: eventId,
      events_received: result.events_received
    })

    return { success: true, eventId, result }

  } catch (error) {
    console.error('❌ Meta CAPI Exception:', error)
    return { success: false, error: (error as Error).message, eventId }
  }
}

export async function trackMetaRegistration({
  email,
  userId,
  registrationSource,
  fbclid,
  fbc,
  fbp,
  clientIpAddress,
  clientUserAgent,
  eventSourceUrl
}: MetaRegistrationParams): Promise<MetaEventResult> {
  return sendMetaEvent({
    eventName: 'CompleteRegistration',
    userData: {
      email,
      externalId: userId
    },
    customData: {
      registration_source: registrationSource,
      content_name: 'Vence - Oposiciones',
      status: 'registered'
    },
    fbclid,
    fbc,
    fbp,
    clientIpAddress,
    clientUserAgent,
    eventSourceUrl: eventSourceUrl || 'https://www.vence.es'
  })
}

export async function trackMetaLead({
  email,
  userId,
  source,
  fbclid,
  fbc,
  fbp,
  clientIpAddress,
  clientUserAgent,
  eventSourceUrl
}: MetaLeadParams): Promise<MetaEventResult> {
  return sendMetaEvent({
    eventName: 'Lead',
    userData: {
      email,
      externalId: userId
    },
    customData: {
      lead_source: source,
      content_name: 'Vence - Oposiciones'
    },
    fbclid,
    fbc,
    fbp,
    clientIpAddress,
    clientUserAgent,
    eventSourceUrl: eventSourceUrl || 'https://www.vence.es'
  })
}

export async function trackMetaPurchase({
  email,
  userId,
  value,
  currency = 'EUR',
  orderId,
  productName,
  fbclid,
  fbc,
  fbp,
  clientIpAddress,
  clientUserAgent,
  eventSourceUrl
}: MetaPurchaseParams): Promise<MetaEventResult> {
  return sendMetaEvent({
    eventName: 'Purchase',
    userData: {
      email,
      externalId: userId
    },
    customData: {
      value,
      currency,
      order_id: orderId,
      content_name: productName || 'Vence Premium',
      content_type: 'product'
    },
    fbclid,
    fbc,
    fbp,
    clientIpAddress,
    clientUserAgent,
    eventSourceUrl: eventSourceUrl || 'https://www.vence.es/premium'
  })
}

export async function trackMetaInitiateCheckout({
  email,
  userId,
  value,
  currency = 'EUR',
  productName,
  fbclid,
  fbc,
  fbp,
  clientIpAddress,
  clientUserAgent,
  eventSourceUrl
}: MetaCheckoutParams): Promise<MetaEventResult> {
  return sendMetaEvent({
    eventName: 'InitiateCheckout',
    userData: {
      email,
      externalId: userId
    },
    customData: {
      value,
      currency,
      content_name: productName || 'Vence Premium',
      content_type: 'product',
      num_items: 1
    },
    fbclid,
    fbc,
    fbp,
    clientIpAddress,
    clientUserAgent,
    eventSourceUrl: eventSourceUrl || 'https://www.vence.es/premium'
  })
}

export function isMetaTraffic({ fbclid, fbc, fbp, utmSource }: MetaTrafficParams): boolean {
  // fbclid es el indicador más claro
  if (fbclid) return true

  // Cookies de Meta
  if (fbc || fbp) return true

  // UTM source de Meta
  if (utmSource && ['facebook', 'fb', 'instagram', 'ig', 'meta'].includes(utmSource.toLowerCase())) {
    return true
  }

  return false
}

export function extractMetaParams(request: Request): MetaExtractedParams {
  const url = new URL(request.url)
  const fbclid = url.searchParams.get('fbclid')
  const utmSource = url.searchParams.get('utm_source')
  const utmMedium = url.searchParams.get('utm_medium')
  const utmCampaign = url.searchParams.get('utm_campaign')

  // Extraer cookies
  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...val] = c.trim().split('=')
      return [key, val.join('=')]
    })
  )

  const fbc = cookies['_fbc'] || null
  const fbp = cookies['_fbp'] || null

  // IP del cliente
  const clientIpAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                          request.headers.get('x-real-ip') ||
                          null

  // User Agent
  const clientUserAgent = request.headers.get('user-agent') || null

  return {
    fbclid,
    fbc,
    fbp,
    utmSource,
    utmMedium,
    utmCampaign,
    clientIpAddress,
    clientUserAgent,
    isFromMeta: isMetaTraffic({ fbclid, fbc, fbp, utmSource })
  }
}
