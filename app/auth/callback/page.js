// app/auth/callback/page.js - VERSION SIMPLIFICADA SIN PROBLEMAS DE SCOPE
'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import { useGoogleAds } from '../../../utils/googleAds'
import { getMetaParams, isFromMeta, trackMetaRegistration, isFromGoogle, getGoogleParams } from '../../../lib/metaPixelCapture'

// Helper: esperar N ms
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

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
        console.log('🔐 [CALLBACK] Procesando callback de autenticación...')
        setStatus('loading')
        setMessage('Verificando tu cuenta de Google...')
        
        const supabase = getSupabaseClient()
        
        if (!supabase) {
          throw new Error('No se pudo obtener cliente de Supabase')
        }
        
        // 🎯 DETERMINAR URL DE RETORNO
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

        // Estrategia: Supabase con detectSessionInUrl:true auto-intercambia el ?code=
        // Durante ese proceso, getSession() se BLOQUEA esperando el lock interno.
        // Usamos onAuthStateChange que se dispara sin bloquearse cuando la sesión está lista.
        console.log('🔍 [CALLBACK] Esperando sesión via onAuthStateChange...')

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
              reject(new Error('Timeout: sesión no establecida en 10s'))
            }
          }, 10000)

          let subscription = null

          // onAuthStateChange emite INITIAL_SESSION (async) cuando la sesión se resuelve
          // y SIGNED_IN cuando el code exchange completa
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
        setMessage('¡Autenticación exitosa!')

        // SAFETY NET: redirect garantizado en 3s incluso si processAuthenticatedUser se cuelga
        const safetySep = finalReturnUrl.includes('?') ? '&' : '?'
        const safetyUrl = `${finalReturnUrl}${safetySep}auth=success&t=${Date.now()}`
        const safetyTimer = setTimeout(() => {
          console.warn('⚠️ [CALLBACK] Safety redirect: profile processing tardó >3s')
          window.location.href = safetyUrl
        }, 3000)

        try {
          await processAuthenticatedUser(session.user, finalReturnUrl, supabase)
        } catch(e) {
          console.warn('⚠️ [CALLBACK] Profile processing error:', e.message)
          // Safety timer se encarga del redirect
        }
        // Si processAuthenticatedUser completó, su redirect interno ya se activó
        // El safetyTimer se cancelará cuando el navegador navegue a la nueva URL

      } catch (error) {
        console.error('❌ [CALLBACK] Error procesando callback:', error)
        setStatus('error')
        setMessage(`Error: ${error.message}`)
        
        // NO REDIRECT - Mantener en página para debug
        console.log('🔍 [DEBUG] Información completa del error:', {
          errorMessage: error.message,
          errorStack: error.stack,
          returnUrl,
          currentUrl: window.location.href,
          urlParams: Object.fromEntries(new URLSearchParams(window.location.search)),
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        })
      }
    }
    
    // 🔧 FUNCIÓN PROCESADORA SIMPLIFICADA
    const processAuthenticatedUser = async (user, finalReturnUrl, supabase) => {
      try {
        console.log('✅ [CALLBACK] Procesando usuario autenticado:', user.email)
        setMessage('Configurando tu perfil...')

        const userId = user.id
        const userEmail = user.email

        // Helper: query con timeout (evitar cuelgues del lock interno de Supabase)
        const queryWithTimeout = (promise, ms = 2000) =>
          Promise.race([promise, wait(ms).then(() => ({ data: null, error: { message: 'timeout' } }))])

        // Detección de usuario nuevo (con timeout para no colgarse)
        let isNewUser = false
        try {
          const { data: existingWelcomeEmails } = await queryWithTimeout(
            supabase.from('email_logs').select('id').eq('user_id', userId).eq('email_type', 'bienvenida_inmediato').limit(1)
          )
          if (!existingWelcomeEmails || existingWelcomeEmails.length === 0) {
            isNewUser = true
          }
        } catch(e) {
          console.warn('⚠️ [CALLBACK] email_logs check failed, asumiendo usuario existente')
        }

        console.log('🎯 [CALLBACK] Detección usuario nuevo:', { userId, isNewUser })
        
        // 🎯 DETECTAR OPOSICIÓN OBJETIVO (desde modal de PDF o URL)
        const oposicionParam = searchParams.get('oposicion')
        console.log('🎯 [CALLBACK] Oposición detectada:', oposicionParam || 'ninguna')

        // 🎯 DETECTAR FUNNEL DE REGISTRO (test, temario_pdf, etc.)
        const funnelParam = searchParams.get('funnel')
        console.log('📋 [CALLBACK] Funnel de registro:', funnelParam || 'ninguno')

        // 🎯 DETECTAR ORIGEN (Google Ads o Meta)
        // Método 1: URL contiene parámetros especiales de landing page premium
        const isGoogleAdsFromUrl = finalReturnUrl.includes('/premium-ads') ||
                                   finalReturnUrl.includes('start_checkout=true')

        // Método 2: Detectar por gclid o utm_source=google (capturado en cookies/sessionStorage)
        const googleParams = getGoogleParams()
        const isGoogleAdsFromParams = isFromGoogle()

        // Combinar ambos métodos
        const isGoogleAds = isGoogleAdsFromUrl || isGoogleAdsFromParams

        // 🎯 DETECTAR META (Facebook/Instagram)
        const metaParams = getMetaParams()
        const isMetaAds = isFromMeta()

        console.log('🔍 [CALLBACK] Análisis origen:', {
          finalReturnUrl,
          isGoogleAds,
          isGoogleAdsFromUrl,
          isGoogleAdsFromParams,
          googleParams: googleParams ? {
            gclid: googleParams.gclid?.slice(0, 10) + '...',
            utm_source: googleParams.utm_source
          } : null,
          isMetaAds,
          metaParams: metaParams ? {
            fbclid: metaParams.fbclid?.slice(0, 10) + '...',
            utm_source: metaParams.utm_source
          } : null
        })
        
        // Verificar si perfil ya existe (con timeout)
        const { data: existingProfile } = await queryWithTimeout(
          supabase.from('user_profiles').select('id, plan_type, registration_source, registration_url, registration_funnel').eq('id', userId).single()
        )

        if (existingProfile) {
          // 🛡️ PERFIL EXISTE - Solo actualizar campos NO sensibles
          console.log('✅ [CALLBACK] Perfil ya existe, preservando plan_type:', existingProfile.plan_type)

          // 🔧 FIX: Si el perfil es 'organic' pero detectamos Google/Meta Ads, actualizar registration_source
          let updateData = {
            full_name: user.user_metadata?.full_name || userEmail?.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url,
            updated_at: new Date().toISOString()
          }

          // Solo actualizar registration_source si el actual es 'organic' o null
          const canUpdateSource = !existingProfile.registration_source || existingProfile.registration_source === 'organic'

          if (canUpdateSource && isGoogleAdsFromParams) {
            updateData.registration_source = 'google_ads'
            console.log('🔄 [CALLBACK] Actualizando registration_source de organic → google_ads')
          } else if (canUpdateSource && isMetaAds) {
            updateData.registration_source = 'meta'
            console.log('🔄 [CALLBACK] Actualizando registration_source de organic → meta')
          }

          // 🆕 Guardar registration_url si no está guardada (perfil creado por trigger)
          if (!existingProfile.registration_url && finalReturnUrl) {
            updateData.registration_url = finalReturnUrl
            console.log('📍 [CALLBACK] Guardando registration_url:', finalReturnUrl)
          }

          // 🆕 Guardar registration_funnel si no está guardado
          if (!existingProfile.registration_funnel) {
            if (funnelParam) {
              updateData.registration_funnel = funnelParam
              console.log('📋 [CALLBACK] Guardando registration_funnel:', funnelParam)
            } else if (oposicionParam) {
              updateData.registration_funnel = 'temario_pdf'
              console.log('📋 [CALLBACK] Guardando registration_funnel inferido: temario_pdf')
            }
          }

          const { error: updateError } = await queryWithTimeout(
            supabase.from('user_profiles').update(updateData).eq('id', userId)
          )

          if (updateError) {
            console.warn('⚠️ [CALLBACK] Error actualizando perfil:', updateError.message)
          } else {
            console.log('✅ [CALLBACK] Perfil actualizado')
          }
        } else {
          // 🆕 PERFIL NO EXISTE - Crear nuevo
          console.log('🆕 [CALLBACK] Perfil no existe, creando nuevo...')

          // Configurar plan según origen
          let planType = 'free'
          let registrationSource = 'organic'
          let requiresPayment = false

          if (isGoogleAdsFromUrl) {
            // Landing page premium de Google Ads → requiere pago
            planType = 'premium_required'
            registrationSource = 'google_ads'
            requiresPayment = true
            console.log('🎯 [CALLBACK] Usuario identificado como Google Ads PREMIUM (landing page)')
          } else if (isGoogleAdsFromParams) {
            // Google Ads normal (gclid o utm_source=google) → plan free pero trackear origen
            registrationSource = 'google_ads'
            console.log('🎯 [CALLBACK] Usuario identificado como Google Ads (UTM/gclid)')
          } else if (isMetaAds) {
            registrationSource = 'meta'
            console.log('🎯 [CALLBACK] Usuario identificado como Meta Ads (Facebook/Instagram)')
          }

          // Crear nuevo perfil
          const newProfileData = {
            id: userId,
            email: userEmail,
            full_name: user.user_metadata?.full_name || userEmail?.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url,
            preferred_language: 'es',
            plan_type: planType,
            registration_source: registrationSource,
            requires_payment: requiresPayment,
            updated_at: new Date().toISOString()
          }

          // Añadir oposición objetivo si viene del modal de PDF
          if (oposicionParam) {
            newProfileData.target_oposicion = oposicionParam
            console.log('📋 [CALLBACK] Guardando oposición objetivo:', oposicionParam)
          }

          // Añadir funnel de registro si se especifica (test, temario_pdf, etc.)
          if (funnelParam) {
            newProfileData.registration_funnel = funnelParam
            console.log('📋 [CALLBACK] Funnel de registro:', funnelParam)
          } else if (oposicionParam) {
            // Si hay oposición pero no funnel, asumimos que viene del temario PDF
            newProfileData.registration_funnel = 'temario_pdf'
            console.log('📋 [CALLBACK] Funnel de registro inferido: temario_pdf')
          }

          // 🆕 Guardar URL exacta desde donde se registró
          if (finalReturnUrl) {
            newProfileData.registration_url = finalReturnUrl
            console.log('📍 [CALLBACK] URL de registro:', finalReturnUrl)
          }

          const { error: profileError } = await queryWithTimeout(
            supabase.from('user_profiles').insert(newProfileData),
            3000
          )

          if (profileError) {
            console.warn('⚠️ [CALLBACK] Error creando perfil:', profileError.message)
          } else {
            console.log('✅ [CALLBACK] Perfil creado exitosamente')
          }
        }
        
        // Trackear registro
        if (isGoogleAds) {
          console.log('🎯 [GOOGLE ADS] Trackeando registro de usuario Google Ads...')
          events.SIGNUP('google_ads')
        } else if (isMetaAds) {
          console.log('🎯 [META ADS] Trackeando registro de usuario Meta Ads...')
          events.SIGNUP('meta')
          // Enviar evento a Meta Conversions API
          try {
            const metaResult = await trackMetaRegistration(userId, userEmail)
            if (metaResult?.success) {
              console.log('✅ [META CAPI] Evento CompleteRegistration enviado:', metaResult.eventId)
            } else {
              console.warn('⚠️ [META CAPI] Error enviando evento:', metaResult?.error)
            }
          } catch (metaError) {
            console.warn('⚠️ [META CAPI] Excepción enviando evento:', metaError)
          }
        } else {
          console.log('🎯 [ORGANIC] Trackeando registro orgánico...')
          events.SIGNUP('google')
        }
        
        // Enviar email de bienvenida para nuevos usuarios
        if (isNewUser) {
          console.log('🎉 [CALLBACK] ¡Usuario nuevo detectado! Enviando email de bienvenida...')
          setMessage('¡Bienvenido! Enviando email de confirmación...')
          
          try {
            const welcomeResponse = await fetch('/api/emails/send-welcome-immediate', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              },
              body: JSON.stringify({ 
                userId: userId
              })
            })
            
            const welcomeResult = await welcomeResponse.json()
            
            if (welcomeResult.success) {
              console.log('✅ [CALLBACK] Email de bienvenida enviado exitosamente:', welcomeResult)
            } else {
              console.warn('⚠️ [CALLBACK] Error enviando email de bienvenida:', welcomeResult.error)
            }
          } catch (emailError) {
            console.warn('⚠️ [CALLBACK] Excepción enviando email de bienvenida:', emailError)
          }

          // NOTA: Los emails de nuevos usuarios se envían en resumen diario (21:00)
          // Ver: /api/cron/daily-registration-summary
          console.log('📝 [CALLBACK] Nuevo usuario registrado - se incluirá en resumen diario')

          // Guardar IP de registro para detectar multicuentas
          try {
            await fetch('/api/auth/store-registration-ip', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId })
            })
            console.log('📍 [CALLBACK] IP de registro guardada')
          } catch (ipError) {
            console.warn('⚠️ [CALLBACK] Error guardando IP:', ipError)
          }
        }
        
        // 🔄 DETECTAR TEST PENDIENTE EN LOCALSTORAGE
        let redirectUrl = finalReturnUrl
        const PENDING_TEST_KEY = 'vence_pending_test'

        try {
          const pendingTestStr = localStorage.getItem(PENDING_TEST_KEY)
          if (pendingTestStr) {
            const pendingTest = JSON.parse(pendingTestStr)
            // Verificar que no sea muy antiguo (máx 1 hora)
            const age = Date.now() - pendingTest.savedAt
            if (age < 60 * 60 * 1000 && pendingTest.answeredQuestions?.length > 0) {
              console.log('🎯 [CALLBACK] ¡Test pendiente detectado!', {
                preguntas: pendingTest.answeredQuestions.length,
                tema: pendingTest.tema,
                edad: Math.round(age / 1000 / 60) + ' minutos'
              })
              // Redirigir a página de recuperación de test
              redirectUrl = '/test-recuperado'
              setMessage('¡Encontramos tu test! Guardando tu progreso...')
            } else {
              // Test muy antiguo o sin respuestas, limpiar
              localStorage.removeItem(PENDING_TEST_KEY)
              console.log('🗑️ [CALLBACK] Test pendiente descartado (muy antiguo o vacío)')
            }
          }
        } catch (e) {
          console.warn('⚠️ [CALLBACK] Error procesando test pendiente:', e)
        }

        // Preparar redirección
        console.log('🔄 [CALLBACK] Preparando redirección a:', redirectUrl)
        setMessage(redirectUrl === '/test-recuperado'
          ? '¡Encontramos tu test! Guardando tu progreso...'
          : 'Redirigiendo de vuelta al test...')

        // Disparar eventos globales
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('supabaseAuthSuccess', {
            detail: { 
              user: user,
              session: { user },
              returnUrl: finalReturnUrl
            }
          }))
          
          window.dispatchEvent(new CustomEvent('supabaseAuthChange', {
            detail: { 
              event: 'SIGNED_IN',
              user: user,
              session: { user }
            }
          }))
        }
        
        // REDIRECCIÓN - usar window.location.href (router.push no funciona en async/setTimeout)
        const delay = redirectUrl.includes('/premium-ads') ? 1000 : 200

        console.log('⏰ [CALLBACK] Configurando redirección con delay:', delay, 'ms')

        setTimeout(() => {
          const separator = redirectUrl.includes('?') ? '&' : '?'
          const urlWithSuccess = `${redirectUrl}${separator}auth=success&t=${Date.now()}`

          console.log('🔄 [CALLBACK] Redirigiendo finalmente a:', urlWithSuccess)
          window.location.href = urlWithSuccess
        }, delay)
        
      } catch (profileErr) {
        console.error('❌ [CALLBACK] Error configurando perfil:', profileErr)
        throw profileErr
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
              🔐 Iniciando sesión...
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                ✅ Autenticación con Google en proceso...<br/>
                🔄 Preparando tu sesión...<br/>
                {returnUrl && returnUrl.includes('/premium-ads') && (
                  <span className="text-green-600 font-bold">
                    🎯 Configurando acceso premium...
                  </span>
                )}
                {returnUrl && (
                  <span className="text-xs block mt-1">
                    📍 Volverás a: {returnUrl.length > 50 ? returnUrl.substring(0, 50) + '...' : returnUrl}
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
              ¡Sesión iniciada!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
              <p className="text-sm text-green-700 dark:text-green-400">
                ✅ Tu cuenta está configurada<br/>
                🔄 Volviendo al test...<br/>
                {returnUrl && returnUrl.includes('/premium-ads') && (
                  <span className="text-blue-600 font-bold">
                    🚀 Preparando checkout premium...
                  </span>
                )}
                {returnUrl && (
                  <span className="text-xs block mt-1">
                    📍 Destino: {returnUrl.length > 50 ? returnUrl.substring(0, 50) + '...' : returnUrl}
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
              Error de Autenticación
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-700 dark:text-red-400">
                Hubo un problema al procesar tu inicio de sesión.<br/>
                Puede deberse a una conexión inestable.
              </p>
            </div>

            {/* 🆕 Botón de reintentar */}
            <button
              onClick={() => {
                console.log('🔄 [MANUAL] Reintentando autenticación...')
                setStatus('loading')
                setMessage('Reintentando...')
                // Recargar la página para reintentar el callback
                window.location.reload()
              }}
              className="mb-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              🔄 Reintentar
            </button>

            {process.env.NODE_ENV === 'development' && (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mt-4">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  🔍 <strong>Debug Info:</strong><br/>
                  {returnUrl && <>📍 Return URL: {returnUrl}<br/></>}
                  🌐 Current URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}
                </p>
              </div>
            )}
          </>
        )}
        
        {/* BOTÓN MANUAL */}
        <div className="mt-6">
          <button
            onClick={() => {
              const finalUrl = returnUrl || '/auxiliar-administrativo-estado'
              console.log('🔄 [MANUAL] Redirección manual a:', finalUrl)
              router.push(finalUrl)
            }}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-sm transition-colors"
          >
            ← Volver al test manualmente
          </button>
        </div>

        {/* DEBUG INFO */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <strong>🔍 Debug Auth Callback:</strong><br/>
              Status: {status}<br/>
              Return URL: {returnUrl || 'none'}<br/>
              Is Google Ads: {returnUrl?.includes('/premium-ads') ? 'YES' : 'NO'}<br/>
              Is Meta Ads: {typeof window !== 'undefined' && isFromMeta() ? 'YES' : 'NO'}
            </p>
          </div>
        )}
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
            🔐 Cargando autenticación...
          </h2>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}