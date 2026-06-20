'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { auth } from '@/lib/auth'
import type { AuthSession, AuthUser } from '@/lib/auth/types'

// Google Client ID
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

// --- Tipos mínimos de Google Identity Services (window.google) ---
interface GoogleIdConfig {
  client_id: string | undefined
  callback: (response: { credential: string }) => void
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
  context?: string
  ux_mode?: string
  itp_support?: boolean
  use_fedcm_for_prompt?: boolean
  nonce?: string
}
interface GoogleAccountsId {
  initialize: (config: GoogleIdConfig) => void
  prompt: () => void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

interface GoogleOneTapProps {
  onSuccess?: (data: { user: AuthUser | null; session: AuthSession | null }) => void
  onError?: (error: unknown) => void
  disabled?: boolean
}

// Detectar iOS (Safari y Chrome iOS tienen problemas con FedCM/One Tap)
function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// Genera un nonce + su hash SHA-256 (Google requiere el hash, el proveedor el raw)
async function generateNonce(): Promise<{ nonce: string; hashedNonce: string }> {
  const nonce = crypto.randomUUID()
  const encoder = new TextEncoder()
  const data = encoder.encode(nonce)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashedNonce = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return { nonce, hashedNonce }
}

export default function GoogleOneTap({ onSuccess, onError, disabled = false }: GoogleOneTapProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasPrompted, setHasPrompted] = useState(false)
  // Guardamos el nonce raw en ref para usarlo en el callback (Google nos
  // devuelve el id_token con el HASH del nonce, el proveedor necesita el RAW
  // para hashearlo y comparar).
  const nonceRef = useRef<string | null>(null)

  // Manejar respuesta de Google
  const handleCredentialResponse = useCallback(async (response: { credential: string }) => {
    console.log('🎯 Google One Tap: Credential recibido')

    try {
      // signInWithIdToken con nonce — FedCM requiere nonce en id_token,
      // el proveedor verifica que el hash del nonce raw coincida con el del JWT.
      // Vía puerto agnóstico (lib/auth), no el cliente Supabase directo.
      const { session, user, error } = await auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
        nonce: nonceRef.current ?? undefined,
      })

      if (error) {
        console.error('❌ Error en signInWithIdToken:', error)
        onError?.(error)
        return
      }

      console.log('✅ Google One Tap: Login exitoso', user?.email)

      // Disparar evento global de auth
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supabaseAuthSuccess', {
          detail: { user, session }
        }))
      }

      onSuccess?.({ user, session })

    } catch (error) {
      console.error('❌ Google One Tap error:', error)
      onError?.(error)
    }
  }, [onSuccess, onError])

  // Inicializar Google One Tap
  const initializeOneTap = useCallback(async () => {
    if (!window.google || hasPrompted || disabled) return

    try {
      console.log('🚀 Inicializando Google One Tap...')

      // Generar nonce nuevo para cada init y guardarlo en ref para el callback
      const { nonce, hashedNonce } = await generateNonce()
      nonceRef.current = nonce

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false, // No auto-seleccionar, dejar que el usuario elija
        cancel_on_tap_outside: true,
        context: 'signin',
        ux_mode: 'popup',
        itp_support: true,
        use_fedcm_for_prompt: true, // Importante para Chrome sin third-party cookies
        nonce: hashedNonce, // FedCM requiere nonce hasheado
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
      const user = await auth.getUser()
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
    return undefined
  }, [isLoaded, hasPrompted, disabled, initializeOneTap])

  // No renderiza nada visible - One Tap aparece como overlay de Google
  return null
}

// Hook para usar Google One Tap fácilmente
export function useGoogleOneTap(_opts: Partial<GoogleOneTapProps> = {}) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      setIsReady(true)
    }
  }, [])

  return { isReady }
}
