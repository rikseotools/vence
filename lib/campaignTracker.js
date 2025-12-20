// lib/campaignTracker.js - UTILIDADES PARA TRACKING DE CAMPAÑAS

/**
 * Lee el valor de una cookie específica
 * @param {string} name - Nombre de la cookie
 * @returns {string|null} - Valor de la cookie o null si no existe
 */
export function getCookie(name) {
  if (typeof document === 'undefined') return null
  
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop().split(';').shift()
  }
  return null
}

/**
 * Detecta si el usuario viene de una campaña publicitaria
 * @returns {object|null} - Información completa de la campaña o null
 */
export function detectCampaignSource() {
  // Intentar obtener información completa de cookies
  const campaignSource = getCookie('campaign_source')
  const campaignLanding = getCookie('campaign_landing')
  const campaignUtmSource = getCookie('campaign_utm_source')
  const campaignUtmCampaign = getCookie('campaign_utm_campaign')
  const campaignFbclid = getCookie('campaign_fbclid')
  const campaignGclid = getCookie('campaign_gclid')
  const campaignTimestamp = getCookie('campaign_timestamp')
  
  // Backup: intentar obtener de sessionStorage
  let sessionData = null
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('campaign_data')
      if (stored) {
        sessionData = JSON.parse(stored)
      }
    } catch (e) {
      console.warn('Error leyendo campaign_data de sessionStorage:', e)
    }
  }
  
  // Si hay información de campaña, construir objeto completo
  if (campaignSource || sessionData) {
    return {
      // Datos principales
      source: campaignSource || sessionData?.source || 'unknown',
      landing: campaignLanding || sessionData?.landing || 'unknown',
      utm_source: campaignUtmSource || sessionData?.utm_source || 'unknown',
      utm_campaign: campaignUtmCampaign || sessionData?.utm_campaign || 'unknown',
      
      // Click IDs
      fbclid: campaignFbclid || sessionData?.fbclid || null,
      gclid: campaignGclid || sessionData?.gclid || null,
      
      // Metadata
      timestamp: campaignTimestamp || sessionData?.timestamp || null,
      method: campaignSource ? 'cookie' : 'session',
      
      // URL completa si está disponible
      full_url: sessionData?.full_url || null
    }
  }
  
  return null
}

/**
 * Fuerza el checkout para usuarios de campañas
 * @param {object} user - Usuario autenticado de Supabase
 * @param {object} supabase - Cliente de Supabase
 * @returns {Promise<void>}
 */
export async function forceCampaignCheckout(user, supabase) {
  const campaignInfo = detectCampaignSource()
  
  if (!campaignInfo || !user) {
    console.log('❌ No se puede forzar checkout: falta campaignInfo o usuario')
    return
  }
  
  console.log('💰 FORZANDO CHECKOUT para usuario de campaña:', {
    user_id: user.id,
    campaign: campaignInfo.landing,
    source: campaignInfo.source
  })
  
  try {
    // Crear usuario premium en BD (igual que en las landing pages)
    await supabase.rpc('create_google_ads_user', {
      user_id: user.id,
      user_email: user.email,
      user_name: user.user_metadata?.full_name || user.email?.split('@')[0],
      campaign_id: campaignInfo.utm_campaign || campaignInfo.landing
    })

    // Crear sesión de Stripe
    const response = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || 'price_1RjhHBCybKEAFwateoAVKstO',
        userId: user.id,
        trialDays: 7,
        mode: 'normal'
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error)

    // Redirigir a Stripe
    const { loadStripe } = await import('@stripe/stripe-js')
    const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    
    const { error: stripeError } = await stripe.redirectToCheckout({
      sessionId: data.sessionId,
    })

    if (stripeError) throw new Error(stripeError.message)
    
  } catch (error) {
    console.error('❌ Error forzando checkout:', error)
    // Si falla, al menos limpiar las cookies para que no se repita infinitamente
    clearCampaignTracking()
    throw error
  }
}

/**
 * Verifica si debe forzar checkout y lo ejecuta
 * @param {object} user - Usuario autenticado
 * @param {object} supabase - Cliente de Supabase
 * @returns {boolean} - true si va a forzar checkout, false si no
 */
export function shouldForceCheckout(user, supabase) {
  const campaignInfo = detectCampaignSource()
  
  if (!campaignInfo || !user) {
    return false
  }
  
  // Verificar si las cookies son recientes (menos de 30 días)
  if (campaignInfo.timestamp) {
    const age = Date.now() - parseInt(campaignInfo.timestamp)
    const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 días
    
    if (age > maxAge) {
      console.log('⏰ Cookies de campaña expiradas, limpiando...')
      clearCampaignTracking()
      return false
    }
  }
  
  console.log('🎯 Usuario debe pagar - viene de campaña:', campaignInfo.landing)
  return true
}

/**
 * Limpia los marcadores de campaña (usar después de completar pago)
 */
export function clearCampaignTracking() {
  // Limpiar todas las cookies de campaña
  const cookiesToClear = [
    'campaign_source',
    'campaign_landing', 
    'campaign_utm_source',
    'campaign_utm_campaign',
    'campaign_fbclid',
    'campaign_gclid',
    'campaign_timestamp'
  ]
  
  cookiesToClear.forEach(cookieName => {
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
  })
  
  // Limpiar sessionStorage
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('campaign_data')
  }
  
  console.log('🧹 Tracking de campaña limpiado completamente')
}