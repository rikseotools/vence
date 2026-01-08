// utils/googleAds.js - Tracking via GA4 events (importados a Google Ads)
// Google Ads ID: AW-7929322521 (configurado en GoogleAnalytics.js)

// Generar ID único para transacciones
const generateTransactionId = () => {
  return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Eventos de conversión - Usan GA4 events que se importan a Google Ads
export const GoogleAdsEvents = {
  // 🎯 CONVERSIÓN PRINCIPAL: Usuario se registra
  SIGNUP: (method = 'email') => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'sign_up', {
        method: method,
        transaction_id: generateTransactionId()
      })
      console.log('🎯 sign_up tracked:', { method })
    }
  },

  // 🔥 COMPROMISO ALTO: Usuario muy activo
  HIGH_ENGAGEMENT: (questionsAnswered = 0, timeSpent = 0) => {
    if (questionsAnswered >= 20 || timeSpent >= 900) {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'high_engagement', {
          questions_answered: questionsAnswered,
          time_spent: timeSpent
        })
        console.log('🔥 high_engagement tracked:', { questionsAnswered, timeSpent })
      }
    }
  },

  // ⚡ Test completado (para remarketing)
  TEST_COMPLETED: (testType = 'unknown') => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'test_completed', {
        test_type: testType
      })
      console.log('⚡ test_completed tracked:', testType)
    }
  }
}

// 🔍 Debug
export const debugGoogleAds = () => {
  if (typeof window !== 'undefined') {
    console.log('🎯 Google Ads Debug:', {
      gtagExists: !!window.gtag,
      conversionId: 'AW-7929322521',
      dataLayerLength: window.dataLayer?.length || 0
    })
  }
}

// Hook de React
export const useGoogleAds = () => {
  return {
    events: GoogleAdsEvents,
    debug: debugGoogleAds
  }
}
