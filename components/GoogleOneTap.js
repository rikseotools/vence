'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

// Google Client ID
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

// Detectar iOS (Safari y Chrome iOS tienen problemas con FedCM/One Tap)
function isIOSDevice() {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export default function GoogleOneTap({ onSuccess, onError, disabled = false }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasPrompted, setHasPrompted] = useState(false)

  // Manejar respuesta de Google
  const handleCredentialResponse = useCallback(async (response) => {
    console.log('🎯 Google One Tap: Credential recibido')

    try {
      const supabase = getSupabaseClient()
      if (!supabase) {
        throw new Error('Supabase client no disponible')
      }

      // signInWithIdToken sin nonce (más compatible con FedCM)
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
      })

      if (error) {
        console.error('❌ Error en signInWithIdToken:', error)
        onError?.(error)
        return
      }

      console.log('✅ Google One Tap: Login exitoso', data.user?.email)

      // Disparar evento global de auth
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supabaseAuthSuccess', {
          detail: { user: data.user, session: data.session }
        }))
      }

      onSuccess?.(data)

    } catch (error) {
      console.error('❌ Google One Tap error:', error)
      onError?.(error)
    }
  }, [onSuccess, onError])

  // Inicializar Google One Tap
  const initializeOneTap = useCallback(() => {
    if (!window.google || hasPrompted || disabled) return

    try {
      console.log('🚀 Inicializando Google One Tap...')

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false, // No auto-seleccionar, dejar que el usuario elija
        cancel_on_tap_outside: true,
        context: 'signin',
        ux_mode: 'popup',
        itp_support: true,
        use_fedcm_for_prompt: true, // Importante para Chrome sin third-party cookies
      })

      // Mostrar el prompt de One Tap
      // NOTA: No pasamos callback para evitar warnings de FedCM deprecation
      window.google.accounts.id.prompt()

      setHasPrompted(true)

    } catch (error) {
      console.error('❌ Error inicializando One Tap:', error)
    }
  }, [handleCredentialResponse, hasPrompted, disabled])

  // Cargar script de Google
  useEffect(() => {
    if (disabled || !GOOGLE_CLIENT_ID) return

    // Desactivar en iOS - FedCM causa "Maximum call stack" en Safari/Chrome iOS
    if (isIOSDevice()) {
      console.log('📱 iOS detectado - Google One Tap desactivado (incompatibilidad FedCM)')
      return
    }

    // Verificar si ya hay usuario logueado
    const checkUser = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) return

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        console.log('👤 Usuario ya logueado, no mostrar One Tap')
        return
      }

      // Cargar script si no existe
      if (!document.getElementById('google-one-tap-script')) {
        const script = document.createElement('script')
        script.id = 'google-one-tap-script'
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        script.onload = () => {
          console.log('✅ Google Identity Services cargado')
          setIsLoaded(true)
        }
        script.onerror = () => {
          console.error('❌ Error cargando Google Identity Services')
        }
        document.head.appendChild(script)
      } else if (window.google?.accounts?.id) {
        setIsLoaded(true)
      }
    }

    checkUser()
  }, [disabled])

  // Inicializar cuando el script esté cargado
  useEffect(() => {
    if (isLoaded && !hasPrompted && !disabled) {
      // Pequeño delay para asegurar que la página está lista
      const timer = setTimeout(initializeOneTap, 1000)
      return () => clearTimeout(timer)
    }
  }, [isLoaded, hasPrompted, disabled, initializeOneTap])

  // No renderiza nada visible - One Tap aparece como overlay de Google
  return null
}

// Hook para usar Google One Tap fácilmente
export function useGoogleOneTap({ onSuccess, onError, disabled = false } = {}) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      setIsReady(true)
    }
  }, [])

  return { isReady }
}
