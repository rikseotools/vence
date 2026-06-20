// lib/auth/adapters/supabaseAdapter.ts — Adapter de Supabase para el AuthClientPort.
// ENVUELVE el singleton existente getSupabaseClient() (lib/supabase.ts) — que sigue
// siendo la única fuente del cliente (PKCE, persistSession, listeners tab-sync/visibility,
// eventos custom, fixes iOS/Android). Aquí solo se traduce su superficie auth a tipos
// agnósticos. Cambiar de proveedor = escribir otro adapter y cambiar la fábrica en client.ts.
import { getSupabaseClient, signInWithGoogle as supabaseSignInWithGoogle } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import type {
  AuthChange,
  AuthClientPort,
  AuthEvent,
  AuthSession,
  AuthUser,
  IdTokenSignInResult,
  SignInOptions,
  SignInWithIdTokenArgs,
} from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawUser = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawSession = any

function mapUser(u: RawUser): AuthUser | null {
  if (!u) return null
  return {
    id: u.id,
    email: u.email ?? null,
    metadata: {
      fullName: u.user_metadata?.full_name ?? null,
      avatarUrl: u.user_metadata?.avatar_url ?? null,
    },
    raw: u,
  }
}

function mapSession(s: RawSession): AuthSession | null {
  if (!s) return null
  const user = mapUser(s.user)
  if (!user) return null
  return {
    user,
    accessToken: s.access_token,
    expiresAt: s.expires_at ?? null,
    refreshToken: s.refresh_token ?? null,
    raw: s,
  }
}

// Mapea el zoo de eventos de Supabase a los eventos normalizados del port.
// SIGNED_UP (si el proveedor lo emitiera) colapsa a SIGNED_IN + isNewUser=true.
const EVENT_MAP: Record<string, AuthEvent | undefined> = {
  INITIAL_SESSION: 'INITIAL_SESSION',
  SIGNED_IN: 'SIGNED_IN',
  SIGNED_UP: 'SIGNED_IN',
  SIGNED_OUT: 'SIGNED_OUT',
  TOKEN_REFRESHED: 'TOKEN_REFRESHED',
  USER_UPDATED: 'USER_UPDATED',
  PASSWORD_RECOVERY: 'PASSWORD_RECOVERY',
}

