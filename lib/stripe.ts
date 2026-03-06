// lib/stripe.ts
import Stripe from 'stripe'
import { loadStripe } from '@stripe/stripe-js'
import type { Stripe as StripeJS } from '@stripe/stripe-js'

// Stripe server-side instance (lazy initialization para evitar error en build)
let _stripeInstance: Stripe | null = null
const getStripeInstance = (): Stripe => {
  if (!_stripeInstance) {
    _stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      // NOTE: La app usa API 2024-06-20 aunque el SDK espera 2025-06-30.basil.
      // No actualizar sin verificar breaking changes de Stripe.
      apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
      appInfo: {
        name: 'Vence',
        version: '1.0.0',
      },
    })
  }
  return _stripeInstance
}

// Exportar función para obtener instancia (mantiene compatibilidad)
export const stripe = getStripeInstance

// Stripe client-side instance
let stripePromise: Promise<StripeJS | null> | null = null
export const getStripe = (): Promise<StripeJS | null> => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  }
  return stripePromise
}

// Verificar configuración
export const isStripeConfigured = (): boolean => {
  return !!(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
    process.env.STRIPE_SECRET_KEY
  )
}
