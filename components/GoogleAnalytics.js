'use client'
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

// Constantes de consentimiento (deben coincidir con CookieConsent.js)
const COOKIE_CONSENT_KEY = 'vence_cookie_consent'
const CONSENT_VERSION = '1.0'

/**
 * Lee el consentimiento de cookies del localStorage
 * @returns {{ analytics: boolean, marketing: boolean } | null}
 */
function getCookieConsent() {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.version === CONSENT_VERSION) {
        return parsed
      }
    }
  } catch (e) {
    console.warn('Error reading cookie consent:', e)
  }
  return null
}

export default function GoogleAnalytics() {
  const pathname = usePathname()
  const [shouldLoad, setShouldLoad] = useState(false)
  const [hasConsent, setHasConsent] = useState(false)

  // Verificar consentimiento y cargar GA
  useEffect(() => {
    // 🚫 NO cargar Google Analytics en rutas de administración
    if (pathname?.startsWith('/admin')) {
      return
    }

    // 🍪 Verificar consentimiento de cookies
    const checkConsent = () => {
      const consent = getCookieConsent()
      if (consent?.analytics === true) {
        setHasConsent(true)
        setShouldLoad(true)
      }
    }

    // Verificar inmediatamente
    checkConsent()

    // Escuchar cambios en localStorage (cuando el usuario acepta cookies)
    const handleStorageChange = (e) => {
      if (e.key === COOKIE_CONSENT_KEY) {
        checkConsent()
      }
    }
    window.addEventListener('storage', handleStorageChange)

    // También escuchar evento personalizado para misma pestaña
    const handleConsentChange = () => checkConsent()
    window.addEventListener('cookieConsentChanged', handleConsentChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('cookieConsentChanged', handleConsentChange)
    }
  }, [pathname])

  // Re-verificar cuando cambia shouldLoad (por si el consent se dio después)
  useEffect(() => {
    if (!hasConsent) {
      const interval = setInterval(() => {
        const consent = getCookieConsent()
        if (consent?.analytics === true) {
          setHasConsent(true)
          setShouldLoad(true)
          clearInterval(interval)
        }
      }, 1000) // Verificar cada segundo

      return () => clearInterval(interval)
    }
  }, [hasConsent])

  // 🚫 NO renderizar si no hay consentimiento o estamos en admin
  if (pathname?.startsWith('/admin') || !shouldLoad || !hasConsent) {
    return null
  }

  return (
    <>
      {/* Google Analytics - Solo se carga con consentimiento del usuario */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-WXQ069CRY9"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-WXQ069CRY9');

          // Google Ads configuration (Nueva cuenta Enero 2026)
          gtag('config', 'AW-7929322521');

          console.log('🍪 Google Analytics cargado con consentimiento');
        `}
      </Script>
    </>
  )
}