// lib/supabase.js - MÉTODO OFICIAL RECOMENDADO POR SUPABASE

import { createClient } from '@supabase/supabase-js'

// ✅ FUNCIÓN OFICIAL CON SOPORTE WWW
const getURL = () => {
  let url = 
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // Configurado en producción
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Automático de Vercel
    'http://localhost:3000/' // Fallback desarrollo
  
  // Asegurar protocolo https (excepto localhost)
  url = url.startsWith('http') ? url : `https://${url}`
  
  // 🎯 ASEGURAR CONSISTENCIA CON WWW en producción
  if (typeof window !== 'undefined' && window.location.hostname.startsWith('www.')) {
    const urlObj = new URL(url)
    if (!urlObj.hostname.startsWith('www.') && urlObj.hostname !== 'localhost') {
      urlObj.hostname = `www.${urlObj.hostname}`
      url = urlObj.toString()
    }
  }
  
  // Asegurar trailing slash
  url = url.endsWith('/') ? url : `${url}/`
  
  console.log('🌐 URL final generada:', url)
  return url
}

// ✅ SINGLETON ESTRICTO
let supabaseInstance = null
let isInitializing = false

export const getSupabaseClient = () => {
  if (isInitializing) {
    console.log('⏳ Esperando inicialización de Supabase...')
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (supabaseInstance && !isInitializing) {
          clearInterval(checkInterval)
          resolve(supabaseInstance)
        }
      }, 10)
    })
  }

  if (!supabaseInstance) {
    isInitializing = true
    
    console.log('🔧 Creando instancia ÚNICA de Supabase...')
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('❌ Variables de entorno de Supabase faltantes')
      isInitializing = false
      return null
    }
    
    supabaseInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('://')[1]?.split('.')[0]}-auth`,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          flowType: 'pkce',
          debug: false
        },
        global: {
          headers: {
            'x-client-info': 'supabase-js-web'
          }
        }
      }
    )
    
    console.log('✅ Instancia única de Supabase creada exitosamente')
    
    supabaseInstance.auth.onAuthStateChange((event, session) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 [SINGLETON AUTH] ${event}:`, session?.user?.email || 'No user')
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supabaseAuthChange', {
          detail: { event, session, user: session?.user }
        }))
      }
    })
    
    // 🆕 SESSION SYNC ENTRE PESTAÑAS
    if (typeof window !== 'undefined') {
      const storageKey = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('://')[1]?.split('.')[0]}-auth`
      
      window.addEventListener('storage', async (e) => {
        if (e.key === storageKey) {
          console.log('🔄 Detectado cambio de sesión en otra pestaña')
          
          try {
            // Obtener nueva sesión
            const { data: { session }, error } = await supabaseInstance.auth.getSession()
            
            if (!error) {
              // Disparar evento para que AuthContext se actualice
              window.dispatchEvent(new CustomEvent('supabaseAuthSync', {
                detail: { session, source: 'storage_sync' }
              }))
              
              console.log('✅ Sesión sincronizada entre pestañas')
            }
          } catch (error) {
            console.error('❌ Error sincronizando sesión:', error)
          }
        }
      })
      
      // 🔍 DETECTAR CUANDO LA PESTAÑA VUELVE A SER VISIBLE
      // 🐛 FIX iOS Safari + Android PWA: Debounce + verificación robusta para evitar falsos logouts

      // Detectar iOS Safari (donde ocurre el bug de localStorage)
      const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
                          !window.MSStream &&
                          /Safari/.test(navigator.userAgent) &&
                          !/CriOS|FxiOS/.test(navigator.userAgent) // Excluir Chrome/Firefox en iOS

      // 🆕 Detectar Android Chrome PWA (mismo problema de localStorage aislado)
      const isAndroidChrome = /Android/.test(navigator.userAgent) &&
                              /Chrome/.test(navigator.userAgent) &&
                              !/Edge|Edg/.test(navigator.userAgent)

      // Detectar si estamos en modo PWA standalone
      const isPWAStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                              window.navigator.standalone === true ||
                              document.referrer.includes('android-app://')

      // Aplicar fix para iOS Safari O Android Chrome en PWA
      const needsSessionFix = isIOSSafari || (isAndroidChrome && isPWAStandalone)

      if (needsSessionFix) {
        console.log('🔧 [AUTH] Modo robusto activado:', { isIOSSafari, isAndroidChrome, isPWAStandalone })
      }

      let visibilityDebounceTimer = null
      let lastVisibilityCheck = 0
      const VISIBILITY_DEBOUNCE_MS = needsSessionFix ? 2000 : 500 // Más conservador en iOS/Android PWA
      const VISIBILITY_MIN_INTERVAL_MS = needsSessionFix ? 5000 : 1000 // Más conservador en iOS/Android PWA

      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
          const now = Date.now()

          // Evitar verificaciones muy frecuentes (especialmente en iOS Safari)
          if (now - lastVisibilityCheck < VISIBILITY_MIN_INTERVAL_MS) {
            console.log('👁️ Verificación de sesión omitida (muy reciente)')
            return
          }

          // Cancelar verificación pendiente si hay una nueva
          if (visibilityDebounceTimer) {
            clearTimeout(visibilityDebounceTimer)
          }

          // Debounce: esperar antes de verificar (iOS Safari puede disparar eventos múltiples)
          visibilityDebounceTimer = setTimeout(async () => {
            console.log('👁️ Pestaña visible - verificando sesión')
            lastVisibilityCheck = Date.now()

            try {
              const { data: { session }, error } = await supabaseInstance.auth.getSession()

              // 🐛 FIX iOS Safari + Android PWA: Si hay error o no hay sesión, verificar con getUser()
              if (needsSessionFix && (error || !session)) {
                console.log('⚠️ [PWA Fix] getSession() devolvió vacío, verificando con getUser()...')
                const { data: { user }, error: userError } = await supabaseInstance.auth.getUser()

                if (user && !userError) {
                  // Hay usuario válido pero getSession() falló - NO limpiar sesión
                  console.log('✅ [PWA Fix] Usuario válido encontrado, manteniendo sesión')
                  // Intentar refrescar la sesión
                  await supabaseInstance.auth.refreshSession()
                  return
                }
              }

              if (!error) {
                window.dispatchEvent(new CustomEvent('supabaseAuthSync', {
                  detail: { session, source: 'visibility_change', needsSessionFix, isIOSSafari, isAndroidChrome }
                }))
              }
            } catch (error) {
              console.error('❌ Error verificando sesión:', error)
              // 🐛 FIX iOS Safari + Android PWA: No propagar errores como logout
              if (!needsSessionFix) {
                throw error
              }
            }
          }, VISIBILITY_DEBOUNCE_MS)
        }
      })
    }
    
    isInitializing = false
    
  } else {
  }
  
  return supabaseInstance
}

// ✅ LOGIN CON MÉTODO OFICIAL RECOMENDADO
// options: { funnel?: string } - opcional para trackear el origen del registro
export const signInWithGoogle = async (options = {}) => {
  const client = getSupabaseClient()

  if (!client) {
    throw new Error('Cliente de Supabase no disponible')
  }

  try {
    console.log('🚀 Iniciando Google OAuth (método oficial)...')

    // 🎯 CAPTURAR URL RELATIVA
    const relativeUrl = typeof window !== 'undefined'
      ? window.location.pathname + window.location.search + window.location.hash
      : '/auxiliar-administrativo-estado'

    // 🎯 BACKUP EN LOCALSTORAGE
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('auth_return_url_backup', relativeUrl)
        localStorage.setItem('auth_return_timestamp', Date.now().toString())
        console.log('💾 URL de retorno guardada:', relativeUrl)
      } catch (e) {
        console.warn('⚠️ No se pudo guardar backup:', e)
      }
    }

    // 🔧 USAR EL MISMO MÉTODO QUE FUNCIONA EN LOGIN PAGE
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : getURL()
    let callbackUrl = `${baseUrl}/auth/callback?return_to=${encodeURIComponent(relativeUrl)}`

    // 🎯 AÑADIR FUNNEL DE REGISTRO SI SE ESPECIFICA
    if (options.funnel) {
      callbackUrl += `&funnel=${encodeURIComponent(options.funnel)}`
      console.log('📋 Funnel de registro:', options.funnel)
    }
    
    console.log('📍 Base URL (window.location.origin):', baseUrl)
    console.log('🔄 Callback URL:', callbackUrl)
    
    // ✅ MÉTODO ESTÁNDAR RECOMENDADO
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
          include_granted_scopes: 'true',
          scope: 'openid email profile'
        }
      }
    })
    
    if (error) {
      console.error('❌ Error OAuth:', error)
      throw error
    }
    
    console.log('✅ OAuth iniciado correctamente')
    return { success: true, data }
    
  } catch (error) {
    console.error('❌ Error en signInWithGoogle:', error)
    return { success: false, error: error.message }
  }
}

export const getCurrentUser = async () => {
  try {
    const client = getSupabaseClient()
    if (!client) return null
    
    const { data: { user }, error } = await client.auth.getUser()
    
    if (error) {
      console.warn('Warning obteniendo usuario:', error.message)
      return null
    }
    
    return user
  } catch (error) {
    console.error('Error en getCurrentUser:', error)
    return null
  }
}

export default getSupabaseClient()

// ✅ DEBUG INFO
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.supabaseDebug = {
    getInstance: () => supabaseInstance,
    getInstanceCount: () => supabaseInstance ? 1 : 0,
    getURL: getURL,
    signInGoogle: signInWithGoogle,
    getCurrentUser: getCurrentUser,
    clearInstance: () => {
      supabaseInstance = null
      isInitializing = false
      console.log('🗑️ Instancia limpiada (solo desarrollo)')
    }
  }
}