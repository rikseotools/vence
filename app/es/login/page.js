// app/es/login/page.js - OPTIMIZADO PARA MÓVIL Y MODO DARK
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../contexts/AuthContext'
import { detectCampaignSource, shouldForceCheckout, forceCampaignCheckout } from '../../../lib/campaignTracker'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const { user, loading: authLoading, supabase } = useAuth()
  
  // URL de retorno después del login
  const returnTo = searchParams.get('return_to') || '/es/auxiliar-administrativo-estado'

  useEffect(() => {
    if (authLoading) return
    
    if (user) {
      console.log('✅ Usuario ya autenticado')
      
      // 🆕 VERIFICAR SI DEBE FORZAR CHECKOUT ANTES DE REDIRIGIR
      if (shouldForceCheckout(user, supabase)) {
        console.log('💰 Usuario ya logueado - forzando checkout por cookies de campaña')
        setLoading(true)
        forceCampaignCheckout(user, supabase).catch(err => {
          console.error('❌ Error forzando checkout:', err)
          setError('Error procesando pago. Intenta de nuevo.')
          setLoading(false)
        })
        return // No redirigir, va directo a Stripe
      }
      
      // Si no hay campaña, redirigir normalmente
      console.log('🔄 Redirigiendo a:', returnTo)
      router.push(returnTo)
    }
  }, [user, authLoading, router, returnTo, supabase])

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      setError('')
      console.log('🔄 Iniciando login con Google...')
      
      // 🆕 DETECTAR SI VIENE DE CAMPAÑA PUBLICITARIA
      const campaignInfo = detectCampaignSource()
      let redirectUrl = `${window.location.origin}/auth/callback?return_to=${encodeURIComponent(returnTo)}`
      
      if (campaignInfo) {
        console.log('🎯 Usuario detectado de campaña:', campaignInfo)
        // Añadir información completa de campaña al callback URL
        redirectUrl += `&campaign_source=${encodeURIComponent(campaignInfo.source)}`
        redirectUrl += `&campaign_landing=${encodeURIComponent(campaignInfo.landing)}`
        redirectUrl += `&campaign_utm_source=${encodeURIComponent(campaignInfo.utm_source)}`
        redirectUrl += `&campaign_utm_campaign=${encodeURIComponent(campaignInfo.utm_campaign)}`
        
        if (campaignInfo.fbclid) {
          redirectUrl += `&campaign_fbclid=${encodeURIComponent(campaignInfo.fbclid)}`
        }
        if (campaignInfo.gclid) {
          redirectUrl += `&campaign_gclid=${encodeURIComponent(campaignInfo.gclid)}`
        }
      }
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
            include_granted_scopes: 'true',
            scope: 'openid email profile'
          }
        }
      })
      
      if (error) throw error
      
    } catch (error) {
      console.error('❌ Error en login:', error)
      setError('Error al conectar con Google. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // Loading mientras se verifica auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Verificando sesión...</h1>
          <p className="text-gray-600 dark:text-gray-400">Conectando con el sistema...</p>
        </div>
      </div>
    )
  }

  // Si ya está autenticado, mostrar mensaje compacto
  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">¡Ya estás conectado!</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
            Bienvenido, <strong>{user.email}</strong>
          </p>
          <div className="space-y-2">
            <Link
              href={returnTo}
              className="block w-full bg-blue-600 dark:bg-blue-500 text-white py-2.5 px-4 rounded-lg font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm"
            >
              Continuar donde lo dejé
            </Link>
            <Link
              href="/es/auxiliar-administrativo-estado"
              className="block w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2.5 px-4 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
            >
              Ir al inicio
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-sm w-full overflow-hidden">
        
        {/* Header compacto */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white p-6 text-center">
          <div className="text-3xl mb-2">🚀</div>
          <h1 className="text-xl font-bold mb-1">¡Bienvenido!</h1>
          <p className="text-blue-100 dark:text-blue-200 text-xs">
            Accede para continuar estudiando
          </p>
        </div>

        {/* Content compacto */}
        <div className="p-6">
          
          {/* Error message */}
          {error && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg mb-4">
              <div className="flex items-center">
                <span className="text-lg mr-2">⚠️</span>
                <span className="text-xs">{error}</span>
              </div>
            </div>
          )}

          {/* Benefits compactos */}
          <div className="mb-5">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3 text-center text-sm">
              🎯 Con tu cuenta:
            </h3>
            <ul className="space-y-1.5 text-xs">
              {[
                "📊 Progreso guardado permanentemente",
                "🎯 Recomendaciones personalizadas", 
                "📈 Analytics detallados",
                "⚡ Tests ilimitados 24/7"
              ].map((benefit, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2 mt-0.5 text-green-600 dark:text-green-400 text-xs">✅</span>
                  <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Login button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className={`w-full text-white py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center space-x-2 shadow-lg ${
              loading 
                ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 hover:opacity-90 hover:shadow-xl transform hover:scale-[1.02]'
            }`}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                {/* Google Icon */}
                <div className="bg-white rounded-full p-1">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <span>Continuar con Google</span>
              </>
            )}
          </button>

          {/* Additional links compactos */}
          <div className="mt-4 text-center space-y-2">
            <Link
              href="/es/auxiliar-administrativo-estado"
              className="block text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-xs transition-colors"
            >
              ← Volver al inicio
            </Link>
            
            <div className="text-xs text-gray-500 dark:text-gray-500">
              🔒 Login 100% seguro con Google<br/>
              <span className="text-xs">No compartimos tu información</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}