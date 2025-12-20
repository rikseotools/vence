// lib/services/conversionTracker.js
// Servicio para tracking de eventos de conversion
'use client'

/**
 * Trackea un evento de conversion
 * @param {object} supabase - Cliente de Supabase
 * @param {string} userId - ID del usuario
 * @param {string} eventType - Tipo de evento
 * @param {object} eventData - Datos adicionales del evento
 */
export async function trackConversionEvent(supabase, userId, eventType, eventData = {}) {
  if (!supabase || !userId || !eventType) {
    console.warn('trackConversionEvent: faltan parametros', { userId, eventType })
    return null
  }

  try {
    const { data, error } = await supabase.rpc('track_conversion_event', {
      p_user_id: userId,
      p_event_type: eventType,
      p_event_data: eventData
    })

    if (error) {
      // Si la tabla no existe aun, no romper la app
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Tabla conversion_events no existe aun - ejecutar migracion')
        return null
      }
      console.error('Error tracking conversion event:', error)
      return null
    }

    console.log(`📊 Conversion event tracked: ${eventType}`, eventData)
    return data

  } catch (err) {
    // Nunca romper la app por un error de tracking
    console.error('Error en trackConversionEvent:', err)
    return null
  }
}

/**
 * Eventos predefinidos del funnel
 */
export const CONVERSION_EVENTS = {
  // Registro
  REGISTRATION: 'registration',

  // Tests
  FIRST_TEST_STARTED: 'first_test_started',
  FIRST_TEST_COMPLETED: 'first_test_completed',
  TEST_COMPLETED: 'test_completed',

  // Limites
  LIMIT_REACHED: 'limit_reached',
  LIMIT_WARNING: 'limit_warning', // Cuando quedan pocas preguntas

  // Upgrade flow
  UPGRADE_MODAL_VIEWED: 'upgrade_modal_viewed',
  UPGRADE_BUTTON_CLICKED: 'upgrade_button_clicked',
  UPGRADE_BANNER_CLICKED: 'upgrade_banner_clicked',

  // Premium page
  PREMIUM_PAGE_VIEWED: 'premium_page_viewed',
  PLAN_SELECTED: 'plan_selected',

  // Checkout
  CHECKOUT_STARTED: 'checkout_started',
  CHECKOUT_ABANDONED: 'checkout_abandoned',

  // Payment
  PAYMENT_COMPLETED: 'payment_completed',
  PAYMENT_FAILED: 'payment_failed'
}

/**
 * Helper para trackear vista del modal de upgrade
 */
export async function trackUpgradeModalView(supabase, userId, source = 'limit') {
  return trackConversionEvent(supabase, userId, CONVERSION_EVENTS.UPGRADE_MODAL_VIEWED, {
    source,
    timestamp: new Date().toISOString()
  })
}

/**
 * Helper para trackear clic en boton de upgrade
 */
export async function trackUpgradeButtonClick(supabase, userId, source = 'modal') {
  return trackConversionEvent(supabase, userId, CONVERSION_EVENTS.UPGRADE_BUTTON_CLICKED, {
    source,
    timestamp: new Date().toISOString()
  })
}

/**
 * Helper para trackear limite alcanzado
 */
export async function trackLimitReached(supabase, userId, questionsToday) {
  return trackConversionEvent(supabase, userId, CONVERSION_EVENTS.LIMIT_REACHED, {
    questions_today: questionsToday,
    timestamp: new Date().toISOString()
  })
}

/**
 * Helper para trackear vista de pagina premium
 */
export async function trackPremiumPageView(supabase, userId, referrer = null) {
  return trackConversionEvent(supabase, userId, CONVERSION_EVENTS.PREMIUM_PAGE_VIEWED, {
    referrer,
    timestamp: new Date().toISOString()
  })
}

/**
 * Helper para trackear inicio de checkout
 */
export async function trackCheckoutStarted(supabase, userId, plan) {
  return trackConversionEvent(supabase, userId, CONVERSION_EVENTS.CHECKOUT_STARTED, {
    plan,
    timestamp: new Date().toISOString()
  })
}

/**
 * Helper para trackear pago completado (llamar desde webhook)
 */
export async function trackPaymentCompleted(supabase, userId, amount, plan) {
  return trackConversionEvent(supabase, userId, CONVERSION_EVENTS.PAYMENT_COMPLETED, {
    amount,
    plan,
    timestamp: new Date().toISOString()
  })
}
