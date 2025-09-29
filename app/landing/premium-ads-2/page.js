// app/premium-ads-2/page.js - VERSIÓN HONESTA SIN EXAGERACIONES
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function PremiumAdsLanding() {
  const { user, supabase, userProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkoutInitiated, setCheckoutInitiated] = useState(false)
  const searchParams = useSearchParams()
  const campaignId = searchParams.get('campaign') || 'ads-aggressive'

  // Auto-iniciar checkout solo cuando el usuario Y su perfil estén listos
  useEffect(() => {
    if (user && userProfile && !loading && !checkoutInitiated && searchParams.get('start_checkout') === 'true') {
      console.log('🚀 Iniciando checkout automático para usuario con perfil completo')
      setCheckoutInitiated(true)
      handleCheckout()
    }
  }, [user, userProfile, loading, checkoutInitiated])

  const handleStartTrial = async () => {
    setLoading(true)
    setError('')

    try {
      console.log('🔄 Iniciando registro desde Google Ads (agresivo)...')
      
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?return_to=${encodeURIComponent(`/premium-ads?start_checkout=true&campaign=${campaignId}`)}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
            include_granted_scopes: 'true',
            scope: 'openid email profile'
          }
        }
      })
      
      if (authError) throw new Error('Error en el registro: ' + authError.message)
      
    } catch (err) {
      console.error('Error:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  const handleCheckout = async () => {
    if (!user || !userProfile) {
      console.log('⏳ Esperando usuario y perfil...')
      return
    }
    
    setLoading(true)
    try {
      console.log('🎯 Usuario de Google Ads - perfil ya creado por AuthContext:', userProfile.plan_type)
      
      // Esperar un poco para asegurar que la creación del usuario esté completa
      await new Promise(resolve => setTimeout(resolve, 1000))

      console.log('💳 Creando checkout session...')
      
      // Crear checkout session
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || 'price_1RjhHBCybKEAFwateoAVKstO',
          userId: user.id,
          trialDays: 7,
          mode: 'normal'
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.error('❌ Error en API:', data)
        throw new Error(data.error || 'Error creating checkout session')
      }

      console.log('✅ Checkout session creada:', data.sessionId)

      // Redirigir a Stripe
      const { loadStripe } = await import('@stripe/stripe-js')
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
      
      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      })

      if (stripeError) throw new Error(stripeError.message)

    } catch (err) {
      console.error('Error en checkout:', err)
      setError(err.message)
      setLoading(false)
      setCheckoutInitiated(false) // Resetear para permitir reintento
    }
  }

  // Show content...
  return <div>Landing page content here...</div>
}