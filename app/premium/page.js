// app/premium/page.js - PÁGINA DE PAGO PREMIUM
'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSearchParams } from 'next/navigation'
import { trackPremiumPageView, trackCheckoutStarted } from '@/lib/services/conversionTracker'

function PremiumPageContent() {
  const { user, loading: authLoading, supabase } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('semester') // 'semester' o 'monthly'
  const searchParams = useSearchParams()
  const hasTrackedPageView = useRef(false)

  // Trackear vista de pagina premium
  useEffect(() => {
    if (user && supabase && !hasTrackedPageView.current && !authLoading) {
      const referrer = document.referrer || null
      trackPremiumPageView(supabase, user.id, referrer)
      hasTrackedPageView.current = true
    }
  }, [user, supabase, authLoading])

  // Auto-iniciar checkout después de login exitoso
  const hasTriedAutoCheckout = useRef(false)

  useEffect(() => {
    const shouldStartCheckout = searchParams.get('start_checkout') === 'true'

    if (shouldStartCheckout && user && !loading && !hasTriedAutoCheckout.current) {
      hasTriedAutoCheckout.current = true
      console.log('🎯 Usuario logueado, iniciando checkout automáticamente...')

      // Limpiar URL para evitar bucles
      window.history.replaceState({}, '', '/premium')

      handleCheckout()
    }
  }, [user, searchParams, loading])

  // FUNCIÓN: Registrarse con Google (Paso 1)
  const handleSignupFirst = async () => {
    setLoading(true)
    setError('')

    try {
      console.log('🔄 Paso 1: Iniciando registro con Google...')

      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?return_to=${encodeURIComponent('/premium?start_checkout=true')}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
            include_granted_scopes: 'true',
            scope: 'openid email profile'
          }
        }
      })

      if (authError) {
        throw new Error('Error en el registro: ' + authError.message)
      }

    } catch (err) {
      console.error('Error:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  // FUNCIÓN: Checkout (Paso 2)
  const handleCheckout = async () => {
    if (!user) {
      setError('Necesitas estar registrado primero')
      return
    }

    setLoading(true)
    setError('')

    try {
      console.log('🔄 Creando checkout para usuario:', user.email, 'Plan:', selectedPlan)

      // Trackear inicio de checkout
      if (supabase && user.id) {
        trackCheckoutStarted(supabase, user.id, selectedPlan)
      }

      // Determinar el priceId según el plan seleccionado
      const priceId = selectedPlan === 'semester'
        ? (process.env.NEXT_PUBLIC_STRIPE_PRICE_SEMESTER || 'price_1RjhHBCybKEAFwateoAVKstO')
        : (process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY || 'price_monthly_placeholder')

      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: priceId,
          userId: user.id,
          mode: 'normal'
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      console.log('✅ Checkout session creada, redirigiendo a Stripe...')

      // Redirigir usando la URL directa de Stripe (más confiable)
      if (data.checkoutUrl) {
        console.log('🔗 Usando URL directa de Stripe checkout')
        window.location.href = data.checkoutUrl
        return
      }

      // Fallback: usar redirectToCheckout si no hay URL
      console.log('🔄 Fallback: usando redirectToCheckout')
      const { loadStripe } = await import('@stripe/stripe-js')
      const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      console.log('🔑 Stripe Publishable Key:', stripeKey ? `${stripeKey.substring(0, 20)}...` : 'UNDEFINED/EMPTY')

      if (!stripeKey) {
        throw new Error('Stripe publishable key is not configured')
      }

      const stripe = await loadStripe(stripeKey)
      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      })

      if (stripeError) throw new Error(stripeError.message)

    } catch (err) {
      console.error('Error en checkout:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 py-12">
      <div className="max-w-4xl mx-auto px-4">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            👑 Vence Premium
          </h1>
          <p className="text-xl text-gray-600">
            Acceso ilimitado a todos los tests de la plataforma
          </p>
        </div>

        {/* Plan Cards */}
        <div className="max-w-2xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6 mb-8">

            {/* Plan Semestral */}
            <div
              onClick={() => setSelectedPlan('semester')}
              className={`bg-white rounded-2xl shadow-lg p-6 border-2 cursor-pointer transition-all ${
                selectedPlan === 'semester'
                  ? 'border-amber-500 ring-2 ring-amber-200'
                  : 'border-gray-200 hover:border-amber-300'
              }`}
            >
              <div className="text-center">
                {selectedPlan === 'semester' && (
                  <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold mb-4 inline-block">
                    MEJOR PRECIO
                  </span>
                )}
                <h3 className="text-lg font-bold text-gray-800 mb-2">Plan Semestral</h3>
                <div className="text-4xl font-bold text-gray-900 mb-1">59€</div>
                <div className="text-gray-500 text-sm mb-4">cada 6 meses</div>
                <div className="text-green-600 text-sm font-medium">
                  Ahorras 61€ al año
                </div>
              </div>
            </div>

            {/* Plan Mensual */}
            <div
              onClick={() => setSelectedPlan('monthly')}
              className={`bg-white rounded-2xl shadow-lg p-6 border-2 cursor-pointer transition-all ${
                selectedPlan === 'monthly'
                  ? 'border-amber-500 ring-2 ring-amber-200'
                  : 'border-gray-200 hover:border-amber-300'
              }`}
            >
              <div className="text-center">
                <div className="h-6 mb-4"></div> {/* Spacer para alinear */}
                <h3 className="text-lg font-bold text-gray-800 mb-2">Plan Mensual</h3>
                <div className="text-4xl font-bold text-gray-900 mb-1">20€</div>
                <div className="text-gray-500 text-sm mb-4">al mes</div>
                <div className="text-gray-400 text-sm">
                  Flexibilidad total
                </div>
              </div>
            </div>
          </div>

          {/* Beneficios */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h3 className="font-bold text-gray-800 mb-4 text-center">Incluido en Premium:</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                "Preguntas ilimitadas",
                "Acceso a todos los temas",
                "Sé el primero en probar las últimas novedades de la plataforma"
              ].map((feature, index) => (
                <div key={index} className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span className="text-gray-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Botón de pago */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">

            {/* LOADING STATE */}
            {authLoading && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Verificando tu sesión...</p>
              </div>
            )}

            {/* ESTADO 1: USUARIO NO LOGUEADO */}
            {!authLoading && !user && (
              <div>
                <div className="text-center mb-6">
                  <p className="text-gray-600">Crea una cuenta para continuar</p>
                </div>

                <button
                  onClick={handleSignupFirst}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-4 px-6 rounded-lg font-bold text-lg hover:from-amber-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none mb-4"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Conectando...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-3">
                      <div className="bg-white rounded-full p-1">
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      </div>
                      <span>Continuar con Google</span>
                    </div>
                  )}
                </button>

                <div className="text-center">
                  <a
                    href="/login?return_to=/premium"
                    className="text-amber-600 hover:text-amber-800 font-medium text-sm"
                  >
                    ¿Ya tienes cuenta? Iniciar Sesión
                  </a>
                </div>
              </div>
            )}

            {/* ESTADO 2: USUARIO LOGUEADO */}
            {!authLoading && user && (
              <div>
                {user.plan_type === 'legacy_free' && (
                  <div className="text-center">
                    <div className="bg-gradient-to-r from-green-100 to-emerald-100 border border-green-300 text-green-800 px-4 py-3 rounded-lg mb-4">
                      <span className="text-lg font-bold">🎉 ¡Usuario VIP!</span><br/>
                      Tienes acceso gratuito de por vida
                    </div>
                    <a
                      href="/auxiliar-administrativo-estado/test"
                      className="inline-block bg-green-600 text-white py-3 px-6 rounded-lg font-bold hover:bg-green-700 transition-colors"
                    >
                      Ir a Tests
                    </a>
                  </div>
                )}

                {user.plan_type === 'premium' && (
                  <div className="text-center">
                    <div className="bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-300 text-amber-800 px-4 py-3 rounded-lg mb-4">
                      <span className="text-lg font-bold">👑 Ya eres Premium</span><br/>
                      Disfruta de acceso ilimitado
                    </div>
                    <a
                      href="/auxiliar-administrativo-estado/test"
                      className="inline-block bg-amber-600 text-white py-3 px-6 rounded-lg font-bold hover:bg-amber-700 transition-colors"
                    >
                      Ir a Tests
                    </a>
                  </div>
                )}

                {user.plan_type !== 'legacy_free' && user.plan_type !== 'premium' && (
                  <div>
                    <div className="text-center mb-6">
                      <p className="text-lg font-medium text-gray-800">
                        Plan seleccionado: <span className="text-amber-600 font-bold">
                          {selectedPlan === 'semester' ? '59€ / 6 meses' : '20€ / mes'}
                        </span>
                      </p>
                    </div>

                    <button
                      onClick={handleCheckout}
                      disabled={loading}
                      className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Procesando...
                        </div>
                      ) : (
                        '💳 Pagar'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Error Messages */}
            {error && (
              <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
                <div className="flex items-center">
                  <span className="text-lg mr-2">⚠️</span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Terms */}
            <div className="text-xs text-gray-500 text-center mt-6">
              Pago seguro con Stripe. Al continuar aceptas nuestros términos de servicio.
            </div>
          </div>
        </div>

        {/* Debug Info en desarrollo */}
        {process.env.NODE_ENV === 'development' && user && (
          <div className="mt-8 p-4 bg-gray-100 rounded-lg max-w-md mx-auto">
            <h3 className="font-bold mb-2">🔍 Debug Info:</h3>
            <div className="text-sm space-y-1">
              <div>User ID: {user.id}</div>
              <div>Email: {user.email}</div>
              <div>Plan Type: {user.plan_type}</div>
              <div>Selected Plan: {selectedPlan}</div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default function PremiumPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-amber-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Cargando...
          </h2>
        </div>
      </div>
    }>
      <PremiumPageContent />
    </Suspense>
  )
}
