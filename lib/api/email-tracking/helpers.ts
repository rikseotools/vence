// lib/api/email-tracking/helpers.ts - Helpers para UA parsing en email tracking

// ============================================
// DEVICE TYPE DETECTION
// ============================================

export function getDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase()

  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return 'tablet'
  }

  if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) {
    return 'mobile'
  }

  return 'desktop'
}

// ============================================
// EMAIL CLIENT DETECTION
// ============================================

export function getEmailClient(userAgent: string): string {
  const ua = userAgent.toLowerCase()

  if (ua.includes('outlook')) return 'Outlook'
  if (ua.includes('thunderbird')) return 'Thunderbird'
  if (ua.includes('apple mail')) return 'Apple Mail'
  if (ua.includes('gmail')) return 'Gmail'
  if (ua.includes('yahoo')) return 'Yahoo Mail'

  if (ua.includes('chrome')) return 'Chrome Webmail'
  if (ua.includes('firefox')) return 'Firefox Webmail'
  if (ua.includes('safari')) return 'Safari Webmail'
  if (ua.includes('edge')) return 'Edge Webmail'

  return 'Unknown'
}
