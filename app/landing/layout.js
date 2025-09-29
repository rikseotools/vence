// app/landing/layout.js - LAYOUT CON TRACKING AUTOMÁTICO PARA CAMPAÑAS
'use client'
import '../../globals.css'
import { AuthProvider } from '../../../contexts/AuthContext'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

// Componente que maneja el tracking automático
function CampaignTracker({ children }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  useEffect(() => {
    // Extraer información de la landing page actual
    const pathParts = pathname.split('/')
    const landingName = pathParts[pathParts.length - 1] // Ej: 'premium-ads-1'
    
    // Parámetros adicionales de la URL
    const utmSource = searchParams.get('utm_source') || 'unknown'
    const utmCampaign = searchParams.get('utm_campaign') || landingName
    const fbclid = searchParams.get('fbclid') // Facebook Click ID
    const gclid = searchParams.get('gclid')   // Google Click ID
    
    // Determinar el source basado en la landing page
    let campaignSource = 'landing'
    if (landingName.includes('ads')) {
      campaignSource = 'paid-ads'
    } else if (landingName.includes('premium')) {
      campaignSource = 'premium-campaign'
    }
    
    // Establecer cookies con duración de 30 días
    const expires = new Date()
    expires.setDate(expires.getDate() + 30)
    const cookieOptions = `expires=${expires.toUTCString()}; path=/; SameSite=Lax`
    
    // Cookies principales de tracking
    document.cookie = `campaign_source=${campaignSource}; ${cookieOptions}`
    document.cookie = `campaign_landing=${landingName}; ${cookieOptions}`
    document.cookie = `campaign_utm_source=${utmSource}; ${cookieOptions}`
    document.cookie = `campaign_utm_campaign=${utmCampaign}; ${cookieOptions}`
    
    // Click IDs si existen
    if (fbclid) {
      document.cookie = `campaign_fbclid=${fbclid}; ${cookieOptions}`
    }
    if (gclid) {
      document.cookie = `campaign_gclid=${gclid}; ${cookieOptions}`
    }
    
    // Timestamp de cuando llegó
    document.cookie = `campaign_timestamp=${Date.now()}; ${cookieOptions}`
    
    // Backup en sessionStorage
    const campaignData = {
      source: campaignSource,
      landing: landingName,
      utm_source: utmSource,
      utm_campaign: utmCampaign,
      fbclid,
      gclid,
      timestamp: Date.now(),
      full_url: window.location.href
    }
    
    sessionStorage.setItem('campaign_data', JSON.stringify(campaignData))
    
    // Log para debugging
    console.log('🎯 CAMPAIGN TRACKING ACTIVADO:', {
      pathname,
      landingName,
      campaignSource,
      utmSource,
      utmCampaign,
      fbclid: fbclid ? '✓' : '✗',
      gclid: gclid ? '✓' : '✗'
    })
    
  }, [pathname, searchParams])
  
  return children
}

export default function LandingLayout({ children }) {
  return (
    <AuthProvider initialUser={null}>
      <CampaignTracker>
        <div className="min-h-screen">
          {children}
        </div>
      </CampaignTracker>
    </AuthProvider>
  )
}