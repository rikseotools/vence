// app/api/email/track-click/route.js - API PARA TRACKING DE CLICKS EN EMAILS
import { NextResponse } from 'next/server'
import { getSupabaseClient } from '../../../lib/supabase'

const supabase = getSupabaseClient()

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const emailType = searchParams.get('email_type')
    const campaignId = searchParams.get('campaign_id')
    const templateId = searchParams.get('template_id')
    const linkClicked = searchParams.get('url')
    const redirectUrl = searchParams.get('redirect') || linkClicked || '/es'

    // Obtener información del request
    const userAgent = request.headers.get('user-agent') || ''
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const clientIp = forwardedFor?.split(',')[0] || realIp || 'unknown'

    // Detectar cliente de email y dispositivo
    const deviceType = getDeviceType(userAgent)
    const emailClient = getEmailClient(userAgent)

    // Registrar evento de click
    if (userId && emailType && linkClicked) {
      const eventData = {
        user_id: userId,
        email_type: emailType,
        event_type: 'clicked',
        campaign_id: campaignId || null,
        template_id: templateId || null,
        link_clicked: linkClicked,
        click_count: 1,
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
        console.error('Error tracking email click:', error)
      } else {
        console.log(`📧 Email click tracked: ${emailType} -> ${linkClicked}`)
      }
    }

    // Redirigir al usuario al link original
    return NextResponse.redirect(new URL(redirectUrl, request.url))

  } catch (error) {
    console.error('Error in email click tracking:', error)
    
    // Redirigir al home si hay error
    return NextResponse.redirect(new URL('/es', request.url))
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
  
  // Clientes específicos
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