// app/api/email/track-open/route.js - API PARA TRACKING DE APERTURA DE EMAILS
import { NextResponse } from 'next/server'
import { getSupabaseClient } from '../../../lib/supabase'

const supabase = getSupabaseClient()

// Pixel transparente de 1x1
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const emailType = searchParams.get('email_type')
    const campaignId = searchParams.get('campaign_id')
    const templateId = searchParams.get('template_id')
    const timestamp = searchParams.get('timestamp')

    // Obtener información del request
    const userAgent = request.headers.get('user-agent') || ''
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const clientIp = forwardedFor?.split(',')[0] || realIp || 'unknown'

    // Detectar cliente de email y dispositivo
    const deviceType = getDeviceType(userAgent)
    const emailClient = getEmailClient(userAgent)

    // Registrar evento de apertura
    if (userId && emailType) {
      const eventData = {
        user_id: userId,
        email_type: emailType,
        event_type: 'opened',
        campaign_id: campaignId || null,
        template_id: templateId || null,
        open_count: 1,
        device_type: deviceType,
        client_name: emailClient,
        ip_address: clientIp,
        user_agent: userAgent,
        created_at: new Date().toISOString()
      }

      // Obtener email del usuario
      const { data: user } = await supabase.auth.admin.getUserById(userId)
      if (user?.user?.email) {
        eventData.email_address = user.user.email
      }

      const { error } = await supabase
        .from('email_events')
        .insert(eventData)

      if (error) {
        console.error('Error tracking email open:', error)
      } else {
        console.log(`📧 Email open tracked via pixel: ${emailType}`)
      }
    }

    // Devolver pixel transparente
    return new NextResponse(TRACKING_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': TRACKING_PIXEL.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error in email tracking pixel:', error)
    
    // Devolver pixel aunque haya error
    return new NextResponse(TRACKING_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': TRACKING_PIXEL.length.toString()
      }
    })
  }
}

// Detectar tipo de dispositivo desde User-Agent
function getDeviceType(userAgent) {
  const ua = userAgent.toLowerCase()
  
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return 'tablet'
  }
  
  if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) {
    return 'mobile'
  }
  
  return 'desktop'
}

// Detectar cliente de email desde User-Agent
function getEmailClient(userAgent) {
  const ua = userAgent.toLowerCase()
  
  // Clients específicos
  if (ua.includes('outlook')) return 'Outlook'
  if (ua.includes('thunderbird')) return 'Thunderbird'
  if (ua.includes('apple mail')) return 'Apple Mail'
  if (ua.includes('gmail')) return 'Gmail'
  if (ua.includes('yahoo')) return 'Yahoo Mail'
  
  // Navegadores comunes (cuando se abre en webmail)
  if (ua.includes('chrome')) return 'Chrome Webmail'
  if (ua.includes('firefox')) return 'Firefox Webmail'
  if (ua.includes('safari')) return 'Safari Webmail'
  if (ua.includes('edge')) return 'Edge Webmail'
  
  return 'Unknown'
}