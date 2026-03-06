// lib/services/conversionTracker.ts
// Servicio para tracking de eventos de conversion
'use client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientAny = any

export const CONVERSION_EVENTS = {
  // Registro
  REGISTRATION: 'registration',

  // Tests
  FIRST_TEST_STARTED: 'first_test_started',
  FIRST_TEST_COMPLETED: 'first_test_completed',
  TEST_COMPLETED: 'test_completed',

  // Limites
  LIMIT_REACHED: 'limit_reached',
  LIMIT_WARNING: 'limit_warning',

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
} as const

export async function trackConversionEvent(
  supabase: SupabaseClientAny,
  userId: string,
  eventType: string,
  eventData: Record<string, unknown> = {}
): Promise<unknown> {
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

export async function trackUpgradeModalView(supabase: SupabaseClientAny, userId: string, source: string = 'limit'): Promise<unknown> {
  return trackConversionEvent(supabase, userId, CONVERSION_EVENTS.UPGRADE_MODAL_VIEWED, {
    source,
    timestamp: new Date().toISOString()
  })
}

export async function trackUpgradeButtonClick(supabase: SupabaseClientAny, userId: string, source: string = 'modal'): Promise<unknown> {
  return trackConversionEvent(supabase, userId, CONVERSION_EVENTS.UPGRADE_BUTTON_CLICKED, {
    source,
    timestamp: new Date().toISOString()
  })
}

export async function trackLimitReached(supabase: SupabaseClientAny, userId: string, questionsToday: number): Promise<unknown> {
  return trackConversionEvent(supabase, userId, CONVERSION_EVENTS.LIMIT_REACHED, {
    questions_today: questionsToday,
    timestamp: new Date().toISOString()
  })
}

export async function trackPremiumPageView(supabase: SupabaseClientAny, userId: string, referrer: string | null = null, fromSource: string | null = null): Promise<unknown> {
  return trackConversionEvent(supabase, userId, CONVERSION_EVENTS.PREMIUM_PAGE_VIEWED, {
    referrer,
    from_source: fromSource,
    timestamp: new Date().toISOString()
  })
}

export async function trackCheckoutStarted(supabase: SupabaseClientAny, userId: string, plan: string): Promise<unknown> {
  return trackConversionEvent(supabase, userId, CONVERSION_EVENTS.CHECKOUT_STARTED, {
    plan,
    timestamp: new Date().toISOString()
  })
}

export async function trackPaymentCompleted(supabase: SupabaseClientAny, userId: string, amount: number, plan: string): Promise<unknown> {
  return trackConversionEvent(supabase, userId, CONVERSION_EVENTS.PAYMENT_COMPLETED, {
    amount,
    plan,
    timestamp: new Date().toISOString()
  })
}
