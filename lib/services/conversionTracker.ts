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

  // Premium GATE por-feature (framework de gating, lib/premium/features.ts). Cada evento
  // lleva `feature` (id del registro) + `kind` → medible al 100%: qué gate se muestra por
  // feature y cuál convierte. Embudo: gate_shown → gate_cta_click → checkout_started → payment.
  PREMIUM_GATE_SHOWN: 'premium_gate_shown',
  PREMIUM_GATE_CTA_CLICK: 'premium_gate_cta_click',
  PREMIUM_GATE_DISMISS: 'premium_gate_dismiss',

  // Uso REAL de features avanzadas del configurador (medición para decidir qué gatear).
  // 1 evento por test creado, con las features activas + plan → v_config_feature_usage.
  CONFIG_FEATURES_USED: 'config_features_used',

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

// ── Premium GATE por-feature (framework lib/premium) ─────────────────────────
// `feature` = id del registro (lib/premium/features.ts); `kind` = tipo; `context` = dónde
// (p.ej. 'test_configurator', 'course_player'). Fire-and-forget, nunca rompe la UX.
interface PremiumGatePayload { feature: string; kind: string; context?: string; extra?: Record<string, unknown> }

export async function trackPremiumGateShown(userId: string, p: PremiumGatePayload): Promise<unknown> {
  return trackConversionEvent(userId, CONVERSION_EVENTS.PREMIUM_GATE_SHOWN, {
    feature: p.feature, kind: p.kind, context: p.context ?? null, ...p.extra, timestamp: new Date().toISOString(),
  })
}

export async function trackPremiumGateCtaClick(userId: string, p: PremiumGatePayload): Promise<unknown> {
  return trackConversionEvent(userId, CONVERSION_EVENTS.PREMIUM_GATE_CTA_CLICK, {
    feature: p.feature, kind: p.kind, context: p.context ?? null, ...p.extra, timestamp: new Date().toISOString(),
  })
}

export async function trackPremiumGateDismiss(userId: string, p: PremiumGatePayload): Promise<unknown> {
  return trackConversionEvent(userId, CONVERSION_EVENTS.PREMIUM_GATE_DISMISS, {
    feature: p.feature, kind: p.kind, context: p.context ?? null, ...p.extra, timestamp: new Date().toISOString(),
  })
}

// Uso real de features del configurador al crear un test. `features` = ids activos;
// `plan` = 'free' | 'premium' (lo sabe el cliente, sin coste de BD). Fire-and-forget.
export async function trackConfigFeaturesUsed(
  userId: string,
  p: { features: string[]; plan: 'free' | 'premium'; context?: string },
): Promise<unknown> {
  if (!p.features || p.features.length === 0) return // nada avanzado activo → no emitir ruido
  return trackConversionEvent(userId, CONVERSION_EVENTS.CONFIG_FEATURES_USED, {
    features: p.features, plan: p.plan, context: p.context ?? 'test_configurator', timestamp: new Date().toISOString(),
  })
}
