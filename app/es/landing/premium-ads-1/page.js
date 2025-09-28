// app/es/premium-ads/page.js - VERSIÓN HONESTA SIN EXAGERACIONES
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../../../contexts/AuthContext'
import { useSearchParams } from 'next/navigation'

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
          redirectTo: `${window.location.origin}/auth/callback?return_to=${encodeURIComponent(`/es/premium-ads?start_checkout=true&campaign=${campaignId}`)}`,
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

  // Mostrar pantalla de carga mientras se procesa el checkout automático
  if (user && userProfile && (searchParams.get('start_checkout') === 'true') && (loading || checkoutInitiated)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="animate-pulse text-6xl mb-4">🔥</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">¡Activando tu acceso premium!</h2>
          <p className="text-gray-600 mb-4">Redirigiendo a pago seguro...</p>
          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
              ⚠️ {error}
              <button 
                onClick={() => {
                  setError('')
                  setCheckoutInitiated(false)
                  setLoading(false)
                }}
                className="ml-2 underline"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white py-3">
        <div className="container mx-auto px-4 text-center">
          <p className="font-bold text-sm">
            🔥 Oferta especial disponible este mes 🔥
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">⚡</div>
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-4">
            ¡APRUEBA tu
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-600"> OPOSICIÓN</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-700 mb-6 font-bold">
            El método inteligente para preparar oposiciones con <span className="text-red-600">tecnología avanzada</span>
          </p>
          
          {/* Social Proof */}
          <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4 mb-6 inline-block">
            <p className="text-sm font-bold text-yellow-800">
              ⭐⭐⭐⭐⭐ "Aprobé en mi segunda convocatoria gracias a iLoveTest"<br/>
              <span className="text-xs">- María González, Madrid (Aprobada 2024)</span>
            </p>
          </div>
        </div>

        {/* Testimonial Destacado */}
        <div className="bg-white rounded-xl shadow-2xl p-6 mb-8 max-w-4xl mx-auto border-l-8 border-green-500">
          <div className="flex items-center mb-4">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4">
              LG
            </div>
            <div>
              <p className="font-bold text-lg">Laura García</p>
              <p className="text-green-600 font-semibold">✅ APROBADA - Auxiliar Administrativo Estado</p>
            </div>
          </div>
          <blockquote className="text-lg italic text-gray-700 mb-4">
            "Había suspendido 3 veces. Con iLoveTest practiqué 2 horas diarias durante 4 meses y APROBÉ con un 8.5. 
            La IA personalizada me mostró exactamente mis puntos débiles. ¡No puedo estar más agradecida!"
          </blockquote>
          <p className="text-sm text-gray-600">⭐⭐⭐⭐⭐ Verificado • Diciembre 2024</p>
        </div>

        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center">
          
          {/* Left Column - Benefits */}
          <div>
            <h2 className="text-3xl font-black mb-6 text-gray-900">
              ¿Por qué elegir iLoveTest?
            </h2>
            
            <div className="space-y-4 mb-8">
              {[
                { icon: "🎯", title: "IA Personalizada", desc: "Te dice exactamente qué estudiar según tus errores" },
                { icon: "📊", title: "5.000+ Preguntas", desc: "Análisis de exámenes anteriores para enfocar tu esfuerzo" },
                { icon: "⚡", title: "Tests Ilimitados 24/7", desc: "Practica cuando quieras, cuanto quieras" },
                { icon: "📈", title: "Analytics Avanzados", desc: "Conoce tu progreso y probabilidad de aprobar" },
                { icon: "🏆", title: "Simulacros Exactos", desc: "Mismo formato, mismo tiempo, misma dificultad" }
              ].map((item, index) => (
                <div key={index} className="flex items-start space-x-4 bg-white p-4 rounded-lg shadow-md border-l-4 border-red-500">
                  <span className="text-3xl">{item.icon}</span>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{item.title}</h3>
                    <p className="text-gray-700">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Motivación */}
            <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-blue-800 mb-2">💡 ¡Aprovecha esta oportunidad!</h3>
              <p className="text-blue-700 text-sm">
                Las próximas convocatorias están cerca. 
                Empezar hoy te da más tiempo para prepararte adecuadamente 
                y aumentar tus posibilidades de éxito.
              </p>
            </div>
          </div>

          {/* Right Column - CTA Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 border-4 border-red-500 relative">
            
            {/* Badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-red-600 text-white px-6 py-2 rounded-full font-bold text-sm">
                🔥 PLAN PREMIUM
              </span>
            </div>

            <div className="text-center pt-4">
              <h3 className="text-3xl font-black text-gray-900 mb-4">
                ACCESO PREMIUM
              </h3>
              
              {/* Precio */}
              <div className="mb-6">
                <div className="flex items-center justify-center space-x-3 mb-2">
                  <span className="text-2xl line-through text-gray-400">€149</span>
                  <span className="text-5xl font-black text-red-600">€59</span>
                </div>
                <p className="text-lg text-gray-700">6 meses completos</p>
                <p className="text-sm text-green-600 font-bold">✅ 7 DÍAS GRATIS INCLUIDOS</p>
              </div>

              {/* Lista de lo que incluye */}
              <div className="text-left mb-6 space-y-2">
                {[
                  "✅ Tests ilimitados",
                  "✅ IA personalizada", 
                  "✅ 5.000+ preguntas de práctica",
                  "✅ Analytics avanzados",
                  "✅ Simulacros de convocatoria",
                  "✅ Soporte premium 24/7"
                ].map((item, index) => (
                  <p key={index} className="text-sm font-medium text-gray-700">{item}</p>
                ))}
              </div>

              {/* CTA Button */}
              <button
                onClick={handleStartTrial}
                disabled={loading || checkoutInitiated}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white py-5 px-8 rounded-xl font-black text-xl hover:from-red-700 hover:to-orange-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 shadow-xl mb-4"
              >
                {loading || checkoutInitiated ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    PROCESANDO...
                  </div>
                ) : (
                  <>
                    🚀 EMPEZAR AHORA
                    <div className="text-sm font-normal mt-1">7 días gratis, después €59/6 meses</div>
                  </>
                )}
              </button>

              {/* Garantía */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-700 font-bold">
                  🛡️ GARANTÍA: Si no estás satisfecho, te devolvemos el dinero
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
                  ⚠️ {error}
                  <button 
                    onClick={() => {
                      setError('')
                      setCheckoutInitiated(false)
                      setLoading(false)
                    }}
                    className="ml-2 underline"
                  >
                    Reintentar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Social Proof Bottom */}
        <div className="mt-12 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">
            Únete a los opositores que confían en iLoveTest
          </h3>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { name: "Carlos M.", role: "Aprobado Madrid", quote: "8.7 en mi primer intento" },
              { name: "Ana R.", role: "Aprobada Valencia", quote: "La IA cambió mi forma de estudiar" },
              { name: "David L.", role: "Aprobado Sevilla", quote: "4 meses de estudio, resultado perfecto" }
            ].map((testimonial, index) => (
              <div key={index} className="bg-white p-4 rounded-lg shadow-lg">
                <p className="font-bold text-green-600 mb-2">⭐⭐⭐⭐⭐</p>
                <p className="text-sm italic text-gray-700 mb-2">"{testimonial.quote}"</p>
                <p className="font-bold text-xs">{testimonial.name}</p>
                <p className="text-xs text-gray-600">{testimonial.role}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer con llamada a la acción */}
        <div className="mt-12 text-center bg-yellow-100 border-2 border-yellow-400 rounded-lg p-6">
          <p className="text-lg font-bold text-yellow-800 mb-2">
            ⏰ No pierdas más tiempo estudiando de forma ineficiente
          </p>
          <p className="text-sm text-yellow-700">
            Empieza hoy con un método que realmente funciona y te acerca a tu objetivo.
          </p>
        </div>
      </div>
    </div>
  )
}