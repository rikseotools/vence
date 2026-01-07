'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

// Google Client ID
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

export default function GoogleOneTap({ onSuccess, onError, disabled = false }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasPrompted, setHasPrompted] = useState(false)

  // Generar nonce para seguridad
  const generateNonce = useCallback(async () => {
    const nonce = btoa(
      String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))
    )
    const encoder = new TextEncoder()
    const encodedNonce = encoder.encode(nonce)
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedNonce)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    return { nonce, hashedNonce }
  }, [])

  // Manejar respuesta de Google
  const handleCredentialResponse = useCallback(async (response) => {
    console.log('🎯 Google One Tap: Credential recibido')

    try {
      const supabase = getSupabaseClient()
      if (!supabase) {
        throw new Error('Supabase client no disponible')
      }

      // Obtener el nonce guardado
      const nonce = sessionStorage.getItem('google_one_tap_nonce')

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
        nonce: nonce || undefined,
      })

      if (error) {
        console.error('❌ Error en signInWithIdToken:', error)
        onError?.(error)
        return
      }

      console.log('✅ Google One Tap: Login exitoso', data.user?.email)

      // Limpiar nonce
      sessionStorage.removeItem('google_one_tap_nonce')

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
  const initializeOneTap = useCallback(async () => {
    if (!window.google || hasPrompted || disabled) return

    try {
      // Generar y guardar nonce
      const { nonce, hashedNonce } = await generateNonce()
      sessionStorage.setItem('google_one_tap_nonce', nonce)

      console.log('🚀 Inicializando Google One Tap...')

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        nonce: hashedNonce,
        auto_select: false, // No auto-seleccionar, dejar que el usuario elija
        cancel_on_tap_outside: true,
        context: 'signin',
        ux_mode: 'popup',
        itp_support: true,
        use_fedcm_for_prompt: true, // Importante para Chrome sin third-party cookies
      })

      // Mostrar el prompt de One Tap
      window.google.accounts.id.prompt((notification) => {
        console.log('📱 Google One Tap notification:', notification.getMomentType())

        if (notification.isNotDisplayed()) {
          console.log('⚠️ One Tap no mostrado:', notification.getNotDisplayedReason())
        }
        if (notification.isSkippedMoment()) {
          console.log('⏭️ One Tap saltado:', notification.getSkippedReason())
        }
        if (notification.isDismissedMoment()) {
          console.log('❌ One Tap descartado:', notification.getDismissedReason())
        }
      })

      setHasPrompted(true)

    } catch (error) {
      console.error('❌ Error inicializando One Tap:', error)
    }
  }, [generateNonce, handleCredentialResponse, hasPrompted, disabled])

  // Cargar script de Google
  useEffect(() => {
    if (disabled || !GOOGLE_CLIENT_ID) return

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
