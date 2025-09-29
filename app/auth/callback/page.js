// app/auth/callback/page.js - VERSION SIMPLIFICADA SIN PROBLEMAS DE SCOPE
'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import { useGoogleAds } from '../../../utils/googleAds'

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
        
        if (sessionError) {
          console.error('❌ [CALLBACK] Error obteniendo sesión:', sessionError)
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
          
          if (code) {
            console.log('🔍 [CALLBACK] Procesando código OAuth...')
            setMessage('Procesando código de autorización...')
            
            try {
              const { data, error } = await supabase.auth.exchangeCodeForSession(code)
              
              if (error) {
                console.error('❌ [CALLBACK] Error intercambiando código:', error)
                throw error
              }
              
              if (data.session && data.session.user) {
                console.log('✅ [CALLBACK] Sesión establecida desde código OAuth')
                await processAuthenticatedUser(data.session.user, finalReturnUrl, supabase)
                return
              }
            } catch (codeError) {
              console.error('❌ [CALLBACK] Error procesando código OAuth:', codeError)
            }
          }
        }
        
        throw new Error('No se pudo establecer la sesión de usuario')
        
      } catch (error) {
        console.error('❌ [CALLBACK] Error procesando callback:', error)
        setStatus('error')
        setMessage(`Error: ${error.message}`)
        
        const errorReturnUrl = returnUrl || '/auxiliar-administrativo-estado'
        setTimeout(() => {
          const separator = errorReturnUrl.includes('?') ? '&' : '?'
          const errorUrl = `${errorReturnUrl}${separator}auth_error=${encodeURIComponent(error.message)}`
          console.log('🔄 [CALLBACK] Redirigiendo con error a:', errorUrl)
          router.push(errorUrl)
        }, 3000)
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
        
        // 🎯 DETECTAR GOOGLE ADS SIMPLIFICADO
        const isGoogleAds = finalReturnUrl.includes('/premium-ads') || 
                           finalReturnUrl.includes('campaign=') ||
                           finalReturnUrl.includes('start_checkout=true')
        
        console.log('🔍 [CALLBACK] Análisis origen SIMPLIFICADO:', {
          finalReturnUrl,
          isGoogleAds
        })
        
        // Configurar plan según origen
        let planType = 'free'
        let registrationSource = 'organic'
        let requiresPayment = false
        
        if (isGoogleAds) {
          planType = 'premium_required'
          registrationSource = 'google_ads'
          requiresPayment = true
          console.log('🎯 [CALLBACK] Usuario identificado como Google Ads')
        }
        
        // Crear/actualizar perfil
        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert({
            id: userId,
            email: userEmail,
            full_name: user.user_metadata?.full_name || userEmail?.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url,
            preferred_language: 'es',
            plan_type: planType,
            registration_source: registrationSource,
            requires_payment: requiresPayment,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })
        
        if (profileError) {
          console.error('❌ [CALLBACK] Error creando perfil:', profileError)
          throw profileError
        }
        
        console.log('✅ [CALLBACK] Perfil actualizado exitosamente')
        console.log('🎯 [CALLBACK] Configuración aplicada:', {
          planType,
          registrationSource,
          requiresPayment,
          isGoogleAds
        })
        
        // Trackear registro
        if (isGoogleAds) {
          console.log('🎯 [GOOGLE ADS] Trackeando registro de usuario Google Ads...')
          events.SIGNUP('google_ads')
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

          // Enviar notificación admin de nuevo usuario
          try {
            const { sendAdminNewUserNotification } = await import('../../../lib/notifications/adminEmailNotifications')
            await sendAdminNewUserNotification({
              id: userId,
              email: userEmail,
              user_metadata: user.user_metadata,
              app_metadata: { provider: 'google' },
              created_at: new Date().toISOString()
            })
            console.log('✅ [CALLBACK] Notificación admin enviada para nuevo usuario')
          } catch (adminEmailError) {
            console.error('❌ [CALLBACK] Error enviando notificación admin:', adminEmailError)
            // No fallar el registro por esto
          }
        }
        
        // Preparar redirección
        console.log('🔄 [CALLBACK] Preparando redirección a:', finalReturnUrl)
        setMessage('Redirigiendo de vuelta al test...')
        
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
        const delay = finalReturnUrl.includes('/premium-ads') ? 1500 : 1000
        
        console.log('⏰ [CALLBACK] Configurando redirección con delay:', delay, 'ms')
        
        setTimeout(() => {
          const separator = finalReturnUrl.includes('?') ? '&' : '?'
          const urlWithSuccess = `${finalReturnUrl}${separator}auth=success&t=${Date.now()}`
          
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
            <div className="text-6xl mb-6">😟</div>
            <h2 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-3">
              Error de Autenticación
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-700 dark:text-red-400">
                Redirigiendo automáticamente en 3 segundos...<br/>
                {returnUrl && (
                  <span className="text-xs">
                    📍 Destino: {returnUrl}
                  </span>
                )}
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
              <strong>🔍 Debug Auth Callback SIMPLIFICADO:</strong><br/>
              Status: {status}<br/>
              Return URL: {returnUrl || 'none'}<br/>
              Is Google Ads: {returnUrl?.includes('/premium-ads') ? 'YES' : 'NO'}<br/>
              <strong>🎯 Sin problemas de scope</strong>
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