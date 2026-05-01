// contexts/AuthContext.tsx - CONTEXTO GLOBAL CON SISTEMA DUAL
'use client'
import { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import type { UserProfileRow } from '@/types/database.types'

import { getSupabaseClient } from '../lib/supabase'
import notificationTracker from '../lib/services/notificationTracker'
import emailTracker from '../lib/services/emailTracker'
import { shouldForceCheckout, forceCampaignCheckout } from '../lib/campaignTracker'
import { GoogleAdsEvents } from '../utils/googleAds'
import { useSessionControl } from '../hooks/useSessionControl'
import SessionWarningModal from '../components/SessionWarningModal'
import { logClientError } from '../lib/logClientError'

interface AccessCheckResult {
  can_access: boolean
  user_type: string
  message: string
}

export interface AuthContextValue {
  user: User | null
  userProfile: UserProfileRow | null
  loading: boolean
  initialized: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<User | null>
  checkAccess: () => Promise<AccessCheckResult>
  activatePremium: (stripeCustomerId: string) => Promise<boolean>
  isAuthenticated: boolean
  isPremium: boolean
  isLegacy: boolean
  requiresPayment: boolean
  registrationSource: string
  supabase: ReturnType<typeof getSupabaseClient>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// 🎯 TRACKING DE IP Y LOCALIDAD - Fire and forget, no bloquea UI
const trackSessionIP = (userId: string, sessionId: string | null = null) => {
  if (typeof window === 'undefined') return

  const deviceId = localStorage.getItem('vence_device_id') || null
  const hwFingerprint = localStorage.getItem('vence_hw_fingerprint') || null

  fetch('/api/auth/track-session-ip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, sessionId, deviceId, hwFingerprint })
  }).then(res => {
    if (res.ok) {
      console.log('📍 IP y localidad tracked en background')
    }
  }).catch(err => {
    console.warn('⚠️ Error tracking IP (no crítico):', err.message)
  })
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
  initialUser?: User | null
}

export function AuthProvider({ children, initialUser = null }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [userProfile, setUserProfile] = useState<UserProfileRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false) // ✨ Evita llamadas concurrentes

  // 🔧 Refs para evitar stale closures en onAuthStateChange/loadUserProfile
  const userProfileRef = useRef<UserProfileRow | null>(null)
  const profileLoadingRef = useRef(false)

  // 🎯 Singleflight: Map<userId, Promise> para deduplicar llamadas concurrentes.
  // Si varios componentes piden el perfil a la vez, todos esperan a la MISMA
  // promesa en curso en vez de recibir null/hacer queries duplicadas (bug que
  // hacía que users con red lenta vieran UI de "no-Premium" pese a tener Premium).
  const inflightProfileLoadsRef = useRef<Map<string, Promise<UserProfileRow | null>>>(new Map())

  const updateUserProfile = (profile: UserProfileRow | null) => {
    userProfileRef.current = profile
    setUserProfile(profile)
  }

  const updateProfileLoading = (val: boolean) => {
    profileLoadingRef.current = val
    setProfileLoading(val)
  }

  const supabase = getSupabaseClient()

  // Configurar instancia de Supabase en los trackers
  useEffect(() => {
    if (supabase) {
      notificationTracker.setSupabaseInstance(supabase)
      emailTracker.setSupabaseInstance(supabase)
    }
  }, [supabase])

  // 🎯 NUEVA FUNCIÓN: Detectar fuente de registro
  const detectRegistrationSource = (): string => {
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

  function isRetriableNetworkError(error: { name?: string; message?: string; code?: string }): boolean {
    if (error.name === 'AbortError') return true
    if (error.code === 'NETWORK_ERROR') return true
    const msg = error.message || ''
    return /network|fetch|Load failed/i.test(msg)
  }

  // 🎯 OPTIMIZADA: Cargar perfil con timeout, reintentos y mejor manejo
  const loadUserProfile = useCallback(async (userId: string, retryCount = 0): Promise<UserProfileRow | null> => {
    const MAX_RETRIES = 3

    // 🎯 Singleflight: si ya hay una carga en curso para este userId, devolver
    // esa MISMA Promise para que los llamadores concurrentes reciban el resultado
    // real (no null). Bug previo: devolvía null inmediatamente si profileLoadingRef
    // estaba activo, haciendo que components como UserAvatar vieran isPremium=false
    // pese a que el perfil estaba cargándose correctamente.
    // Nota: retryCount > 0 salta el singleflight porque es recursión interna.
    // Timeout: si la Promise lleva más de 15s sin resolver, ignorarla y reintentar
    // (previene bloqueo infinito cuando la query original se queda colgada).
    if (retryCount === 0) {
      const existing = inflightProfileLoadsRef.current.get(userId)
      if (existing) {
        console.log('📄 Singleflight: esperando carga en curso para', userId)
        const timeout = new Promise<null>(resolve => setTimeout(() => {
          console.warn('⏱️ Singleflight timeout (5s) — limpiando y reintentando')
          inflightProfileLoadsRef.current.delete(userId)
          resolve(null)
        }, 5_000))
        const result = await Promise.race([existing, timeout])
        if (result !== null) return result
        // Timeout: la Promise original no resolvió, continuar con nueva carga
      }
    }

    // Si ya tenemos el perfil del usuario correcto, no recargar
    if (userProfileRef.current && userProfileRef.current.id === userId && retryCount === 0) {
      console.log('✅ Perfil ya cargado para este usuario, reutilizando')
      return userProfileRef.current
    }

    // Wrapper interno con el trabajo real. El Promise de esta IIFE se guarda en
    // el Map de singleflight (solo en la llamada inicial, retryCount === 0) para
    // que llamadas concurrentes lo compartan.
    const doWork = async (): Promise<UserProfileRow | null> => {
      if (retryCount === 0) {
        updateProfileLoading(true)
      }

      try {
      console.log(`📄 Cargando perfil del usuario... ${retryCount > 0 ? `(intento ${retryCount + 1}/${MAX_RETRIES})` : ''}`, { userId })

      // Cargar perfil via API propia (Drizzle), NO via PostgREST.
      // PostgREST se deadlockea cuando Supabase Auth refresca token simultáneamente
      // (el SDK comparte HTTP client y la query se queda colgada indefinidamente).
      // Nuestra API usa fetch() estándar + AbortController que SÍ funciona.
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)
      const startedAt = Date.now()

      let profile: UserProfileRow | null = null

      try {
        // Obtener token actual para auth
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        if (!accessToken) {
          clearTimeout(timeoutId)
          console.warn('⚠️ Sin token de acceso para cargar perfil')
          if (retryCount < MAX_RETRIES - 1) {
            const delay = 1000 * Math.pow(2, retryCount)
            await new Promise(resolve => setTimeout(resolve, delay))
            return loadUserProfile(userId, retryCount + 1)
          }
          return null
        }

        const res = await fetch('/api/v2/profile', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const elapsedMs = Date.now() - startedAt
        if (elapsedMs > 3000) {
          logClientError('auth/load-user-profile', new Error(`slow profile load ${elapsedMs}ms`), {
            component: 'AuthContext.loadUserProfile',
            userId,
            severity: 'info',
          })
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const data = await res.json()
        profile = data.profile || null

      } catch (fetchErr: any) {
        clearTimeout(timeoutId)
        const isAbort = fetchErr?.name === 'AbortError'
        const isNavigation = /browsing context|signal is aborted|operation was aborted/i.test(fetchErr?.message || '')

        if (isAbort && !isNavigation) {
          // Timeout real (8s) — reintentar
          if (retryCount < MAX_RETRIES - 1) {
            console.warn(`⏱️ Timeout cargando perfil, reintentando... (${retryCount + 1}/${MAX_RETRIES})`)
            const delay = 1000 * Math.pow(2, retryCount)
            await new Promise(resolve => setTimeout(resolve, delay))
            return loadUserProfile(userId, retryCount + 1)
          }
          console.warn('⏱️ Timeout en perfil (8s) tras reintentos')
          logClientError('auth/load-user-profile', new Error('profile load timeout after retries'), {
            component: 'AuthContext.loadUserProfile', userId, severity: 'warning',
          })
          updateUserProfile(null)
          return null
        }

        if (isNavigation) return null // Tab cerrada, no es un error

        // Error de red — reintentar
        if (retryCount < MAX_RETRIES - 1) {
          console.warn(`🔄 Error cargando perfil, reintentando... (${retryCount + 1}/${MAX_RETRIES})`)
          const delay = 1000 * Math.pow(2, retryCount)
          await new Promise(resolve => setTimeout(resolve, delay))
          return loadUserProfile(userId, retryCount + 1)
        }

        console.error('❌ Error cargando perfil:', fetchErr)
        logClientError('auth/load-user-profile', fetchErr, {
          component: 'AuthContext.loadUserProfile', userId, severity: 'warning',
        })
        return null
      }

      if (!profile) {
        // Perfil no encontrado — puede ser usuario nuevo
        if (userProfileRef.current && userProfileRef.current.id === userId) {
          console.log('📝 Perfil no retornado pero hay cache — manteniendo')
          return userProfileRef.current
        }
        if (retryCount === 0) {
          console.log('📝 Perfil no encontrado — reintentando antes de crear')
          await new Promise(resolve => setTimeout(resolve, 300))
          return loadUserProfile(userId, retryCount + 1)
        }
        console.log('📝 Perfil no existe, será creado automáticamente')
        return null
      }

      if (profile) {
        console.log('✅ Perfil cargado:', profile.email, 'Tipo:', profile.plan_type)
        updateUserProfile(profile as unknown as UserProfileRow)
        return profile as unknown as UserProfileRow
      }

      return null

    } catch (error: any) {
      console.error('❌ Error en loadUserProfile:', error)

      // 🆕 Reintentar en errores de red/timeout
      if (retryCount < MAX_RETRIES - 1 && isRetriableNetworkError(error)) {
        console.warn(`🔄 Reintentando loadUserProfile... (${retryCount + 1}/${MAX_RETRIES})`)
        const delay = 1000 * Math.pow(2, retryCount)
        await new Promise(resolve => setTimeout(resolve, delay))
        return loadUserProfile(userId, retryCount + 1)
      }

      // Si es abort/timeout final, continuar sin perfil
      if (error.name === 'AbortError') {
        console.warn('⏱️ Timeout en loadUserProfile tras reintentos, continuando...')
        updateUserProfile(null)
      }

      return null
    } finally {
      if (retryCount === 0 || retryCount >= MAX_RETRIES - 1) {
        updateProfileLoading(false)
      }
    }
    } // fin doWork

    // Registrar la Promise en el Map solo para la llamada raíz (retryCount === 0).
    // Los retries internos ejecutan doWork() directamente sin singleflight.
    if (retryCount === 0) {
      const promise = doWork()
      inflightProfileLoadsRef.current.set(userId, promise)
      // Limpiar la entrada cuando la promesa termine (éxito o fallo).
      // Comprobamos identidad antes de borrar para evitar borrar otra carga que
      // se haya iniciado mientras tanto (defensa contra race conditions).
      promise.finally(() => {
        if (inflightProfileLoadsRef.current.get(userId) === promise) {
          inflightProfileLoadsRef.current.delete(userId)
        }
      })
      return promise
    }
    return doWork()
  }, [supabase])

  // 🎯 NUEVA FUNCIÓN: Crear/actualizar perfil según fuente
  // 🔧 FIX: Verificar si el perfil ya existe ANTES de llamar RPCs para no resetear plan_type
  const ensureUserProfile = async (authUser: User): Promise<UserProfileRow | null> => {
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
    console.log('🔐 AuthProvider: Inicializando (INITIAL_SESSION)...')

    // 🔒 Timeout de seguridad - evitar loading infinito
    // Si Supabase _initialize() se queda colgado en navigator.locks (común en dev),
    // intentamos recuperar la sesión manualmente desde localStorage
    const safetyTimeoutId = setTimeout(async () => {
      if (loading) {
        console.warn('🚨 Loading timeout (12s) - intentando recuperar sesión manualmente...')

        // Intentar leer sesión de localStorage y cargar perfil
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          if (supabaseUrl) {
            const storageKey = `sb-${supabaseUrl.split('://')[1]?.split('.')[0]}-auth`
            const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
            if (raw) {
              const parsed = JSON.parse(raw)
              if (parsed?.user?.id) {
                console.log('🔄 Recuperando sesión desde localStorage:', parsed.user.email)
                setUser(parsed.user)
                await loadUserProfile(parsed.user.id).catch((err: any) => {
                  console.warn('⚠️ Error cargando perfil en timeout recovery:', err)
                })
              }
            }
          }
        } catch (err) {
          console.warn('⚠️ Error en timeout recovery:', err)
        }

        setLoading(false)
        setInitialized(true)
      }
    }, 12000)

    // 🚀 Pre-hydrate: leer user de localStorage para setUser() inmediato (evita flash de UI)
    // NO cargar perfil aquí — INITIAL_SESSION lo hará con token válido
    if (!initialUser) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (supabaseUrl) {
          const storageKey = `sb-${supabaseUrl.split('://')[1]?.split('.')[0]}-auth`
          const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed?.user?.id) {
              setUser(parsed.user)
              console.log('🚀 Pre-hydrate: usuario de localStorage:', parsed.user.email)
            }
          }
        }
      } catch {
        // localStorage no disponible
      }
    } else {
      setUser(initialUser)
    }

    // 🎯 FUENTE DE VERDAD: onAuthStateChange con INITIAL_SESSION
    // INITIAL_SESSION se emite después de _initialize() (incluye token refresh),
    // garantizando un token válido para cargar el perfil.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
        if (event !== 'TOKEN_REFRESHED') {
          console.log('🔄 AuthProvider:', event, session?.user?.email || '(sin user)')
        }

        const newUser = session?.user || null
        // 🛡️ NO hacer setUser(null) si hay perfil cacheado — previene que
        // ProgressiveRegistrationManager muestre "Regístrate" a usuarios Premium
        // cuando Supabase no puede refrescar el token (pool saturado).
        // setUser(null) se hace SOLO tras confirmar que la sesión está realmente perdida.
        if (newUser || !userProfileRef.current) {
          setUser(newUser)
        } else {
          console.warn('⚠️ session null PERO hay perfil cacheado — NO limpiando user aún')
        }

        if (event === 'INITIAL_SESSION') {
          // === CARGA INICIAL (token ya refrescado por _initialize) ===
          if (newUser) {
            console.log('🔐 INITIAL_SESSION: cargando perfil con token válido...')
            await loadUserProfile(newUser.id).then(loadedProfile => {
              if (!loadedProfile) {
                console.log('🆕 Perfil no encontrado en INITIAL_SESSION, creando...')
                return ensureUserProfile(newUser)
              }
              return undefined
            }).catch((err: any) => {
              console.warn('⚠️ Error cargando perfil en INITIAL_SESSION:', err)
            })
          } else {
            console.log('👤 INITIAL_SESSION: sin usuario')
            // 🛡️ Resiliencia ante Supabase saturado: si teníamos un perfil cacheado,
            // NO limpiar inmediatamente. Supabase puede devolver session=null cuando
            // el token refresh falla por timeout (pool saturado). Si limpiamos, un
            // usuario Premium ve "¡Regístrate Gratis!" — caso Nila 28/04/2026.
            //
            // Estrategia: mantener el perfil cacheado durante 30s y reintentar.
            // Si tras el reintento sigue sin sesión, ENTONCES limpiar (logout real).
            const hadCachedProfile = userProfileRef.current !== null
            if (hadCachedProfile) {
              console.warn('⚠️ INITIAL_SESSION sin usuario PERO hay perfil cacheado — reintentando en 5s')
              // No limpiar aún: mantener perfil cacheado para que la UI siga funcional
              setTimeout(async () => {
                try {
                  const { data: { session: retrySession } } = await supabase.auth.getSession()
                  if (retrySession?.user) {
                    console.log('✅ Sesión recuperada tras reintento:', retrySession.user.email)
                    setUser(retrySession.user)
                    // Perfil ya está en cache, no recargar
                  } else {
                    // Segundo intento tras 10s más
                    setTimeout(async () => {
                      try {
                        const { data: { session: retry2 } } = await supabase.auth.getSession()
                        if (retry2?.user) {
                          console.log('✅ Sesión recuperada en segundo reintento')
                          setUser(retry2.user)
                        } else {
                          // Sesión realmente perdida — limpiar
                          console.log('👋 Sesión perdida tras 2 reintentos — limpiando')
                          updateUserProfile(null)
                          setUser(null)
                        }
                      } catch {
                        console.log('👋 Error en segundo reintento — limpiando')
                        updateUserProfile(null)
                        setUser(null)
                      }
                    }, 10_000)
                  }
                } catch {
                  // Network error en el reintento — mantener cache
                  console.warn('⚠️ Error de red en reintento — manteniendo perfil cacheado')
                }
              }, 5_000)
            } else {
              // Sin cache previo — usuario genuinamente no logueado
              updateUserProfile(null)
              // 🔧 FIX: Limpiar localStorage para evitar que pre-hydrate o el safety timeout
              // resuciten un usuario con token expirado (ghost user)
              // PERO NO en /auth/callback — ahí el code_verifier PKCE está en localStorage
              // y es necesario para completar el exchange del código OAuth
              const isCallbackPage = typeof window !== 'undefined' && window.location.pathname.includes('/auth/callback')
              if (!isCallbackPage) {
                try {
                  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
                  if (supabaseUrl) {
                    const storageKey = `sb-${supabaseUrl.split('://')[1]?.split('.')[0]}-auth`
                    localStorage.removeItem(storageKey)
                    console.log('🧹 localStorage limpiado (token expirado)')
                  }
                } catch {}
              }
            }
          }
          // Finalizar loading — este es el único punto que lo hace en carga inicial
          setLoading(false)
          setInitialized(true)
          clearTimeout(safetyTimeoutId)

        } else if (event === 'SIGNED_IN' || event === 'SIGNED_UP') {
          // === LOGIN / REGISTRO (post-INITIAL_SESSION) ===
          if (newUser) {
            // 📍 Tracking
            trackSessionIP(newUser.id)

            if (event === 'SIGNED_UP') {
              try { GoogleAdsEvents.SIGNUP('google_oauth') } catch {}
            }

            // 🆕 Campaign checkout
            if (shouldForceCheckout(newUser, supabase)) {
              setTimeout(() => {
                forceCampaignCheckout(newUser, supabase).catch(() => {})
              }, 1000)
            }

            // Cargar perfil si no lo tenemos y no hay carga en curso
            if (!userProfileRef.current || userProfileRef.current.id !== newUser.id) {
              if (profileLoadingRef.current) {
                // Ya hay una carga en curso (ej: INITIAL_SESSION), no interferir
                console.log('⏳ Perfil ya cargando, dejando que termine...')
              } else {
                setLoading(true)
                console.log('🔄 Cargando perfil post-login...')
                await loadUserProfile(newUser.id).then(loadedProfile => {
                  if (!loadedProfile) {
                    console.log('🆕 Perfil no encontrado, creando...')
                    return ensureUserProfile(newUser)
                  }
                  return undefined
                }).catch((err: any) => {
                  console.warn('⚠️ Error en flujo de perfil post-login:', err)
                })
                setLoading(false)
              }
            }
          }

        } else if (event === 'TOKEN_REFRESHED') {
          // === REFRESH DE TOKEN ===
          // Solo recargar perfil si no lo tenemos (ej: falló en INITIAL_SESSION)
          if (newUser && !userProfileRef.current) {
            console.log('🔄 TOKEN_REFRESHED: perfil no cargado, reintentando...')
            await loadUserProfile(newUser.id).catch((err: any) => {
              console.warn('⚠️ Error recargando perfil en TOKEN_REFRESHED:', err)
            })
          }

        } else if (event === 'SIGNED_OUT') {
          // === LOGOUT ===
          console.log('👋 SIGNED_OUT')
          setUser(null)
          updateUserProfile(null)
          setLoading(false)
        }

        // Disparar evento personalizado
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('authStateChanged', {
            detail: { event, user: newUser, profile: userProfileRef.current }
          }))
        }
      }
    )

    return () => {
      console.log('🧹 AuthProvider: Limpiando subscripción')
      subscription.unsubscribe()
      clearTimeout(safetyTimeoutId)
    }
  }, [initialUser])

  // 🆕 ESCUCHAR EVENTOS DE SINCRONIZACIÓN ENTRE PESTAÑAS
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleAuthSync = (event: Event) => {
      const { session, source, isIOSSafari } = (event as CustomEvent).detail

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
          updateUserProfile(null)
        }
      }
    }

    // Escuchar eventos de sincronización
    window.addEventListener('supabaseAuthSync', handleAuthSync)

    // Escuchar evento de perfil actualizado (desde página de perfil o post-pago)
    const handleProfileUpdated = () => {
      console.log('🔄 Perfil actualizado, forzando recarga...')
      if (user?.id) {
        updateUserProfile(null)
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
  const checkAccess = async (): Promise<AccessCheckResult> => {
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

      const result = (data as any)[0]

      return result

    } catch (error) {
      console.error('❌ Error en checkAccess:', error)
      return { can_access: false, user_type: 'error', message: 'Error en verificación' }
    }
  }

  // 🎯 NUEVA FUNCIÓN: Activar premium después del pago
  const activatePremium = async (stripeCustomerId: string): Promise<boolean> => {
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
  const signOut = async (): Promise<void> => {
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
      updateUserProfile(null)
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
      updateUserProfile(null)
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

  const refreshUser = async (): Promise<User | null> => {
    try {
      console.log('🔄 AuthProvider: Refrescando usuario...')
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      setUser(user)

      if (user) {
        // Forzar recarga del perfil (limpiar cache para que loadUserProfile no lo salte)
        console.log('🔄 Forzando recarga de perfil...')
        updateUserProfile(null)
        loadUserProfile(user.id).catch((err: any) => {
          console.warn('⚠️ Error refrescando perfil (no crítico):', err)
        })
      } else {
        updateUserProfile(null)
      }

      console.log('✅ AuthProvider: Usuario refrescado:', user?.email)
      return user
    } catch (error) {
      console.error('❌ AuthProvider: Error refrescando usuario:', error)
      setUser(null)
      updateUserProfile(null)
      return null
    }
  }

  // 🔒 CONTROL DE SESIONES SIMULTÁNEAS (solo para usuarios específicos)
  const {
    showWarning: showSessionWarning,
    sessions: conflictingSessions,
    isClosingOthers,
    closeOtherSessions
  } = useSessionControl(user, supabase)

  const [isLoggingOutFromWarning, setIsLoggingOutFromWarning] = useState(false)

  const handleLogoutFromWarning = async () => {
    setIsLoggingOutFromWarning(true)
    await signOut()
  }

  // 🎯 VALOR DEL CONTEXTO EXPANDIDO
  const value: AuthContextValue = {
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
        sessions={conflictingSessions}
        onCloseOthers={closeOtherSessions}
        onLogout={handleLogoutFromWarning}
        isClosingOthers={isClosingOthers}
        isLoggingOut={isLoggingOutFromWarning}
      />
    </AuthContext.Provider>
  )
}

// HOC actualizado para componentes que requieren autenticación
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
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
export function withPremium<P extends object>(Component: React.ComponentType<P>) {
  return function PremiumComponent(props: P) {
    const { user, userProfile, loading, checkAccess } = useAuth()
    const [accessLoading, setAccessLoading] = useState(true)
    const [canAccess, setCanAccess] = useState(false)
    const [accessInfo, setAccessInfo] = useState<AccessCheckResult | null>(null)

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
