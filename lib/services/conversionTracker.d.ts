// lib/services/conversionTracker.d.ts - Type declarations

import type { SupabaseClient } from '@supabase/supabase-js'

export const CONVERSION_EVENTS: {
  LIMIT_REACHED: 'limit_reached'
  UPGRADE_MODAL_VIEWED: 'upgrade_modal_viewed'
  UPGRADE_BUTTON_CLICKED: 'upgrade_button_clicked'
  PREMIUM_PAGE_VIEWED: 'premium_page_viewed'
  CHECKOUT_STARTED: 'checkout_started'
  CHECKOUT_ABANDONED: 'checkout_abandoned'
  PAYMENT_COMPLETED: 'payment_completed'
  TRIAL_STARTED: 'trial_started'
  CHURNED: 'churned'
}

export function trackConversionEvent(
  supabase: SupabaseClient,
  userId: string,
  eventType: string,
  eventData?: Record<string, unknown>
): Promise<void>

export function trackUpgradeModalView(
  supabase: SupabaseClient,
  userId: string,
  source?: string
): Promise<void>

export function trackUpgradeButtonClick(
  supabase: SupabaseClient,
  userId: string,
  source?: string
): Promise<void>

export function trackLimitReached(
  supabase: SupabaseClient,
  userId: string,
  questionsToday: number
): Promise<void>

export function trackPremiumPageView(
  supabase: SupabaseClient,
  userId: string,
  referrer?: string | null,
  fromSource?: string | null
): Promise<void>

export function trackCheckoutStarted(
  supabase: SupabaseClient,
  userId: string,
  plan: string
): Promise<void>

export function trackPaymentCompleted(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  plan: string
): Promise<void>
