// lib/stripe.js
import Stripe from 'stripe'
import { loadStripe } from '@stripe/stripe-js'

// Stripe server-side instance (lazy initialization para evitar error en build)
let _stripeInstance = null
const getStripeInstance = () => {
  if (!_stripeInstance) {
    _stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
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
let stripePromise
export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  }
  return stripePromise
}

// Verificar configuración
export const isStripeConfigured = () => {
  return !!(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
    process.env.STRIPE_SECRET_KEY
  )
}