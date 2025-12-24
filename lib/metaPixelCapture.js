// lib/metaPixelCapture.js
// Captura fbclid y parámetros UTM cuando el usuario llega desde Meta Ads
// Debe ejecutarse en el cliente (navegador)

'use client'

/**
 * Captura y guarda los parámetros de Meta cuando el usuario llega a la página
 * Llamar esto en el layout principal o _app
 */
export function captureMetaParams() {
  if (typeof window === 'undefined') return null

  const url = new URL(window.location.href)
  const params = {
    fbclid: url.searchParams.get('fbclid'),
    utm_source: url.searchParams.get('utm_source'),
    utm_medium: url.searchParams.get('utm_medium'),
    utm_campaign: url.searchParams.get('utm_campaign'),
    utm_content: url.searchParams.get('utm_content'),
    utm_term: url.searchParams.get('utm_term'),
    landing_page: window.location.pathname,
    timestamp: Date.now()
  }

  // Si hay fbclid o utm de Meta, guardar
  const isFromMeta = params.fbclid ||
    ['facebook', 'fb', 'instagram', 'ig', 'meta'].includes(params.utm_source?.toLowerCase())

  if (isFromMeta || params.utm_source) {
    // Guardar en cookies (30 días)
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()

    if (params.fbclid) {
      // Formato especial de Meta: fb.1.timestamp.fbclid
      const fbc = `fb.1.${Math.floor(Date.now() / 1000)}.${params.fbclid}`
      document.cookie = `_fbc=${fbc}; expires=${expires}; path=/; SameSite=Lax`
      document.cookie = `meta_fbclid=${params.fbclid}; expires=${expires}; path=/; SameSite=Lax`
    }

    if (params.utm_source) {
      document.cookie = `meta_utm_source=${params.utm_source}; expires=${expires}; path=/; SameSite=Lax`
    }
    if (params.utm_campaign) {
      document.cookie = `meta_utm_campaign=${params.utm_campaign}; expires=${expires}; path=/; SameSite=Lax`
    }
    if (params.utm_medium) {
      document.cookie = `meta_utm_medium=${params.utm_medium}; expires=${expires}; path=/; SameSite=Lax`
    }

    // También en sessionStorage para acceso fácil
    sessionStorage.setItem('meta_params', JSON.stringify(params))

    console.log('📊 Meta params capturados:', {
      fbclid: params.fbclid ? params.fbclid.slice(0, 10) + '...' : null,
      utm_source: params.utm_source,
      utm_campaign: params.utm_campaign,
      isFromMeta
    })

    return params
  }

  return null
}

/**
 * Obtiene los parámetros de Meta guardados
 */
export function getMetaParams() {
  if (typeof window === 'undefined') return null

  // Intentar sessionStorage primero
  try {
    const stored = sessionStorage.getItem('meta_params')
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.warn('Error leyendo meta_params:', e)
  }

  // Fallback: leer cookies
  const cookies = document.cookie.split(';').reduce((acc, c) => {
    const [key, val] = c.trim().split('=')
    acc[key] = val
    return acc
  }, {})

  if (cookies.meta_fbclid || cookies.meta_utm_source) {
    return {
      fbclid: cookies.meta_fbclid || null,
      fbc: cookies._fbc || null,
      fbp: cookies._fbp || null,
      utm_source: cookies.meta_utm_source || null,
      utm_campaign: cookies.meta_utm_campaign || null,
      utm_medium: cookies.meta_utm_medium || null
    }
  }

  return null
}

/**
 * Verifica si el usuario viene de Meta
 */
export function isFromMeta() {
  const params = getMetaParams()
  if (!params) return false

  return !!(params.fbclid || params.fbc ||
    ['facebook', 'fb', 'instagram', 'ig', 'meta'].includes(params.utm_source?.toLowerCase()))
}

/**
 * Limpia los parámetros de Meta (después de conversión exitosa)
 */
export function clearMetaParams() {
  if (typeof window === 'undefined') return

  sessionStorage.removeItem('meta_params')

  const pastDate = new Date(0).toUTCString()
  document.cookie = `meta_fbclid=; expires=${pastDate}; path=/`
  document.cookie = `meta_utm_source=; expires=${pastDate}; path=/`
  document.cookie = `meta_utm_campaign=; expires=${pastDate}; path=/`
  document.cookie = `meta_utm_medium=; expires=${pastDate}; path=/`

  console.log('🧹 Meta params limpiados')
}

/**
 * Envía evento de registro a Meta CAPI
 */
export async function trackMetaRegistration(userId, email) {
  const params = getMetaParams()

  if (!params && !isFromMeta()) {
    console.log('ℹ️ Usuario no viene de Meta, no enviamos evento')
    return null
  }

  try {
    const response = await fetch('/api/meta/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'CompleteRegistration',
        email,
        userId,
        fbclid: params?.fbclid,
        fbc: params?.fbc,
        fbp: params?.fbp,
        eventSourceUrl: window.location.href,
        customData: {
          registration_source: 'meta',
          utm_source: params?.utm_source,
          utm_campaign: params?.utm_campaign
        }
      })
    })

    const result = await response.json()
    console.log('📤 Meta registration event:', result)
    return result

  } catch (error) {
    console.error('❌ Error enviando evento a Meta:', error)
    return null
  }
}

/**
 * Envía evento de PageView a Meta CAPI
 */
export async function trackMetaPageView() {
  const params = getMetaParams()

  if (!params && !isFromMeta()) return null

  try {
    const response = await fetch('/api/meta/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'PageView',
        fbclid: params?.fbclid,
        fbc: params?.fbc,
        fbp: params?.fbp,
        eventSourceUrl: window.location.href,
        customData: {
          page: window.location.pathname
        }
      })
    })

    return await response.json()
  } catch (error) {
    console.error('❌ Error enviando PageView a Meta:', error)
    return null
  }
}
