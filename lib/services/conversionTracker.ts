// lib/services/conversionTracker.ts
// Servicio para tracking de eventos de conversion
//
// AGNÓSTICO (Fase C1): ya no recibe el cliente supabase ni hace supabase.rpc.
// Llama a POST /api/v2/conversion-event (Drizzle + verifyAuth), que ejecuta la
// MISMA función plpgsql track_conversion_event. user_id sale del TOKEN. Client-only.
'use client'

import { getAuthHeaders } from '@/lib/api/authHeaders'

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

// NOTA de firma (Fase C1): se eliminó el 1er parámetro `supabase` de TODAS las
// funciones. El user_id se deriva del token en el endpoint, no del argumento; el
// param `userId` que conservan algunas firmas es solo para logging/compatibilidad.
export async function trackConversionEvent(
  userId: string,
  eventType: string,
  eventData: Record<string, unknown> = {}
): Promise<unknown> {
  if (!eventType) {
    console.warn('trackConversionEvent: falta eventType', { userId })
    return null
  }

  try {
    const headers = await getAuthHeaders()
    const res = await fetch('/api/v2/conversion-event', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, eventData }),
    })

    if (!res.ok) {
      console.error('Error tracking conversion event:', res.status)
      return null
    }

    console.log(`📊 Conversion event tracked: ${eventType}`, eventData)
    return (await res.json()).id ?? null

  } catch (err) {
    // Nunca romper la app por un error de tracking
    console.error('Error en trackConversionEvent:', err)
    return null
  }
}

export async function trackUpgradeModalView(userId: string, source: string = 'limit'): Promise<unknown> {
  return trackConversionEvent(userId, CONVERSION_EVENTS.UPGRADE_MODAL_VIEWED, {
    source,
    timestamp: new Date().toISOString()
  })
}

export async function trackUpgradeButtonClick(userId: string, source: string = 'modal'): Promise<unknown> {
  return trackConversionEvent(userId, CONVERSION_EVENTS.UPGRADE_BUTTON_CLICKED, {
    source,
    timestamp: new Date().toISOString()
  })
}

export async function trackLimitReached(userId: string, questionsToday: number, extra: Record<string, unknown> = {}): Promise<unknown> {
  return trackConversionEvent(userId, CONVERSION_EVENTS.LIMIT_REACHED, {
    questions_today: questionsToday,
    timestamp: new Date().toISOString(),
    ...extra,
  })
}

export async function trackPremiumPageView(userId: string, referrer: string | null = null, fromSource: string | null = null): Promise<unknown> {
  return trackConversionEvent(userId, CONVERSION_EVENTS.PREMIUM_PAGE_VIEWED, {
    referrer,
    from_source: fromSource,
    timestamp: new Date().toISOString()
  })
}

export async function trackCheckoutStarted(userId: string, plan: string): Promise<unknown> {
  return trackConversionEvent(userId, CONVERSION_EVENTS.CHECKOUT_STARTED, {
    plan,
    timestamp: new Date().toISOString()
  })
}

export async function trackPaymentCompleted(userId: string, amount: number, plan: string): Promise<unknown> {
  return trackConversionEvent(userId, CONVERSION_EVENTS.PAYMENT_COMPLETED, {
    amount,
    plan,
    timestamp: new Date().toISOString()
  })
}
