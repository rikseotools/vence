'use client'

import { useState, useEffect, createContext, useContext, useCallback } from 'react'

// Constantes
const COOKIE_CONSENT_KEY = 'vence_cookie_consent'
const CONSENT_VERSION = '1.0' // Incrementar si cambian las opciones

// Contexto para el consentimiento
const CookieConsentContext = createContext(null)

/**
 * Hook para acceder al estado de consentimiento de cookies
 * @returns {{
 *   consent: { analytics: boolean, marketing: boolean, version: string } | null,
 *   hasConsent: boolean,
 *   analyticsAllowed: boolean,
 *   marketingAllowed: boolean,
 *   updateConsent: (newConsent: object) => void,
 *   resetConsent: () => void
 * }}
 */
export function useCookieConsent() {
  const context = useContext(CookieConsentContext)
  if (!context) {
    throw new Error('useCookieConsent must be used within CookieConsentProvider')
  }
  return context
}

/**
 * Provider que gestiona el estado de consentimiento de cookies
 */
export function CookieConsentProvider({ children }) {
  const [consent, setConsent] = useState(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // Cargar consentimiento del localStorage al montar
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Verificar que la versión coincide
        if (parsed.version === CONSENT_VERSION) {
          setConsent(parsed)
        }
      }
    } catch (e) {
      console.warn('Error loading cookie consent:', e)
    }
    setIsLoaded(true)
  }, [])

  // Guardar consentimiento
  const updateConsent = useCallback((newConsent) => {
    const consentData = {
      ...newConsent,
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString()
    }
    setConsent(consentData)
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData))
      // Disparar evento para que otros componentes (GoogleAnalytics) lo detecten
      window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: consentData }))
    } catch (e) {
      console.warn('Error saving cookie consent:', e)
    }
  }, [])

  // Resetear consentimiento (para testing o cambio de preferencias)
  const resetConsent = useCallback(() => {
    setConsent(null)
    try {
      localStorage.removeItem(COOKIE_CONSENT_KEY)
    } catch (e) {
      console.warn('Error removing cookie consent:', e)
    }
  }, [])

  const value = {
    consent,
    hasConsent: consent !== null,
    analyticsAllowed: consent?.analytics === true,
    marketingAllowed: consent?.marketing === true,
    updateConsent,
    resetConsent,
    isLoaded
  }

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  )
}

/**
 * Banner de consentimiento de cookies - RGPD compliant
 */
export default function CookieBanner() {
  const { consent, hasConsent, updateConsent, isLoaded } = useCookieConsent()
  const [showSettings, setShowSettings] = useState(false)
  const [localSettings, setLocalSettings] = useState({
    analytics: false,
    marketing: false
  })

  // No mostrar hasta que se cargue el estado
  if (!isLoaded) return null

  // No mostrar si ya hay consentimiento
  if (hasConsent) return null

  const handleAcceptAll = () => {
    updateConsent({
      analytics: true,
      marketing: true,
      essential: true // Siempre true
    })
  }

  const handleRejectAll = () => {
    updateConsent({
      analytics: false,
      marketing: false,
      essential: true // Siempre true
    })
  }

  const handleSaveSettings = () => {
    updateConsent({
      analytics: localSettings.analytics,
      marketing: localSettings.marketing,
      essential: true
    })
    setShowSettings(false)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg">
      <div className="max-w-6xl mx-auto">
        {!showSettings ? (
          // Vista principal del banner
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                🍪 Configuración de cookies
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Usamos cookies para mejorar tu experiencia, analizar el tráfico y personalizar contenido.{' '}
                <a
                  href="/privacidad"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                  target="_blank"
                >
                  Política de privacidad
                </a>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleRejectAll}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Rechazar todo
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Personalizar
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Aceptar todo
              </button>
            </div>
          </div>
        ) : (
          // Vista de configuración
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Personalizar cookies
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {/* Cookies esenciales - siempre activas */}
              <div className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">Esenciales</span>
                    <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                      Siempre activas
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Necesarias para el funcionamiento básico del sitio: autenticación, seguridad y preferencias.
                  </p>
                </div>
                <div className="ml-4">
                  <div className="w-12 h-6 bg-green-500 rounded-full relative cursor-not-allowed">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Cookies de analytics */}
              <div className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-white">Analíticas</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Nos ayudan a entender cómo usas la app para mejorarla. Incluye Google Analytics.
                  </p>
                </div>
                <div className="ml-4">
                  <button
                    onClick={() => setLocalSettings(s => ({ ...s, analytics: !s.analytics }))}
                    className={`w-12 h-6 rounded-full relative transition-colors ${
                      localSettings.analytics ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      localSettings.analytics ? 'right-1' : 'left-1'
                    }`}></div>
                  </button>
                </div>
              </div>

              {/* Cookies de marketing */}
              <div className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-white">Marketing</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Permiten medir la efectividad de nuestras campañas. Incluye Meta Pixel y Google Ads.
                  </p>
                </div>
                <div className="ml-4">
                  <button
                    onClick={() => setLocalSettings(s => ({ ...s, marketing: !s.marketing }))}
                    className={`w-12 h-6 rounded-full relative transition-colors ${
                      localSettings.marketing ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      localSettings.marketing ? 'right-1' : 'left-1'
                    }`}></div>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleRejectAll}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Rechazar todo
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Guardar preferencias
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Componente para acceder a configuración de cookies desde el footer o perfil
 */
export function CookieSettingsButton({ className = '' }) {
  const { resetConsent } = useCookieConsent()

  return (
    <button
      onClick={resetConsent}
      className={`text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 ${className}`}
    >
      Configurar cookies
    </button>
  )
}
