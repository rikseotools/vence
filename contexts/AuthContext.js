// contexts/AuthContext.js - CONTEXTO GLOBAL CON SISTEMA DUAL
'use client'
import { createContext, useState, useEffect, useContext, useCallback } from 'react'

import { getSupabaseClient } from '../lib/supabase'
import notificationTracker from '../lib/services/notificationTracker'
import emailTracker from '../lib/services/emailTracker'
import { shouldForceCheckout, forceCampaignCheckout } from '../lib/campaignTracker'

const AuthContext = createContext({})

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

  // 🎯 OPTIMIZADA: Cargar perfil con timeout más largo y mejor manejo
  const loadUserProfile = useCallback(async (userId) => {
    // ✨ Evitar llamadas concurrentes
    if (profileLoading) {
      console.log('📄 Ya cargando perfil, esperando...')
      return userProfile
    }
    
    // Si ya tenemos el perfil del usuario correcto, no recargar
    if (userProfile && userProfile.id === userId) {
      console.log('✅ Perfil ya cargado para este usuario, reutilizando')
      return userProfile
    }
    
    setProfileLoading(true)
    
    try {
      console.log('📄 Cargando perfil completo del usuario...')
      
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
        // Si es abort/timeout, no es crítico - continuar
        if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
          console.warn('⏱️ Timeout en consulta de perfil (8s), continuando sin perfil')
          setUserProfile(null)
          return null
        }
        
        // Si no existe el perfil, es normal
        if (error.code === 'PGRST116') {
          console.log('📝 Perfil no existe, será creado automáticamente')
          return null
        }
        
        console.error('❌ Error cargando perfil:', error)
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
      
      // Si es abort/timeout, continuar sin perfil
      if (error.name === 'AbortError') {
        console.warn('⏱️ Timeout en loadUserProfile, continuando...')
        setUserProfile(null)
      }
      
      return null
    } finally {
      setProfileLoading(false)
    }
  }, [supabase])

  // 🎯 NUEVA FUNCIÓN: Crear/actualizar perfil según fuente
  const ensureUserProfile = async (authUser) => {
    try {
      const registrationSource = detectRegistrationSource()
      const campaignId = new URLSearchParams(window.location.search).get('campaign')
      
      console.log('👤 Asegurando perfil para:', authUser.email)
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
            
            // Cargar perfil completo en background - NO BLOQUEAR
            if (!userProfile || userProfile.id !== user.id) {
              console.log('🔄 Cargando perfil en background...')
              loadUserProfile(user.id).catch(err => {
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
          
          // Cargar perfil en background - NO BLOQUEAR
          console.log('🔄 Cargando perfil inicial en background...')
          loadUserProfile(initialUser.id).catch(err => {
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
        console.log('🔄 AuthProvider: Auth state cambió:', event, session?.user?.email)
        
        const newUser = session?.user || null
        setUser(newUser)
        
        if (newUser) {
          // Usuario logueado - asegurar perfil y cargar datos
          console.log('👤 Usuario logueado, procesando perfil...')
          
          // 🆕 VERIFICAR SI DEBE FORZAR CHECKOUT (COOKIES DE CAMPAÑA)
          if (shouldForceCheckout(newUser, supabase)) {
            console.log('💰 Forzando checkout por cookies de campaña')
            setTimeout(() => {
              forceCampaignCheckout(newUser, supabase).catch(err => {
                console.error('❌ Error forzando checkout:', err)
              })
            }, 1000) // Pequeño delay para que termine de cargar
          }
          
          // Cargar perfil en background
          let profile = userProfile?.id === newUser.id ? userProfile : null
          if (!profile) {
            console.log('🔄 Cargando perfil onAuthStateChange en background...')
            loadUserProfile(newUser.id).catch(err => {
              console.warn('⚠️ Error cargando perfil onAuth (no crítico):', err)
            })
          }

          if (!profile) {
            // Solo crear perfil si no existe - EN BACKGROUND
            console.log('🔄 Asegurando perfil en background...')
            ensureUserProfile(newUser).catch(err => {
              console.warn('⚠️ Error asegurando perfil (no crítico):', err)
            })
          }
          
          if (profile) {
            console.log('✅ Perfil procesado:', profile.registration_source, profile.plan_type)
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
      const { session, source } = event.detail
      
      console.log(`🔄 AuthContext: Sincronización desde ${source}`)
      
      if (session && session.user) {
        // Hay sesión nueva
        if (!user || user.id !== session.user.id) {
          console.log('✅ Actualizando usuario desde sync:', session.user.email)
          setUser(session.user)
          loadUserProfile(session.user.id)
        }
      } else {
        // No hay sesión
        if (user) {
          console.log('👋 Limpiando usuario desde sync')
          setUser(null)
          setUserProfile(null)
        }
      }
    }

    // Escuchar eventos de sincronización
    window.addEventListener('supabaseAuthSync', handleAuthSync)
    
    return () => {
      window.removeEventListener('supabaseAuthSync', handleAuthSync)
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
      console.log('🔍 Resultado verificación acceso:', result)
      
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
        if (!userProfile || userProfile.id !== user.id) {
          console.log('🔄 Refrescando perfil en background...')
          loadUserProfile(user.id).catch(err => {
            console.warn('⚠️ Error refrescando perfil (no crítico):', err)
          })
        } else {
          console.log('✅ Perfil ya cargado, reutilizando')
        }
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