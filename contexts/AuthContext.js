// contexts/AuthContext.js - CONTEXTO GLOBAL CON SISTEMA DUAL
'use client'
import { createContext, useState, useEffect, useContext, useCallback } from 'react'

import { getSupabaseClient } from '../lib/supabase'
import notificationTracker from '../lib/services/notificationTracker'
import emailTracker from '../lib/services/emailTracker'
import { shouldForceCheckout, forceCampaignCheckout } from '../lib/campaignTracker'
import { GoogleAdsEvents } from '../utils/googleAds'
import { useSessionControl } from '../hooks/useSessionControl'
import SessionWarningModal from '../components/SessionWarningModal'

const AuthContext = createContext({})

// 🎯 TRACKING DE IP Y LOCALIDAD - Fire and forget, no bloquea UI
// También envía device_id si existe (para usuarios bajo vigilancia de fraude)
const trackSessionIP = (userId, sessionId = null) => {
  if (typeof window === 'undefined') return

  // Obtener device_id si existe (solo para usuarios vigilados)
  const deviceId = localStorage.getItem('vence_device_id') || null

  // Fire and forget - no await, no bloquea nada
  fetch('/api/auth/track-session-ip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, sessionId, deviceId })
  }).then(res => {
    if (res.ok) {
      console.log('📍 IP y localidad tracked en background', deviceId ? '(con device_id)' : '')
    }
  }).catch(err => {
    // Silencioso - no es crítico
    console.warn('⚠️ Error tracking IP (no crítico):', err.message)
  })
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}

