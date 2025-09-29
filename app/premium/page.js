// app/premium/page.js - FLUJO PROFESIONAL OPCIÓN A
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useSearchParams } from 'next/navigation'

export default function PremiumPage() {
  const { user, loading: authLoading, supabase } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()

  // Auto-iniciar checkout después de login exitoso
  useEffect(() => {
    const shouldStartCheckout = searchParams.get('start_checkout') === 'true'
    
    if (shouldStartCheckout && user && !loading) {
      console.log('🎯 Usuario logueado, iniciando checkout automáticamente...')
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

  // FUNCIÓN: Checkout (Paso 2 - automático después del login)
  const handleCheckout = async () => {
    if (!user) {
      setError('Necesitas estar registrado primero')
      return
    }

    setLoading(true)
    setError('')

    try {
      console.log('🔄 Paso 2: Creando checkout para usuario:', user.email)

      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || 'price_1RjhHBCybKEAFwateoAVKstO',
          userId: user.id,
          trialDays: 7,
          mode: 'normal' // Usuario logueado
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      console.log('✅ Checkout session creada, redirigiendo a Stripe...')

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
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🚀 Vence Premium
          </h1>
          <p className="text-xl text-gray-600">
            Acceso completo a todos los tests de Auxiliar Administrativo
          </p>
        </div>

        {/* Plan Card */}
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
            
            {/* Badge */}
            <div className="text-center mb-6">
              <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-bold">
                🎉 7 DÍAS GRATIS
              </span>
            </div>

            {/* Price */}
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-gray-900 mb-2">€59</div>
              <div className="text-gray-600">cada 6 meses</div>
              <div className="text-sm text-green-600 font-medium mt-2">
                ✅ Prueba gratuita de 7 días incluida
              </div>
            </div>

            {/* Features */}
            <div className="space-y-4 mb-8">
              {[
                "Tests ilimitados",
                "Todos los 16 temas",
                "Preguntas oficiales exclusivas", 
                "IA personalizada",
                "Analytics avanzados"
              ].map((feature, index) => (
                <div key={index} className="flex items-center">
                  <span className="text-green-500 mr-3">✅</span>
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {/* LOADING STATE */}
            {authLoading && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Verificando tu sesión...</p>
              </div>
            )}

            {/* ESTADO 1: USUARIO NO LOGUEADO - MOSTRAR REGISTRO */}
            {!authLoading && !user && (
              <div>
                {/* Info del proceso */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="font-bold text-blue-800 mb-2">📋 Proceso simple:</h3>
                  <div className="space-y-2 text-sm text-blue-700">
                    <div className="flex items-center">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center mr-2 font-bold">1</span>
                      <span>Crear cuenta con Google (30 segundos)</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center mr-2 font-bold">2</span>
                      <span>Introducir datos de pago</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-6 h-6 bg-green-600 text-white rounded-full text-xs flex items-center justify-center mr-2 font-bold">3</span>
                      <span className="font-semibold">¡7 días gratis activados!</span>
                    </div>
                  </div>
                </div>

                {/* Botón principal */}
                <button
                  onClick={handleSignupFirst}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:opacity-90 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none mb-4"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Conectando con Google...
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
                      <span>Empezar 7 Días Gratis</span>
                    </div>
                  )}
                </button>

                {/* Info adicional */}
                <div className="text-xs text-gray-500 text-center space-y-1">
                  <p>• Sin compromisos • Cancela cuando quieras</p>
                  <p>• Proceso 100% seguro con Google y Stripe</p>
                </div>

                {/* Login para usuarios existentes */}
                <div className="text-center mt-6 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-3">¿Ya tienes cuenta?</p>
                  <a
                    href="/login?return_to=/premium"
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm underline"
                  >
                    Iniciar Sesión
                  </a>
                </div>
              </div>
            )}

            {/* ESTADO 2: USUARIO LOGUEADO - MOSTRAR CHECKOUT O ESTADO */}
            {!authLoading && user && (
              <div>
                {/* Si viene de Google Ads y debe hacer checkout automático */}
                {searchParams.get('start_checkout') === 'true' && loading && (
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <h3 className="font-bold text-gray-800 mb-2">✅ ¡Cuenta creada!</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Configurando tu suscripción...<br/>
                      <span className="text-xs text-gray-500">Redirigiendo a Stripe...</span>
                    </p>
                  </div>
                )}

                {/* Usuario ya logueado - mostrar estado según plan */}
                {!loading && (
                  <>
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
                          🚀 Ir a Tests
                        </a>
                      </div>
                    )}

                    {user.plan_type !== 'legacy_free' && (
                      <div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center mb-2">
                            <span className="text-lg mr-2">✅</span>
                            <span className="font-bold text-green-800">¡Perfecto, {user.email?.split('@')[0]}!</span>
                          </div>
                          <p className="text-sm text-green-700">
                            Tu cuenta está lista. Ahora vamos a configurar tu suscripción.
                          </p>
                        </div>

                        <button
                          onClick={handleCheckout}
                          disabled={loading}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                        >
                          {loading ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                              Creando checkout...
                            </div>
                          ) : (
                            '💳 Configurar Pago (7 Días Gratis)'
                          )}
                        </button>
                      </div>
                    )}
                  </>
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
              Al continuar aceptas nuestros términos de servicio y política de privacidad.
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
              <div>Start Checkout: {searchParams.get('start_checkout')}</div>
              <div>Loading: {loading.toString()}</div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}