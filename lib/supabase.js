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
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
          console.log('👁️ Pestaña visible - verificando sesión')
          
          try {
            const { data: { session }, error } = await supabaseInstance.auth.getSession()
            
            if (!error) {
              window.dispatchEvent(new CustomEvent('supabaseAuthSync', {
                detail: { session, source: 'visibility_change' }
              }))
            }
          } catch (error) {
            console.error('❌ Error verificando sesión:', error)
          }
        }
      })
    }
    
    isInitializing = false
    
  } else {
    console.log('♻️ Reutilizando instancia existente de Supabase')
  }
  
  return supabaseInstance
}

// ✅ LOGIN CON MÉTODO OFICIAL RECOMENDADO
export const signInWithGoogle = async () => {
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
    const callbackUrl = `${baseUrl}/auth/callback?return_to=${encodeURIComponent(relativeUrl)}`
    
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