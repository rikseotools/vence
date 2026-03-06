// app/auth/callback/page.js - Auth callback simplificado (v2: server-side processing)
'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import { useGoogleAds } from '../../../utils/googleAds'
import { getMetaParams, isFromMeta, trackMetaRegistration, isFromGoogle, getGoogleParams } from '../../../lib/metaPixelCapture'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('Verificando tu cuenta de Google...')
  const [returnUrl, setReturnUrl] = useState(null)

  const { events } = useGoogleAds()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔐 [CALLBACK] Procesando callback de autenticacion...')
        setStatus('loading')
        setMessage('Verificando tu cuenta de Google...')

        const supabase = getSupabaseClient()

        if (!supabase) {
          throw new Error('No se pudo obtener cliente de Supabase')
        }

        // 1. Determinar URL de retorno
        const determineReturnUrl = () => {
          let url = searchParams.get('return_to')
          if (url) {
            console.log('📍 [CALLBACK] URL de retorno desde query param:', url)
            return url
          }

          try {
            const backupUrl = localStorage.getItem('auth_return_url_backup')
            const timestamp = localStorage.getItem('auth_return_timestamp')

            if (backupUrl && timestamp) {
              const age = Date.now() - parseInt(timestamp)
              if (age < 10 * 60 * 1000) {
                console.log('📍 [CALLBACK] URL de retorno desde localStorage:', backupUrl)
                localStorage.removeItem('auth_return_url_backup')
                localStorage.removeItem('auth_return_timestamp')
                return backupUrl
              } else {
                localStorage.removeItem('auth_return_url_backup')
                localStorage.removeItem('auth_return_timestamp')
              }
            }
          } catch (e) {
            console.warn('⚠️ [CALLBACK] Error accediendo localStorage:', e)
          }

          const defaultUrl = '/auxiliar-administrativo-estado'
          console.log('📍 [CALLBACK] Usando URL por defecto:', defaultUrl)
          return defaultUrl
        }

        const finalReturnUrl = determineReturnUrl()
        setReturnUrl(finalReturnUrl)

        // Verificar si hay error OAuth en la URL
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search)
          const error_param = urlParams.get('error')
          if (error_param) {
            throw new Error(`OAuth Error: ${error_param} - ${urlParams.get('error_description')}`)
          }
        }

        // 2. Esperar sesion via onAuthStateChange (sin bloquearse por el lock PKCE)
        console.log('🔍 [CALLBACK] Esperando sesion via onAuthStateChange...')

        const session = await new Promise((resolve, reject) => {
          let resolved = false

          const done = (s) => {
            if (resolved) return
            resolved = true
            clearTimeout(timeout)
            try { subscription?.unsubscribe() } catch(e) {}
            resolve(s)
          }

          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true
              try { subscription?.unsubscribe() } catch(e) {}
              reject(new Error('Timeout: sesion no establecida en 10s'))
            }
          }, 10000)

          let subscription = null

          const { data } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔍 [CALLBACK] Auth event:', event, !!session?.user)
            if (session?.user) {
              done(session)
            }
          })
          subscription = data.subscription
        })

        console.log('✅ [CALLBACK] Usuario autenticado:', session.user.email)
        setStatus('success')
        setMessage('¡Autenticacion exitosa!')

        // 3. Detectar origen en cliente (cookies/sessionStorage)
        const isGoogleAdsFromUrl = finalReturnUrl.includes('/premium-ads') ||
                                   finalReturnUrl.includes('start_checkout=true')
        const googleParams = getGoogleParams()
        const isGoogleAdsFromParams = isFromGoogle()
        const isGoogleAds = isGoogleAdsFromUrl || isGoogleAdsFromParams
        const metaParams = getMetaParams()
        const isMetaAds = isFromMeta()

        const oposicionParam = searchParams.get('oposicion')
        const funnelParam = searchParams.get('funnel')

        console.log('🔍 [CALLBACK] Origen:', {
          isGoogleAds, isGoogleAdsFromUrl, isMetaAds,
          oposicion: oposicionParam, funnel: funnelParam,
        })

        // 4. Llamar API server-side (1 fetch — sin locks, instantaneo)
        setMessage('Configurando tu perfil...')
        let apiResult = { success: true, isNewUser: false, redirectUrl: finalReturnUrl }

        try {
          const response = await fetch('/api/v2/auth/process-callback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              userId: session.user.id,
              userEmail: session.user.email,
              fullName: session.user.user_metadata?.full_name || null,
              avatarUrl: session.user.user_metadata?.avatar_url || null,
              returnUrl: finalReturnUrl,
              oposicion: oposicionParam,
              funnel: funnelParam,
              isGoogleAds,
              isGoogleAdsFromUrl,
              isMetaAds,
              googleParams: googleParams || null,
              metaParams: metaParams || null,
            }),
          })
          apiResult = await response.json()
          console.log('✅ [CALLBACK] API result:', apiResult)
        } catch (apiError) {
          console.warn('⚠️ [CALLBACK] API error (continuando con redirect):', apiError)
        }

        // 5. Client-side tracking (necesitan browser/pixels)
        if (isGoogleAds) {
          events.SIGNUP('google_ads')
        } else if (isMetaAds) {
          events.SIGNUP('meta')
          try {
            const metaResult = await trackMetaRegistration(session.user.id, session.user.email)
            if (metaResult?.success) {
              console.log('✅ [META CAPI] Evento CompleteRegistration enviado:', metaResult.eventId)
            }
          } catch (metaError) {
            console.warn('⚠️ [META CAPI] Error:', metaError)
          }
        } else {
          events.SIGNUP('google')
        }

        // 6. Detectar test pendiente en localStorage
        let redirectUrl = apiResult.redirectUrl || finalReturnUrl
        const PENDING_TEST_KEY = 'vence_pending_test'

        try {
          const pendingTestStr = localStorage.getItem(PENDING_TEST_KEY)
          if (pendingTestStr) {
            const pendingTest = JSON.parse(pendingTestStr)
            const age = Date.now() - pendingTest.savedAt
            if (age < 60 * 60 * 1000 && pendingTest.answeredQuestions?.length > 0) {
              console.log('🎯 [CALLBACK] Test pendiente detectado:', {
                preguntas: pendingTest.answeredQuestions.length,
                tema: pendingTest.tema,
              })
              redirectUrl = '/test-recuperado'
              setMessage('¡Encontramos tu test! Guardando tu progreso...')
            } else {
              localStorage.removeItem(PENDING_TEST_KEY)
            }
          }
        } catch (e) {
          console.warn('⚠️ [CALLBACK] Error procesando test pendiente:', e)
        }

        // 7. Eventos globales
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('supabaseAuthSuccess', {
            detail: { user: session.user, session: { user: session.user }, returnUrl: finalReturnUrl }
          }))

          window.dispatchEvent(new CustomEvent('supabaseAuthChange', {
            detail: { event: 'SIGNED_IN', user: session.user, session: { user: session.user } }
          }))
        }

        // 8. Redirect
        setMessage(redirectUrl === '/test-recuperado'
          ? '¡Encontramos tu test! Guardando tu progreso...'
          : 'Redirigiendo de vuelta al test...')

        const delay = redirectUrl.includes('/premium-ads') ? 1000 : 200

        setTimeout(() => {
          const separator = redirectUrl.includes('?') ? '&' : '?'
          const urlWithSuccess = `${redirectUrl}${separator}auth=success&t=${Date.now()}`
          console.log('🔄 [CALLBACK] Redirigiendo a:', urlWithSuccess)
          window.location.href = urlWithSuccess
        }, delay)

      } catch (error) {
        console.error('❌ [CALLBACK] Error procesando callback:', error)
        setStatus('error')
        setMessage(`Error: ${error.message}`)
      }
    }

    handleAuthCallback()
  }, [router, searchParams, events])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">

        {/* LOADING STATE */}
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3">
              Iniciando sesion...
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Autenticacion con Google en proceso...<br/>
                Preparando tu sesion...<br/>
                {returnUrl && returnUrl.includes('/premium-ads') && (
                  <span className="text-green-600 font-bold">
                    Configurando acceso premium...
                  </span>
                )}
                {returnUrl && (
                  <span className="text-xs block mt-1">
                    Volverás a: {returnUrl.length > 50 ? returnUrl.substring(0, 50) + '...' : returnUrl}
                  </span>
                )}
              </p>
            </div>
          </>
        )}

        {/* SUCCESS STATE */}
        {status === 'success' && (
          <>
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-3">
              ¡Sesion iniciada!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
              <p className="text-sm text-green-700 dark:text-green-400">
                Tu cuenta esta configurada<br/>
                Volviendo al test...<br/>
                {returnUrl && returnUrl.includes('/premium-ads') && (
                  <span className="text-blue-600 font-bold">
                    Preparando checkout premium...
                  </span>
                )}
                {returnUrl && (
                  <span className="text-xs block mt-1">
                    Destino: {returnUrl.length > 50 ? returnUrl.substring(0, 50) + '...' : returnUrl}
                  </span>
                )}
              </p>
            </div>
          </>
        )}

        {/* ERROR STATE */}
        {status === 'error' && (
          <>
            <div className="text-6xl mb-6">⚠️</div>
            <h2 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-3">
              Error de Autenticacion
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-700 dark:text-red-400">
                Hubo un problema al procesar tu inicio de sesion.<br/>
                Puede deberse a una conexion inestable.
              </p>
            </div>

            <button
              onClick={() => {
                setStatus('loading')
                setMessage('Reintentando...')
                window.location.reload()
              }}
              className="mb-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Reintentar
            </button>
          </>
        )}

        {/* BOTON MANUAL */}
        <div className="mt-6">
          <button
            onClick={() => {
              const finalUrl = returnUrl || '/auxiliar-administrativo-estado'
              router.push(finalUrl)
            }}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-sm transition-colors"
          >
            ← Volver al test manualmente
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3">
            Cargando autenticacion...
          </h2>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}