export function AuthProvider({ children, initialUser = null }) {
  const [user, setUser] = useState(initialUser)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false) // ✨ Evita llamadas concurrentes
  
  const supabase = getSupabaseClient()

  // Configurar instancia de Supabase en los trackers
  useEffect(() => {
    if (supabase) {
      notificationTracker.setSupabaseInstance(supabase)
      emailTracker.setSupabaseInstance(supabase)
    }
  }, [supabase])

  // 🎯 NUEVA FUNCIÓN: Detectar fuente de registro
  const detectRegistrationSource = () => {
    if (typeof window === 'undefined') return 'organic'
    
    const currentPath = window.location.pathname
    const searchParams = new URLSearchParams(window.location.search)
    
    // 1. Detectar por URL de landing
    if (currentPath.includes('/premium-ads') || currentPath.includes('/premium-edu')) {
      console.log('🎯 Detectado: Usuario viene de Google Ads')
      return 'google_ads'
    }
    
    // 2. Detectar por parámetros UTM
    const utmSource = searchParams.get('utm_source')
    const utmMedium = searchParams.get('utm_medium') 
    const utmCampaign = searchParams.get('utm_campaign')
    const campaign = searchParams.get('campaign')
    const fbclid = searchParams.get('fbclid') // Facebook Click ID
    
    console.log('🏷️ DETECCIÓN DE FUENTE:', { utmSource, utmMedium, utmCampaign, campaign, fbclid })
    console.log('🌍 URL completa:', window.location.href)
    
    // Google Ads
    if (utmSource === 'google' && utmMedium === 'cpc') {
      console.log('🎯 Detectado: Usuario viene de Google Ads (UTM)')
      return 'google_ads'
    }
    
    // Meta/Facebook Ads - Detección ampliada
    if (fbclid || 
        utmSource === 'facebook' || 
        utmSource === 'instagram' || 
        utmSource === 'meta' ||
        (utmSource && utmSource.includes('fb')) || 
        (utmSource && utmSource.includes('meta')) ||
        (utmMedium && utmMedium.includes('facebook')) ||
        (utmMedium && utmMedium.includes('meta')) ||
        (utmMedium && utmMedium.includes('social')) ||
        (campaign && campaign.includes('meta')) ||
        (campaign && campaign.includes('facebook'))) {
      console.log('🎯 Detectado: Usuario viene de Meta/Facebook Ads', { utmSource, utmMedium, campaign })
      return 'meta_ads'
    }
    
    // Otras campañas de pago
    if (campaign && (campaign.includes('ads') || campaign.includes('google'))) {
      console.log('🎯 Detectado: Usuario viene de campaña de pago')
      return 'google_ads'
    }
    
    // 3. Verificar localStorage para return_to
    try {
      const returnUrl = localStorage.getItem('auth_return_url_backup')
      if (returnUrl && (returnUrl.includes('premium-ads') || returnUrl.includes('premium-edu'))) {
        console.log('🎯 Detectado: Usuario viene de Google Ads (localStorage)')
        return 'google_ads'
      }
    } catch (e) {
      console.warn('No se pudo acceder a localStorage')
    }
    
    console.log('🌐 Detectado: Usuario orgánico')
    return 'organic'
  }

  // 🎯 OPTIMIZADA: Cargar perfil con timeout, reintentos y mejor manejo
  const loadUserProfile = useCallback(async (userId, retryCount = 0) => {
    const MAX_RETRIES = 3

    // ✨ Evitar llamadas concurrentes
    if (profileLoading && retryCount === 0) {
      console.log('📄 Ya cargando perfil, esperando...')
      return userProfile
    }

    // Si ya tenemos el perfil del usuario correcto, no recargar
    if (userProfile && userProfile.id === userId && retryCount === 0) {
      console.log('✅ Perfil ya cargado para este usuario, reutilizando')
      return userProfile
    }

    if (retryCount === 0) {
      setProfileLoading(true)
    }

    try {
      console.log(`📄 Cargando perfil del usuario... ${retryCount > 0 ? `(intento ${retryCount + 1}/${MAX_RETRIES})` : ''}`, { userId })

      // 🔧 FIX: Timeout más largo para consultas lentas + AbortController
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 segundos

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .abortSignal(controller.signal)
        .single()

      clearTimeout(timeoutId)

      if (error) {
        // Si es abort/timeout, reintentar si no hemos excedido el límite
        if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
          if (retryCount < MAX_RETRIES - 1) {
            console.warn(`⏱️ Timeout en consulta de perfil, reintentando... (${retryCount + 1}/${MAX_RETRIES})`)
            const delay = 1000 * Math.pow(2, retryCount) // 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, delay))
            return loadUserProfile(userId, retryCount + 1)
          }
          console.warn('⏱️ Timeout en consulta de perfil (8s) tras reintentos, continuando sin perfil')
          setUserProfile(null)
          return null
        }

        // Si no existe el perfil, es normal
        if (error.code === 'PGRST116') {
          console.log('📝 Perfil no existe, será creado automáticamente')
          return null
        }

        // 🆕 Error de red: reintentar
        if (error.message?.includes('network') || error.message?.includes('fetch') || error.code === 'NETWORK_ERROR') {
          if (retryCount < MAX_RETRIES - 1) {
            console.warn(`🔄 Error de red cargando perfil, reintentando... (${retryCount + 1}/${MAX_RETRIES})`)
            const delay = 1000 * Math.pow(2, retryCount)
            await new Promise(resolve => setTimeout(resolve, delay))
            return loadUserProfile(userId, retryCount + 1)
          }
        }

        console.error('❌ Error cargando perfil:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          error: error
        })
        return null
      }

      if (profile) {
        console.log('✅ Perfil cargado:', profile.email, 'Tipo:', profile.plan_type)
        setUserProfile(profile)
        return profile
      }

      return null

    } catch (error) {
      console.error('❌ Error en loadUserProfile:', error)

      // 🆕 Reintentar en errores de red/timeout
      if (retryCount < MAX_RETRIES - 1 && (error.name === 'AbortError' || error.message?.includes('network') || error.message?.includes('fetch'))) {
        console.warn(`🔄 Reintentando loadUserProfile... (${retryCount + 1}/${MAX_RETRIES})`)
        const delay = 1000 * Math.pow(2, retryCount)
        await new Promise(resolve => setTimeout(resolve, delay))
        return loadUserProfile(userId, retryCount + 1)
      }

      // Si es abort/timeout final, continuar sin perfil
      if (error.name === 'AbortError') {
        console.warn('⏱️ Timeout en loadUserProfile tras reintentos, continuando...')
        setUserProfile(null)
      }

      return null
    } finally {
      if (retryCount === 0 || retryCount >= MAX_RETRIES - 1) {
        setProfileLoading(false)
      }
    }
  }, [supabase])

  // 🎯 NUEVA FUNCIÓN: Crear/actualizar perfil según fuente
  // 🔧 FIX: Verificar si el perfil ya existe ANTES de llamar RPCs para no resetear plan_type
  const ensureUserProfile = async (authUser) => {
    try {
      console.log('👤 Verificando perfil existente para:', authUser.email)

      // 🔧 PRIMERO: Verificar si el perfil ya existe en la BD
      const { data: existingProfile, error: checkError } = await supabase
        .from('user_profiles')
        .select('id, plan_type, registration_source')
        .eq('id', authUser.id)
        .single()

      if (existingProfile) {
        // El perfil ya existe - NO llamar a ningún RPC para no resetear plan_type
        console.log('✅ Perfil ya existe:', existingProfile.plan_type, '| Fuente:', existingProfile.registration_source)
        console.log('🛡️ Saltando RPCs para preservar plan_type actual')
        return await loadUserProfile(authUser.id)
      }

      // El perfil NO existe - crear nuevo
      console.log('🆕 Perfil no existe, creando nuevo...')

      const registrationSource = detectRegistrationSource()
      const campaignId = new URLSearchParams(window.location.search).get('campaign')

      console.log('📍 Fuente detectada:', registrationSource)

      if (registrationSource === 'google_ads') {
        // Usuario de Google Ads - requiere pago
        console.log('💰 Creando usuario Google Ads (requiere pago)')

        await supabase.rpc('create_google_ads_user', {
          user_id: authUser.id,
          user_email: authUser.email,
          user_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
          campaign_id: campaignId
        })

      } else if (registrationSource === 'meta_ads') {
        // Usuario de Meta/Facebook Ads - acceso gratis pero trackear fuente
        console.log('📘 Creando usuario Meta Ads (acceso gratis)')

        await supabase.rpc('create_meta_ads_user', {
          user_id: authUser.id,
          user_email: authUser.email,
          user_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0]
        })

      } else {
        // Usuario orgánico - acceso gratis
        console.log('🆓 Creando usuario orgánico (acceso gratis)')

        await supabase.rpc('create_organic_user', {
          user_id: authUser.id,
          user_email: authUser.email,
          user_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0]
        })
      }

      // Recargar perfil después de crear/actualizar
      return await loadUserProfile(authUser.id)

    } catch (error) {
      console.error('❌ Error asegurando perfil:', error)
      return null
    }
  }

  useEffect(() => {
    console.log('🔐 AuthProvider: Inicializando sistema dual...')
    
    // 🔒 Timeout de seguridad - evitar loading infinito (extendido)
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('🚨 Loading timeout (10s) - forzando finalización')
        setLoading(false)
        setInitialized(true)
      }
    }, 10000) // 10 segundos máximo (más tiempo para consultas lentas)
    
    const checkUser = async () => {
      try {
        if (!initialUser) {
          const { data: { user }, error } = await supabase.auth.getUser()
          if (!error && user) {
            console.log('✅ AuthProvider: Usuario encontrado:', user.email)
            setUser(user)
            
            // Cargar perfil completo - ESPERAR para evitar flash de isPremium=false
            if (!userProfile || userProfile.id !== user.id) {
              console.log('🔄 Cargando perfil...')
              await loadUserProfile(user.id).catch(err => {
                console.warn('⚠️ Error cargando perfil (no crítico):', err)
              })
            } else {
              console.log('✅ Perfil ya cargado, reutilizando')
            }
          } else {
            console.log('👤 AuthProvider: Sin usuario inicial')
            setUser(null)
            setUserProfile(null)
          }
        } else {
          console.log('✅ AuthProvider: Usuario inicial recibido:', initialUser.email)
          setUser(initialUser)
          
          // Cargar perfil inicial - ESPERAR para evitar flash de isPremium=false
          console.log('🔄 Cargando perfil inicial...')
          await loadUserProfile(initialUser.id).catch(err => {
            console.warn('⚠️ Error cargando perfil inicial (no crítico):', err)
          })
        }
      } catch (error) {
        console.error('❌ AuthProvider: Error verificando usuario:', error)
        setUser(null)
        setUserProfile(null)
      } finally {
        setLoading(false)
        setInitialized(true)
        clearTimeout(timeoutId)
      }
    }

    checkUser()

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Solo log eventos importantes, no TOKEN_REFRESHED
        if (event !== 'TOKEN_REFRESHED') {
          console.log('🔄 AuthProvider: Auth state cambió:', event, session?.user?.email)
        }
        
        const newUser = session?.user || null
        setUser(newUser)
        
        if (newUser) {
          // Usuario logueado - asegurar perfil y cargar datos
          console.log('👤 Usuario logueado, procesando perfil...')

          // 📍 TRACKING IP Y LOCALIDAD - Solo en login/registro real, no en recargas
          if (event === 'SIGNED_IN' || event === 'SIGNED_UP') {
            trackSessionIP(newUser.id)
          }

          // 🎯 TRACKING GOOGLE ADS: Solo para nuevos usuarios (SIGNED_UP)
          if (event === 'SIGNED_UP') {
            console.log('🎯 Nuevo usuario registrado, tracking Google Ads conversion')
            try {
              GoogleAdsEvents.SIGNUP('google_oauth')
            } catch (error) {
              console.warn('⚠️ Error tracking Google Ads signup:', error)
            }
          }
          
          // 🆕 VERIFICAR SI DEBE FORZAR CHECKOUT (COOKIES DE CAMPAÑA)
          if (shouldForceCheckout(newUser, supabase)) {
            console.log('💰 Forzando checkout por cookies de campaña')
            setTimeout(() => {
              forceCampaignCheckout(newUser, supabase).catch(err => {
                console.error('❌ Error forzando checkout:', err)
              })
            }, 1000) // Pequeño delay para que termine de cargar
          }
          
          // Cargar perfil - ESPERAR para evitar flash de isPremium=false
          let profile = userProfile?.id === newUser.id ? userProfile : null
          if (!profile) {
            setLoading(true) // Mostrar loading mientras carga el perfil
            console.log('🔄 Cargando perfil onAuthStateChange...')
            // Primero intentar cargar, solo crear si no existe
            await loadUserProfile(newUser.id).then(loadedProfile => {
              if (!loadedProfile) {
                // Solo llamar ensureUserProfile si loadUserProfile no encontró perfil
                console.log('🆕 Perfil no encontrado, asegurando creación...')
                return ensureUserProfile(newUser)
              }
              console.log('✅ Perfil cargado:', loadedProfile.plan_type)
            }).catch(err => {
              console.warn('⚠️ Error en flujo de perfil (no crítico):', err)
            })
          } else {
            console.log('✅ Perfil ya en memoria:', profile.plan_type)
          }
          
        } else {
          // Usuario deslogueado
          console.log('👋 Usuario deslogueado')
          setUserProfile(null)
        }
        
        setLoading(false)
        
        // Disparar evento personalizado
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('authStateChanged', {
            detail: { event, user: newUser, profile: userProfile }
          }))
        }
      }
    )

    return () => {
      console.log('🧹 AuthProvider: Limpiando subscripción')
      subscription.unsubscribe()
      clearTimeout(timeoutId)
    }
  }, [initialUser])

  // 🆕 ESCUCHAR EVENTOS DE SINCRONIZACIÓN ENTRE PESTAÑAS
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleAuthSync = (event) => {
      const { session, source, isIOSSafari } = event.detail

      console.log(`🔄 AuthContext: Sincronización desde ${source}${isIOSSafari ? ' (iOS Safari)' : ''}`)

      if (session && session.user) {
        // Hay sesión nueva
        if (!user || user.id !== session.user.id) {
          console.log('✅ Actualizando usuario desde sync:', session.user.email)
          setUser(session.user)
          loadUserProfile(session.user.id)
        }
      } else {
        // No hay sesión según el evento
        // 🐛 FIX iOS Safari ONLY: No limpiar sesión en visibility_change si ya tenemos usuario
        // Safari iOS puede devolver sesión vacía por errores temporales de localStorage
        if (source === 'visibility_change' && user && isIOSSafari) {
          console.log('⚠️ [iOS Safari] Ignorando sesión vacía desde visibility_change')
          // El fix en lib/supabase.js ya verificó con getUser() antes de llegar aquí
          // Si llegó aquí con session null, probablemente es un error real, pero mejor mantener
          // la sesión y dejar que el usuario la cierre manualmente si hay problema real
          return
        }

        if (user) {
          console.log('👋 Limpiando usuario desde sync')
          setUser(null)
          setUserProfile(null)
        }
      }
    }

    // Escuchar eventos de sincronización
    window.addEventListener('supabaseAuthSync', handleAuthSync)

    // Escuchar evento de perfil actualizado (desde página de perfil o post-pago)
    const handleProfileUpdated = () => {
      console.log('🔄 Perfil actualizado, forzando recarga...')
      if (user?.id) {
        setUserProfile(null)
        loadUserProfile(user.id)
      }
    }
    window.addEventListener('profileUpdated', handleProfileUpdated)

    return () => {
      window.removeEventListener('supabaseAuthSync', handleAuthSync)
      window.removeEventListener('profileUpdated', handleProfileUpdated)
    }
  }, [user?.id, loadUserProfile])

  // 🎯 NUEVA FUNCIÓN: Verificar acceso del usuario
  const checkAccess = async () => {
    if (!user) {
      return { can_access: false, user_type: 'not_logged_in', message: 'Usuario no logueado' }
    }
    
    try {
      const { data, error } = await supabase.rpc('check_user_access', {
        user_id: user.id
      })
      
      if (error) {
        console.error('❌ Error verificando acceso:', error)
        return { can_access: false, user_type: 'error', message: 'Error verificando acceso' }
      }
      
      const result = data[0]
      
      return result
      
    } catch (error) {
      console.error('❌ Error en checkAccess:', error)
      return { can_access: false, user_type: 'error', message: 'Error en verificación' }
    }
  }

  // 🎯 NUEVA FUNCIÓN: Activar premium después del pago
  const activatePremium = async (stripeCustomerId) => {
    if (!user) return false
    
    try {
      console.log('💳 Activando premium para usuario:', user.email)
      
      await supabase.rpc('activate_premium_user', {
        user_id: user.id,
        stripe_customer_id: stripeCustomerId
      })
      
      // Recargar perfil
      if (!userProfile || userProfile.id !== user.id) {
        if (!userProfile || userProfile.id !== user.id) {
          await loadUserProfile(user.id)
        } else {
          console.log('✅ Perfil ya cargado, reutilizando')
        }
      } else {
        console.log('✅ Perfil ya cargado, reutilizando')
      }
      
      console.log('✅ Premium activado exitosamente')
      return true
      
    } catch (error) {
      console.error('❌ Error activando premium:', error)
      return false
    }
  }

  // Funciones auxiliares existentes
  const signOut = async () => {
    try {
      console.log('🚪 AuthProvider: Cerrando sesión...')
      
      // 1. Cerrar sesión en Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('❌ Error en logout de Supabase:', error)
        throw error
      }
      
      // 2. Limpiar localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_return_url_backup')
        localStorage.removeItem('auth_return_timestamp')
        // Limpiar cualquier otro dato de localStorage que uses para auth
      }
      
      // 3. Limpiar estados locales
      setUser(null)
      setUserProfile(null)
      setLoading(false)
      
      // 4. Disparar evento global para notificar a otros componentes
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('authStateChanged', {
          detail: { 
            event: 'SIGNED_OUT',
            user: null,
            profile: null
          }
        }))
      }
      
      console.log('✅ AuthProvider: Sesión cerrada exitosamente')
      
      // 5. Redirigir a página de inicio - DETECTAR ENTORNO AUTOMÁTICAMENTE
      if (typeof window !== 'undefined') {
        const baseUrl = window.location.origin  // http://localhost:3000 o https://www.vence.es
        const redirectUrl = `${baseUrl}/`
        
        console.log('🔄 Redirigiendo a:', redirectUrl)
        window.location.href = redirectUrl
      }
      
    } catch (error) {
      console.error('❌ AuthProvider: Error cerrando sesión:', error)
      
      // Forzar logout local aunque falle el remoto
      setUser(null)
      setUserProfile(null)
      setLoading(false)
      
      // Redirigir aunque haya fallado el logout remoto
      if (typeof window !== 'undefined') {
        const baseUrl = window.location.origin
        const redirectUrl = `${baseUrl}/`
        
        console.log('🔄 Forzando redirección a:', redirectUrl)
        window.location.href = redirectUrl
      }
    }
  }

  const refreshUser = async () => {
    try {
      console.log('🔄 AuthProvider: Refrescando usuario...')
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      setUser(user)

      if (user) {
        // Forzar recarga del perfil (limpiar cache para que loadUserProfile no lo salte)
        console.log('🔄 Forzando recarga de perfil...')
        setUserProfile(null)
        loadUserProfile(user.id).catch(err => {
          console.warn('⚠️ Error refrescando perfil (no crítico):', err)
        })
      } else {
        setUserProfile(null)
      }
      
      console.log('✅ AuthProvider: Usuario refrescado:', user?.email)
      return user
    } catch (error) {
      console.error('❌ AuthProvider: Error refrescando usuario:', error)
      setUser(null)
      setUserProfile(null)
      return null
    }
  }

  // 🔒 CONTROL DE SESIONES SIMULTÁNEAS (solo para usuarios específicos)
  const { showWarning: showSessionWarning } = useSessionControl(user, supabase)

  // Estado para logout desde el modal de sesiones
  const [isLoggingOutFromWarning, setIsLoggingOutFromWarning] = useState(false)

  // Función para hacer logout desde el modal de warning
  const handleLogoutFromWarning = async () => {
    setIsLoggingOutFromWarning(true)
    await signOut()
  }

  // 🎯 VALOR DEL CONTEXTO EXPANDIDO
  const value = {
    user,
    userProfile,
    loading,
    initialized,
    signOut,
    refreshUser,
    checkAccess,
    activatePremium,
    isAuthenticated: !!user,
    isPremium: userProfile?.plan_type === 'premium' || userProfile?.plan_type === 'trial',
    isLegacy: userProfile?.plan_type === 'legacy_free',
    requiresPayment: userProfile?.requires_payment || false,
    registrationSource: userProfile?.registration_source || 'unknown',
    supabase
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* 🔒 Modal BLOQUEANTE por sesiones simultáneas */}
      <SessionWarningModal
        isOpen={showSessionWarning}
        onLogout={handleLogoutFromWarning}
        isLoggingOut={isLoggingOutFromWarning}
      />
    </AuthContext.Provider>
  )
}

