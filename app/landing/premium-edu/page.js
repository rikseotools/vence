// app/premium-edu/page.js - LANDING EDUCATIVA ORIENTADA A PAGO
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export const dynamic = 'force-dynamic'

function PremiumEducationalContent() {
  const { user, supabase, userProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('features')
  
  const campaignId = 'ads-educational'

  /*useEffect(() => {
    if (user && userProfile && !loading) {
      handleCheckout()
    }
  }, [user, userProfile, loading])*/

  const handleStartTrial = async () => {
    setLoading(true)
    setError('')

    try {
      console.log('🔄 Iniciando registro desde Google Ads (educativo)...')
      
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?return_to=${encodeURIComponent(`/premium-edu?start_checkout=true&campaign=${campaignId}`)}`,
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
    if (!user) return
    
    setLoading(true)
    try {
      console.log('🎯 Usuario de Google Ads Educativo - crear como premium_required')
      
      await supabase.rpc('create_google_ads_user', {
        user_id: user.id,
        user_email: user.email,
        user_name: user.user_metadata?.full_name || user.email?.split('@')[0],
        campaign_id: campaignId
      })

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
      if (!response.ok) throw new Error(data.error)

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
    }
  }

  if (user && searchParams.get('start_checkout') === 'true') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="animate-pulse text-6xl mb-4">🎓</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Preparando tu plataforma de estudio...</h2>
          <p className="text-gray-600">Configurando acceso premium...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      
      {/* Header Profesional */}
      <header className="bg-white shadow-sm border-b border-blue-100">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-3xl">🎓</div>
              <h1 className="text-2xl font-bold text-blue-900">iLoveTest Premium</h1>
            </div>
            <div className="hidden md:flex items-center space-x-6 text-sm text-gray-600">
              <span>✅ Especializado en Auxiliar Administrativo</span>
              <span>✅ Verificado por opositores</span>
              <span>✅ Garantía de resultados</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Aprueba las oposiciones de
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600"> Auxiliar Administrativo del Estado</span>
          </h1>
          <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
            La plataforma más avanzada con Inteligencia Artificial que analiza tu rendimiento y crea un plan de estudio personalizado 
            específicamente para las oposiciones de Auxiliar Administrativo del Estado.
          </p>
          
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-4xl mx-auto">
            <div className="grid md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-blue-600 mb-2">Exclusivo</div>
                <p className="text-sm text-gray-600">Auxiliar Administrativo del Estado únicamente</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600 mb-2">Oficial</div>
                <p className="text-sm text-gray-600">Preguntas de convocatorias reales del Estado</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600 mb-2">IA</div>
                <p className="text-sm text-gray-600">Tecnología de análisis personalizado</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600 mb-2">24/7</div>
                <p className="text-sm text-gray-600">Acceso completo desde cualquier dispositivo</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-12">
          <div className="flex justify-center space-x-1 bg-white rounded-lg p-1 max-w-2xl mx-auto shadow-lg">
            {[
              { id: 'features', label: '🎯 Características', icon: '🎯' },
              { id: 'demo', label: '📱 Demo Interactivo', icon: '📱' },
              { id: 'testimonials', label: '⭐ Testimonios', icon: '⭐' },
              { id: 'science', label: '🧠 La Ciencia', icon: '🧠' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden text-lg">{tab.icon}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-12 items-start">
          
          {/* Content Area */}
          <div className="lg:col-span-2">
            
            {/* Features Tab */}
            {activeTab === 'features' && (
              <div className="space-y-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-8">¿Por qué iLoveTest es diferente?</h2>
                
                {[
                  {
                    icon: "🎯",
                    title: "Especializado Exclusivamente en Auxiliar Administrativo del Estado",
                    description: "No perdemos tiempo con otras oposiciones. Toda nuestra tecnología está enfocada 100% en ayudarte a aprobar las oposiciones de Auxiliar Administrativo del Estado.",
                    details: ["Temario oficial actualizado", "Preguntas de convocatorias reales", "Simulacros exactos del examen estatal"]
                  },
                  {
                    icon: "🤖",
                    title: "Inteligencia Artificial Personalizada",
                    description: "Nuestro algoritmo analiza tus respuestas y identifica exactamente en qué temas del temario de Auxiliar Administrativo necesitas mejorar.",
                    details: ["Análisis predictivo de rendimiento", "Recomendaciones personalizadas", "Adaptación continua a tu progreso"]
                  },
                  {
                    icon: "📊",
                    title: "Analytics Avanzados de Progreso",
                    description: "Visualiza tu evolución con métricas detalladas que te muestran tu probabilidad real de aprobar las oposiciones del Estado.",
                    details: ["Gráficos de evolución temporal", "Comparativa con otros opositores", "Predicción de resultados"]
                  },
                  {
                    icon: "📚",
                    title: "16 Temas Legislativos Completos",
                    description: "Acceso completo a los 16 temas de la parte legislativa de las oposiciones de Auxiliar Administrativo del Estado, con preguntas de convocatorias oficiales desde 2015.",
                    details: ["16 temas legislativos oficiales", "Preguntas de convocatorias reales", "Explicaciones detalladas por tema"]
                  }
                ].map((feature, index) => (
                  <div key={index} className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                    <div className="flex items-start space-x-4">
                      <span className="text-4xl">{feature.icon}</span>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                        <p className="text-gray-700 mb-4 leading-relaxed">{feature.description}</p>
                        <ul className="space-y-1">
                          {feature.details.map((detail, i) => (
                            <li key={i} className="text-sm text-blue-600 flex items-center">
                              <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Demo Tab */}
            {activeTab === 'demo' && (
              <div className="space-y-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-8">Ve iLoveTest en acción</h2>
                
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="flex space-x-1">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                    <span className="text-gray-400 text-sm">iLoveTest Dashboard</span>
                  </div>
                  
                  <div className="bg-white rounded-lg p-6 text-gray-900">
                    <h3 className="font-bold mb-4">📊 Tu Progreso Hoy</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-blue-50 p-3 rounded">
                        <div className="text-2xl font-bold text-blue-600">78%</div>
                        <div className="text-sm text-gray-600">Precisión global</div>
                      </div>
                      <div className="bg-green-50 p-3 rounded">
                        <div className="text-2xl font-bold text-green-600">156</div>
                        <div className="text-sm text-gray-600">Tests completados</div>
                      </div>
                    </div>
                    
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                      <h4 className="font-semibold text-yellow-800">🎯 Recomendación IA</h4>
                      <p className="text-sm text-yellow-700">
                        Enfócate en "Procedimiento Administrativo" - detectamos un 15% de mejora potencial
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h4 className="font-bold text-lg mb-3">🧠 IA en Tiempo Real</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm">Tema 1: Constitución</span>
                        <span className="text-green-600 font-bold">92%</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                        <span className="text-sm">Tema 7: Procedimiento</span>
                        <span className="text-red-600 font-bold">67%</span>
                      </div>
                      <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
                        💡 Sugerencia: Dedica 30 min más al Tema 7 hoy
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h4 className="font-bold text-lg mb-3">📈 Predicción de Éxito</h4>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-green-600 mb-2">84%</div>
                      <p className="text-sm text-gray-600 mb-3">Probabilidad de aprobar en Mayo 2026</p>
                      <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full inline-block">
                        ↗ +12% esta semana
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Testimonials Tab */}
            {activeTab === 'testimonials' && (
              <div className="space-y-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-8">Lo que dicen nuestros usuarios</h2>
                
                {[
                  {
                    name: "María González",
                    role: "Aprobada - Auxiliar Administrativo del Estado",
                    avatar: "MG",
                    rating: 5,
                    quote: "Llevaba 2 años intentándolo por mi cuenta sin éxito. Con iLoveTest aprobé en mi primer intento después de 4 meses de preparación. La IA me ayudó a identificar mis puntos débiles que ni yo sabía que tenía.",
                    date: "Convocatoria 2024",
                    verified: true
                  },
                  {
                    name: "Carlos Ruiz",
                    role: "Aprobado - Auxiliar Administrativo del Estado", 
                    avatar: "CR",
                    rating: 5,
                    quote: "Lo que más me gustó fueron los simulacros exactos. Cuando llegué al examen real, sentí como si ya lo hubiera hecho 100 veces. La interfaz es idéntica y eso me dio mucha confianza.",
                    date: "Convocatoria 2024",
                    verified: true
                  },
                  {
                    name: "Ana López",
                    role: "Estudiando para Auxiliar Administrativo 2026",
                    avatar: "AL", 
                    rating: 5,
                    quote: "Llevo 3 meses usando la plataforma y mi evolución es impresionante. El dashboard me muestra exactamente en qué punto estoy cada día. Mi predicción de éxito ha subido del 45% al 89%.",
                    date: "Usuario activo",
                    verified: false
                  }
                ].map((testimonial, index) => (
                  <div key={index} className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                        {testimonial.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-bold text-gray-900">{testimonial.name}</h4>
                          {testimonial.verified && (
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                              ✓ Verificado
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{testimonial.role}</p>
                        <div className="flex items-center mb-3">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <span key={i} className="text-yellow-400">⭐</span>
                          ))}
                        </div>
                        <blockquote className="text-gray-700 italic mb-3">
                          "{testimonial.quote}"
                        </blockquote>
                        <p className="text-xs text-gray-500">{testimonial.date}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Science Tab */}
            {activeTab === 'science' && (
              <div className="space-y-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-8">La ciencia detrás de iLoveTest</h2>
                
                <div className="bg-white rounded-xl shadow-lg p-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">🧠 Metodología basada en evidencia científica</h3>
                  
                  <div className="space-y-6">
                    <div className="border-l-4 border-blue-500 pl-6">
                      <h4 className="font-bold text-lg text-gray-900 mb-2">Repetición Espaciada</h4>
                      <p className="text-gray-700 mb-2">
                        Algoritmo basado en la curva de olvido de Ebbinghaus. Las preguntas se repiten en intervalos optimizados para maximizar la retención a largo plazo.
                      </p>
                      <p className="text-sm text-blue-600">📊 Incrementa la retención en un 400% vs. estudio tradicional</p>
                    </div>
                    
                    <div className="border-l-4 border-green-500 pl-6">
                      <h4 className="font-bold text-lg text-gray-900 mb-2">Testing Effect</h4>
                      <p className="text-gray-700 mb-2">
                        Probado científicamente: practicar con tests mejora la memorización más que releer temarios. Nuestro sistema se basa en esta técnica.
                      </p>
                      <p className="text-sm text-green-600">📈 300% más efectivo que estudiar solo teoría</p>
                    </div>
                    
                    <div className="border-l-4 border-purple-500 pl-6">
                      <h4 className="font-bold text-lg text-gray-900 mb-2">Análisis de Patrones</h4>
                      <p className="text-gray-700 mb-2">
                        IA que identifica patrones en tus errores y aciertos para predecir qué tipo de preguntas necesitas practicar más.
                      </p>
                      <p className="text-sm text-purple-600">🎯 Precisión del 94% en predicciones de rendimiento</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">📊 Resultados comprobados</h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600 mb-2">2.4x</div>
                      <p className="text-sm text-gray-700">Más probabilidades de aprobar vs. estudio tradicional</p>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600 mb-2">65%</div>
                      <p className="text-sm text-gray-700">Reducción en tiempo de preparación</p>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-600 mb-2">89%</div>
                      <p className="text-sm text-gray-700">Usuarios que mejoran su puntuación</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CTA Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
                
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-bold mb-4">
                    🎓 Plan Auxiliar Administrativo del Estado
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Acceso Completo Premium
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Todo lo que necesitas para aprobar en 2026
                  </p>
                </div>

                {/* Pricing */}
                <div className="text-center mb-6">
                  <div className="mb-3">
                    <span className="text-4xl font-bold text-gray-900">€59</span>
                    <span className="text-gray-600 ml-2">6 meses completos</span>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <p className="text-green-800 font-bold text-sm">✅ Incluye 7 días de prueba gratuita</p>
                    <p className="text-green-700 text-xs">Acceso completo por 6 meses</p>
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-3 mb-8">
                  {[
                    "🎯 Exclusivo Auxiliar Administrativo del Estado",
                    "🤖 IA personalizada con análisis predictivo",
                    "📚 16 temas legislativos completos verificados",
                    "⚡ Tests ilimitados 24/7",
                    "📈 Analytics avanzados en tiempo real",
                    "🎯 Simulacros exactos de convocatoria",
                    "💬 Soporte prioritario",
                    "📱 Acceso multiplataforma"
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center text-sm">
                      <span className="mr-2">{feature.split(' ')[0]}</span>
                      <span className="text-gray-700">{feature.split(' ').slice(1).join(' ')}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <button
                  onClick={handleStartTrial}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 mb-4"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Configurando acceso...
                    </div>
                  ) : (
                    <>
                      🚀 Comenzar prueba gratuita
                      <div className="text-sm font-normal mt-1">7 días gratis • Después €19/mes</div>
                    </>
                  )}
                </button>

                {/* Trust Signals */}
                <div className="space-y-3 text-center">
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                    <span>🔒</span>
                    <span>Pago seguro con Stripe</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                    <span>✅</span>
                    <span>Cancela en cualquier momento</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                    <span>🛡️</span>
                    <span>Garantía de satisfacción</span>
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
                    <div className="flex items-center">
                      <span className="mr-2">⚠️</span>
                      <span>{error}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Trust Section */}
        <div className="mt-16 bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              16 Temas Legislativos Completos
            </h3>
            <p className="text-gray-600">
              Domina todos los temas de la parte legislativa de las oposiciones de Auxiliar Administrativo del Estado
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6 text-center">
            <div className="p-4">
              <div className="text-2xl font-bold text-blue-600 mb-2">16 Temas</div>
              <p className="text-sm text-gray-600">Parte legislativa completa</p>
            </div>
            <div className="p-4">
              <div className="text-2xl font-bold text-green-600 mb-2">Oficial</div>
              <p className="text-sm text-gray-600">Temario oficial del Estado</p>
            </div>
            <div className="p-4">
              <div className="text-2xl font-bold text-purple-600 mb-2">Actualizado</div>
              <p className="text-sm text-gray-600">Normativa vigente 2026</p>
            </div>
            <div className="p-4">
              <div className="text-2xl font-bold text-orange-600 mb-2">Completo</div>
              <p className="text-sm text-gray-600">Todo lo que necesitas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PremiumEducationalLanding() {
  return <PremiumEducationalContent />
}