// Adquiere la sesión tras el callback OAuth. Encapsula el workaround de Supabase
// (PKCE + navigator.locks): exchangeCodeForSession deadlockea con _acquireLock en
// iOS/Android, así que esperamos por TRES canales en paralelo y nos quedamos con
// el primero que dé sesión. Portado 1:1 de app/auth/callback/page.tsx — toda esta
// mecánica Supabase-específica vive aquí, fuera de la página. Devuelve la sesión
// CRUDA (la mapea el caller) o null si no llega en 15s.
async function acquireOAuthCallbackSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sbClient: any,
): Promise<RawSession | null> {
  if (typeof window === 'undefined') return null
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null
  const storageKey = `sb-${supabaseUrl.split('://')[1]?.split('.')[0]}-auth`

  // Limpiar sesión expirada en localStorage antes de esperar la nueva (evita
  // que un token viejo dispare lock contention en el SDK).
  try {
    const existingRaw = localStorage.getItem(storageKey)
    if (existingRaw) {
      const existing = JSON.parse(existingRaw)
      if (existing?.expires_at && existing.expires_at * 1000 < Date.now()) {
        localStorage.removeItem(storageKey)
      }
    }
  } catch {
    /* ignore */
  }

  const SESSION_TIMEOUT_MS = 15000
  const POLL_INTERVAL_MS = 150
  const DIRECT_PKCE_DELAY_MS = 3000

  return new Promise<RawSession | null>((resolve) => {
    let resolved = false
    let authSubscription: { unsubscribe: () => void } | null = null
    let interval: ReturnType<typeof setInterval>
    let timeout: ReturnType<typeof setTimeout>
    let directPkceTimeout: ReturnType<typeof setTimeout>

    const finish = (sess: RawSession | null) => {
      if (resolved) return
      resolved = true
      clearInterval(interval)
      clearTimeout(timeout)
      clearTimeout(directPkceTimeout)
      authSubscription?.unsubscribe()
      resolve(sess)
    }

    // Canal 1: onAuthStateChange (cuando _initialize() del SDK resuelve).
    try {
      const { data } = sbClient.auth.onAuthStateChange(
        (_event: string, authSession: RawSession) => {
          if (authSession?.access_token && authSession.user) finish(authSession)
        },
      )
      authSubscription = data.subscription
    } catch {
      /* ignore */
    }

    // Canal 3: intercambio PKCE directo via HTTP a los 3s (bypass navigator.locks
    // si _initialize() se cuelga). Lee el code_verifier que el SDK dejó en storage.
    const urlCode =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('code')
        : null
    directPkceTimeout = setTimeout(async () => {
      if (resolved || !urlCode) return
      try {
        const codeVerifierKey = `${storageKey}-code-verifier`
        const codeVerifier = localStorage.getItem(codeVerifierKey)
        if (!codeVerifier) return
        const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          },
          body: JSON.stringify({ auth_code: urlCode, code_verifier: codeVerifier }),
        })
        if (!response.ok) return
        const tokenData = await response.json()
        if (tokenData?.access_token && tokenData?.user) {
          // Persistir para que el SDK lo detecte y limpiar el verifier usado.
          localStorage.setItem(storageKey, JSON.stringify(tokenData))
          localStorage.removeItem(codeVerifierKey)
          finish(tokenData)
        }
      } catch {
        /* ignore */
      }
    }, DIRECT_PKCE_DELAY_MS)

    // Fallback final a los 15s: un getSession() y, si tampoco, null.
    timeout = setTimeout(async () => {
      if (resolved) return
      clearInterval(interval)
      authSubscription?.unsubscribe()
      try {
        const { data } = await sbClient.auth.getSession()
        if (data?.session?.access_token && data.session.user) {
          finish(data.session)
          return
        }
      } catch {
        /* ignore */
      }
      finish(null)
    }, SESSION_TIMEOUT_MS)

    // Canal 2: polling de localStorage (sin locks).
    interval = setInterval(() => {
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed?.access_token && parsed?.user) finish(parsed)
        }
      } catch {
        /* JSON parse error — seguir polling */
      }
    }, POLL_INTERVAL_MS)

    // Check inmediato por si la sesión ya está en storage.
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.access_token && parsed?.user) finish(parsed)
      }
    } catch {
      /* ignore */
    }
  })
}

export function createSupabaseAuthAdapter(): AuthClientPort {
  // Acceso perezoso al singleton: no se instancia en import-time (client-only).
  const sb = () => getSupabaseClient()

  return {
    async getSession() {
      const { data } = await sb().auth.getSession()
      return mapSession(data.session)
    },

    async getUser() {
      const { data } = await sb().auth.getUser()
      return mapUser(data.user)
    },

    async getAccessToken() {
      // Delega en getAuthHeaders() — conserva el singleflight + cooldown 30s anti-429.
      const headers = await getAuthHeaders()
      const authz = headers['Authorization']
      return authz?.startsWith('Bearer ') ? authz.slice('Bearer '.length) : undefined
    },

    signInWithGoogle(options?: SignInOptions) {
      return supabaseSignInWithGoogle(options ?? {})
    },

    async signInWithIdToken(args: SignInWithIdTokenArgs): Promise<IdTokenSignInResult> {
      const { data, error } = await sb().auth.signInWithIdToken({
        provider: args.provider,
        token: args.token,
        nonce: args.nonce,
      })
      if (error) return { session: null, user: null, error: error.message }
      return { session: mapSession(data.session), user: mapUser(data.user) }
    },

    async completeOAuthCallback() {
      const raw = await acquireOAuthCallbackSession(sb())
      return mapSession(raw)
    },

    async signOut() {
      await sb().auth.signOut()
    },

    async refreshSession() {
      const { data } = await sb().auth.refreshSession()
      return mapSession(data.session)
    },

    async updateUser(attrs: Record<string, unknown>) {
      const { data } = await sb().auth.updateUser(attrs)
      return mapUser(data.user)
    },

    onAuthStateChange(cb: (change: AuthChange) => void) {
      const { data } = sb().auth.onAuthStateChange((rawEvent: string, session: RawSession) => {
        const event = EVENT_MAP[rawEvent]
        if (!event) return // ignora eventos no soportados por el port
        cb({ event, session: mapSession(session), isNewUser: rawEvent === 'SIGNED_UP' })
      })
      return () => data.subscription.unsubscribe()
    },
  }
}