// HOC actualizado para componentes que requieren autenticación
export function withAuth(Component) {
  return function AuthenticatedComponent(props) {
    const { user, loading } = useAuth()
    
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p>Verificando autenticación...</p>
          </div>
        </div>
      )
    }
    
    if (!user) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-4">Acceso Requerido</h2>
            <p className="mb-4">Necesitas iniciar sesión para acceder a esta página</p>
            <a href="/login" className="bg-blue-600 text-white px-4 py-2 rounded">
              Iniciar Sesión
            </a>
          </div>
        </div>
      )
    }
    
    return <Component {...props} />
  }
}

// 🎯 NUEVO HOC: Para componentes que requieren premium
export function withPremium(Component) {
  return function PremiumComponent(props) {
    const { user, userProfile, loading, checkAccess } = useAuth()
    const [accessLoading, setAccessLoading] = useState(true)
    const [canAccess, setCanAccess] = useState(false)
    const [accessInfo, setAccessInfo] = useState(null)
    
    useEffect(() => {
      const verifyAccess = async () => {
        if (user && userProfile) {
          const result = await checkAccess()
          setCanAccess(result.can_access)
          setAccessInfo(result)
        }
        setAccessLoading(false)
      }
      
      if (!loading) {
        verifyAccess()
      }
    }, [user, userProfile, loading])
    
    if (loading || accessLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p>Verificando acceso...</p>
          </div>
        </div>
      )
    }
    
    if (!user) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-4">Registro Requerido</h2>
            <p className="mb-4">Necesitas una cuenta para acceder</p>
            <a href="/login" className="bg-blue-600 text-white px-4 py-2 rounded">
              Crear Cuenta
            </a>
          </div>
        </div>
      )
    }
    
    if (!canAccess) {
      // Mostrar paywall - redirigir a premium
      window.location.href = '/premium'
      return null
    }
    
    return <Component {...props} />
  }
}