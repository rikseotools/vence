// lib/services/emailTracker.js - SERVICIO PARA TRACKING DE EMAILS
'use client'
import { getSupabaseClient } from '../supabase'
import notificationTracker from './notificationTracker'

// Instancia global de Supabase
let supabaseInstance = null

class EmailTracker {
  constructor() {
    this.setupEmailClickTracking()
  }

  // Método para obtener instancia de Supabase
  getSupabase() {
    return supabaseInstance || getSupabaseClient()
  }

  // Método para configurar instancia desde el contexto de Auth
  setSupabaseInstance(supabase) {
    supabaseInstance = supabase
  }

  // Configurar tracking automático de clicks en emails
  setupEmailClickTracking() {
    if (typeof window === 'undefined') return

    // Escuchar clicks en links que vengan de emails
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a')
      if (!link) return

      const href = link.href
      const urlParams = new URLSearchParams(new URL(href).search)
      
      // Detectar si viene de un email (parámetros comunes)
      if (urlParams.has('utm_source') && urlParams.get('utm_source') === 'email') {
        this.trackEmailClick({
          emailType: urlParams.get('utm_campaign') || 'unknown',
          linkClicked: href,
          campaignId: urlParams.get('utm_campaign'),
          templateId: urlParams.get('template_id')
        })
      }
    })

    // Tracking de apertura de email (pixel tracking)
    this.setupOpenTracking()
  }

  // Configurar tracking de apertura de emails
  setupOpenTracking() {
    // Buscar parámetros de email en la URL
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.has('email_opened')) {
      this.trackEmailOpen({
        emailType: urlParams.get('email_type') || 'unknown',
        campaignId: urlParams.get('campaign_id'),
        templateId: urlParams.get('template_id')
      })
    }
  }

  // Track when email is sent (llamado desde el servidor)
  async trackEmailSent(data) {
    try {
      const eventData = {
        user_id: data.userId,
        email_type: data.emailType,
        event_type: 'sent',
        email_address: data.emailAddress,
        subject: data.subject,
        template_id: data.templateId,
        campaign_id: data.campaignId,
        email_content_preview: data.contentPreview?.substring(0, 200),
        device_type: 'server', // Enviado desde servidor
        client_name: 'system'
      }

      const { error } = await supabase
        .from('email_events')
        .insert(eventData)

      if (error) {
        console.error('Error tracking email sent:', error)
      } else {
        console.log(`📧 Email sent tracked: ${data.emailType}`)
      }
    } catch (error) {
      console.error('Error in trackEmailSent:', error)
    }
  }

  // Track when email is delivered
  async trackEmailDelivered(data) {
    await notificationTracker.trackEmailDelivered(data)
  }

  // Track when email is opened
  async trackEmailOpen(data) {
    try {
      const supabase = this.getSupabase()
      const { user } = await supabase.auth.getUser()
      if (!user?.data?.user) {
        console.warn('No hay usuario autenticado para tracking de email open')
        return
      }

      const eventData = {
        user_id: user.data.user.id,
        email_type: data.emailType,
        event_type: 'opened',
        email_address: user.data.user.email,
        template_id: data.templateId,
        campaign_id: data.campaignId,
        open_count: 1,
        device_type: this.getDeviceType(),
        client_name: this.getEmailClient(),
        ip_address: await this.getUserIP(),
        user_agent: navigator.userAgent
      }

      const { error } = await supabase
        .from('email_events')
        .insert(eventData)

      if (error) {
        console.error('Error tracking email open:', error)
      } else {
        console.log(`📧 Email open tracked: ${data.emailType}`)
      }
    } catch (error) {
      console.error('Error in trackEmailOpen:', error)
    }
  }

  // Track when email link is clicked
  async trackEmailClick(data) {
    try {
      const supabase = this.getSupabase()
      const { user } = await supabase.auth.getUser()
      if (!user?.data?.user) {
        console.warn('No hay usuario autenticado para tracking de email click')
        return
      }

      const eventData = {
        user_id: user.data.user.id,
        email_type: data.emailType,
        event_type: 'clicked',
        email_address: user.data.user.email,
        template_id: data.templateId,
        campaign_id: data.campaignId,
        link_clicked: data.linkClicked,
        click_count: 1,
        device_type: this.getDeviceType(),
        client_name: this.getEmailClient(),
        ip_address: await this.getUserIP(),
        user_agent: navigator.userAgent
      }

      const { error } = await supabase
        .from('email_events')
        .insert(eventData)

      if (error) {
        console.error('Error tracking email click:', error)
      } else {
        console.log(`📧 Email click tracked: ${data.emailType}`)
      }
    } catch (error) {
      console.error('Error in trackEmailClick:', error)
    }
  }

  // Track when email bounces
  async trackEmailBounced(data) {
    await notificationTracker.trackEmailBounced(data)
  }

  // Track when user unsubscribes
  async trackEmailUnsubscribed(data) {
    await notificationTracker.trackEmailUnsubscribed(data)
  }

  // Métodos auxiliares
  getDeviceType() {
    const ua = navigator.userAgent
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) return 'mobile'
    return 'desktop'
  }

  getEmailClient() {
    const ua = navigator.userAgent
    if (ua.includes('Outlook')) return 'Outlook'
    if (ua.includes('Gmail')) return 'Gmail' 
    if (ua.includes('Yahoo')) return 'Yahoo'
    if (ua.includes('Apple Mail')) return 'Apple Mail'
    if (ua.includes('Thunderbird')) return 'Thunderbird'
    return 'Unknown'
  }

  async getUserIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch (error) {
      console.warn('No se pudo obtener IP:', error)
      return null
    }
  }

  // Generar URLs con tracking para emails
  generateTrackingUrl(baseUrl, emailData) {
    const url = new URL(baseUrl, window.location.origin)
    
    // Agregar parámetros de tracking
    url.searchParams.set('utm_source', 'email')
    url.searchParams.set('utm_medium', 'email')
    url.searchParams.set('utm_campaign', emailData.campaignId || emailData.emailType)
    url.searchParams.set('email_type', emailData.emailType)
    
    if (emailData.templateId) {
      url.searchParams.set('template_id', emailData.templateId)
    }
    
    if (emailData.campaignId) {
      url.searchParams.set('campaign_id', emailData.campaignId)
    }

    return url.toString()
  }

  // Generar pixel de tracking para apertura de emails
  generateOpenTrackingPixel(emailData) {
    const baseUrl = window.location.origin
    const pixelUrl = new URL('/api/email/track-open', baseUrl)
    
    pixelUrl.searchParams.set('user_id', emailData.userId)
    pixelUrl.searchParams.set('email_type', emailData.emailType)
    pixelUrl.searchParams.set('campaign_id', emailData.campaignId || '')
    pixelUrl.searchParams.set('template_id', emailData.templateId || '')
    pixelUrl.searchParams.set('timestamp', Date.now().toString())

    return pixelUrl.toString()
  }

  // Para manejo de unsubscribe desde emails
  async handleUnsubscribeClick(data) {
    try {
      // Track the unsubscribe
      await this.trackEmailUnsubscribed(data)

      // Update user preferences
      const supabase = this.getSupabase()
      const { user } = await supabase.auth.getUser()
      if (user?.data?.user) {
        await supabase
          .from('email_preferences')
          .upsert({
            user_id: user.data.user.id,
            unsubscribed_all: true,
            email_reactivacion: false,
            email_urgente: false,
            email_bienvenida_motivacional: false
          }, { onConflict: 'user_id' })
      }

      // Redirect to preference page
      window.location.href = '/perfil?tab=notificaciones&utm_source=email_unsubscribe'
    } catch (error) {
      console.error('Error handling unsubscribe:', error)
    }
  }
}

// Crear instancia singleton
const emailTracker = new EmailTracker()

export default emailTracker

// Para debugging en desarrollo
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.emailTracker = emailTracker
}