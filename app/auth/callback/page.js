// app/auth/callback/page.js - VERSION SIMPLIFICADA SIN PROBLEMAS DE SCOPE
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
        
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Verificar sesión
        console.log('🔍 [CALLBACK] Verificando sesión...')
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        
        console.log('🔍 [DEBUG] Resultado de getSession:', {
          hasSession: !!sessionData?.session,
          hasUser: !!sessionData?.session?.user,
          userEmail: sessionData?.session?.user?.email,
          sessionError: sessionError?.message || null,
          sessionErrorCode: sessionError?.code || null
        })
        
        if (sessionError) {
          console.error('❌ [CALLBACK] Error obteniendo sesión:', sessionError)
          throw new Error(`Error de sesión: ${sessionError.message}`)
        }

        if (sessionData.session && sessionData.session.user) {
          console.log('✅ [CALLBACK] Usuario autenticado:', sessionData.session.user.email)
          await processAuthenticatedUser(sessionData.session.user, finalReturnUrl, supabase)
          return
        }
        
        // Método alternativo: intercambiar código OAuth
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search)
          const code = urlParams.get('code')
          const error_param = urlParams.get('error')
          const error_description = urlParams.get('error_description')
          
          console.log('🔍 [DEBUG] Parámetros de URL:', {
            hasCode: !!code,
            codeLength: code?.length || 0,
            hasError: !!error_param,
            error: error_param,
            errorDescription: error_description,
            fullURL: window.location.href
          })
          
          if (error_param) {
            throw new Error(`OAuth Error: ${error_param} - ${error_description}`)
          }
          
          if (code) {
            console.log('🔍 [CALLBACK] Procesando código OAuth...')
            setMessage('Procesando código de autorización...')
            
            try {
              const { data, error } = await supabase.auth.exchangeCodeForSession(code)
              
              console.log('🔍 [DEBUG] Resultado de exchangeCodeForSession:', {
                hasData: !!data,
                hasSession: !!data?.session,
                hasUser: !!data?.session?.user,
                userEmail: data?.session?.user?.email,
                errorMessage: error?.message || null,
                errorCode: error?.code || null
              })
              
              if (error) {
                console.error('❌ [CALLBACK] Error intercambiando código:', error)
                throw new Error(`Error intercambiando código: ${error.message}`)
              }
              
              if (data.session && data.session.user) {
                console.log('✅ [CALLBACK] Sesión establecida desde código OAuth')
                await processAuthenticatedUser(data.session.user, finalReturnUrl, supabase)
                return
              } else {
                console.error('❌ [CALLBACK] exchangeCodeForSession no devolvió sesión válida')
                throw new Error('exchangeCodeForSession no devolvió sesión válida')
              }
            } catch (codeError) {
              console.error('❌ [CALLBACK] Error procesando código OAuth:', codeError)
              throw codeError
            }
          } else {
            console.error('❌ [CALLBACK] No se encontró código OAuth en la URL')
            throw new Error('No se encontró código OAuth en la URL')
          }
        }
        
        throw new Error('No se pudo establecer la sesión de usuario')
        
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
        setStatus('success')
        setMessage('¡Autenticación exitosa!')
        
        console.log('📝 [CALLBACK] Actualizando perfil...')
        setMessage('Configurando tu perfil...')
        
        const userId = user.id
        const userEmail = user.email
        
        // 🆕 DETECCIÓN DE USUARIO NUEVO
        console.log('🔍 [CALLBACK] === INICIANDO DETECCIÓN DE USUARIO NUEVO ===')
        
        const { data: existingWelcomeEmails, error: emailCheckError } = await supabase
          .from('email_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('email_type', 'bienvenida_inmediato')
          .limit(1)

        let isNewUser = false
        if (!existingWelcomeEmails || existingWelcomeEmails.length === 0) {
          isNewUser = true
        }

        console.log('🎯 [CALLBACK] Detección usuario nuevo:', {
          userId,
          userEmail,
          isNewUser,
          emailCheckError: emailCheckError?.code
        })
        
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
        
        // 🔧 FIX: Verificar primero si el perfil ya existe para NO sobrescribir plan_type
        const { data: existingProfile, error: existingError } = await supabase
          .from('user_profiles')
          .select('id, plan_type, registration_source')
          .eq('id', userId)
          .single()

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

          const { error: updateError } = await supabase
            .from('user_profiles')
            .update(updateData)
            .eq('id', userId)

          if (updateError) {
            console.error('❌ [CALLBACK] Error actualizando perfil:', updateError)
            throw updateError
          }

          console.log('✅ [CALLBACK] Perfil actualizado (plan_type preservado:', existingProfile.plan_type, ')')
          console.log('🎯 [CALLBACK] Configuración final:', {
            planType: existingProfile.plan_type,
            registrationSource: updateData.registration_source || existingProfile.registration_source,
            isGoogleAds
          })
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
          const { error: profileError } = await supabase
            .from('user_profiles')
            .insert({
              id: userId,
              email: userEmail,
              full_name: user.user_metadata?.full_name || userEmail?.split('@')[0],
              avatar_url: user.user_metadata?.avatar_url,
              preferred_language: 'es',
              plan_type: planType,
              registration_source: registrationSource,
              requires_payment: requiresPayment,
              updated_at: new Date().toISOString()
            })

          if (profileError) {
            console.error('❌ [CALLBACK] Error creando perfil:', profileError)
            throw profileError
          }

          console.log('✅ [CALLBACK] Perfil creado exitosamente')
          console.log('🎯 [CALLBACK] Configuración aplicada:', {
            planType,
            registrationSource,
            requiresPayment,
            isGoogleAds
          })
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
        
        // REDIRECCIÓN SIMPLIFICADA - SIN VARIABLES EXTERNAS
        const delay = redirectUrl.includes('/premium-ads') ? 1500 : 1000

        console.log('⏰ [CALLBACK] Configurando redirección con delay:', delay, 'ms')

        setTimeout(() => {
          const separator = redirectUrl.includes('?') ? '&' : '?'
          const urlWithSuccess = `${redirectUrl}${separator}auth=success&t=${Date.now()}`

          console.log('🔄 [CALLBACK] Redirigiendo finalmente a:', urlWithSuccess)
          router.push(urlWithSuccess)
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
              🔐 Completando registro...
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                ✅ Autenticación con Google en proceso...<br/>
                🔄 Configurando tu cuenta...<br/>
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
              ¡Registro Exitoso!
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
            <div className="text-6xl mb-6">🔍</div>
            <h2 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-3">
              Debug Mode - Error de Autenticación
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-700 dark:text-red-400">
                🔍 <strong>MODO DEBUG ACTIVADO</strong><br/>
                ✅ Los logs detallados están en la consola del navegador<br/>
                📱 Abre las herramientas de desarrollador (F12) y ve a "Console"<br/>
                {returnUrl && (
                  <span className="text-xs block mt-2">
                    📍 Return URL: {returnUrl}
                  </span>
                )}
                <span className="text-xs block mt-2">
                  🌐 Current URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}
                </span>
              </p>
            </div>
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