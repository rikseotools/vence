// utils/googleAds.js - Utilidades para Google Ads tracking - ACTUALIZADO
export const trackConversion = (conversionLabel, value = null, currency = 'EUR') => {
  if (typeof window !== 'undefined' && window.gtag) {
    // ✅ USAR EL NUEVO FORMATO DE GOOGLE ADS
    if (conversionLabel === 'signup') {
      window.gtag('event', 'conversion_event_signup', {
        value: value,
        currency: currency,
        transaction_id: generateTransactionId()
      })
    } else if (conversionLabel === 'engagement') {
      window.gtag('event', 'conversion_event_engagement', {
        value: value,
        currency: currency,
        transaction_id: generateTransactionId()
      })
    } else {
      // Para otros eventos futuros o eventos personalizados
      window.gtag('event', conversionLabel, {
        value: value,
        currency: currency,
        transaction_id: generateTransactionId()
      })
    }
    
    console.log('🎯 Google Ads Conversion tracked:', conversionLabel, { value, currency })
  }
}

// Eventos de conversión comunes para tu app
export const GoogleAdsEvents = {
  // 🎯 CONVERSIÓN PRINCIPAL: Usuario se registra
  SIGNUP: (method = 'email') => {
    // 🎯 OPCIÓN 1: CARGA DE PÁGINA (recomendado para OAuth)
    if (typeof window !== 'undefined' && window.gtag) {
      const transactionId = generateTransactionId()
      
      // Fragmento exacto de Google Ads - Conversión "Registro Vence"
      window.gtag('event', 'conversion', {
        'send_to': 'AW-10842123204/p4mqCO217NYbEMTX9rEo',
        'value': 1.0,
        'currency': 'EUR',
        'transaction_id': transactionId
      })
      
      console.log('🎯 Google Ads Conversion tracked (Registro Vence):', 'AW-10842123204/p4mqCO217NYbEMTX9rEo', { method, transactionId })
    }
    
    // También enviar a GA4 (mantener esto si usas Google Analytics)
    if (window.gtag) {
      window.gtag('event', 'sign_up', {
        method: method
      })
    }
  },
  
  // 🔥 COMPROMISO ALTO: Usuario muy activo (señal de calidad)
  HIGH_ENGAGEMENT: (questionsAnswered = 0, timeSpent = 0) => {
    // Solo trackear si realmente es alta actividad
    if (questionsAnswered >= 20 || timeSpent >= 900) { // 20+ preguntas o 15+ minutos
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'conversion_event_engagement', {
          questions_answered: questionsAnswered,
          time_spent: timeSpent,
          currency: 'EUR',
          value: 0.5, // Valor menor que signup pero importante
          transaction_id: generateTransactionId()
        })
        
        console.log('🔥 Google Ads High Engagement tracked:', { questionsAnswered, timeSpent })
      }
      
      // También para GA4
      if (window.gtag) {
        window.gtag('event', 'high_engagement', {
          questions_answered: questionsAnswered,
          time_spent: timeSpent
        })
      }
    }
  },
  
  // 📄 VISTA DE PÁGINA IMPORTANTE (para remarketing)
  IMPORTANT_PAGE_VIEW: (pageType = 'unknown') => {
    // NO es conversión, solo para audiencias de remarketing
    if (window.gtag) {
      window.gtag('event', 'page_view', {
        page_type: pageType,
        event_category: 'engagement'
      })
      
      console.log('📄 Page view tracked:', pageType)
    }
  },
  
  // ⚡ EVENTO SIMPLIFICADO: Test completado (para remarketing)
  TEST_COMPLETED: (testType = 'unknown') => {
    // NO conversión, solo para crear audiencias
    if (window.gtag) {
      window.gtag('event', 'test_completed', {
        test_type: testType,
        event_category: 'engagement'
      })
      
      console.log('⚡ Test completed tracked:', testType)
    }
  },
  
  // 🎯 EVENTO PERSONALIZADO (solo si necesitas algo específico)
  CUSTOM: (label, value = null) => {
    trackConversion(label, value, 'EUR')
  }
}

// Generar ID único para transacciones
const generateTransactionId = () => {
  return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 🔍 FUNCIÓN DE DEBUG para verificar que Google Ads está funcionando
export const debugGoogleAds = () => {
  if (typeof window !== 'undefined') {
    console.log('🎯 Google Ads Debug:', {
      gtagExists: !!window.gtag,
      gtagConfig: window.gtag ? 'loaded' : 'not loaded',
      conversionId: 'AW-10842123204',
      dataLayerExists: !!window.dataLayer,
      dataLayerLength: window.dataLayer ? window.dataLayer.length : 0
    })
    
    // Test de prueba (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log('🧪 Para probar, puedes ejecutar: GoogleAdsEvents.SIGNUP("test")')
    }
  }
}

// Hook de React para usar en componentes
export const useGoogleAds = () => {
  return {
    trackConversion,
    events: GoogleAdsEvents,
    debug: debugGoogleAds
  }
}