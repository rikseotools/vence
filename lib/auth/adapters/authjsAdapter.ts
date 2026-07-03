// lib/auth/adapters/authjsAdapter.ts — Adapter de Auth.js (NextAuth v5) para el
// AuthClientPort (Fase B2). Segundo adapter que prueba la agnosticidad del puerto.
//
// DORMIDO: solo se instancia si `AUTH_PROVIDER=authjs` en lib/auth/client.ts
// (default = supabaseAdapter). Se activa en el flip de Fase B, tras validar el
// pipeline RS256 en shadow + registrar el redirect URI en Google Cloud Console.
//
// Modelo (a diferencia de Supabase):
//   - La SESIÓN (identidad) la lleva Auth.js: cookie cifrada + `/api/auth/session`
//     (leído con `getSession()` de next-auth/react). `session.user.id` =
//     user_profiles.id (lo fija el callback `jwt`/`session` de lib/auth/authjs.ts).
//   - El ACCESS TOKEN (Bearer para /api/v2/* y api.vence.es) NO vive en la cookie:
//     lo acuña `/api/auth/token` en RS256 a demanda → separación limpia, sin JWE.
//   - El callback OAuth lo resuelve Auth.js server-side (route /api/auth/callback);
//     `completeOAuthCallback()` solo relee la sesión (sin PKCE/locks/localStorage).
//   - No hay listener nativo de cambios fuera de React → `onAuthStateChange` se
//     emula con polling ligero de `getSession()` (mismo patrón que la migración
//     de Realtime→polling del proyecto).

import {
  signIn as nextSignIn,
  signOut as nextSignOut,
  getSession as nextGetSession,
} from 'next-auth/react'
import type {
  AuthChange,
  AuthClientPort,
  AuthSession,
  AuthUser,
  IdTokenSignInResult,
  SignInOptions,
  SignInResult,
  SignInWithIdTokenArgs,
} from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NextSessionUser = any

const TOKEN_ENDPOINT = '/api/auth/token'
/** Cada cuánto se sondea la sesión para emular onAuthStateChange. */
const POLL_INTERVAL_MS = 5000

function mapUser(u: NextSessionUser): AuthUser | null {
  if (!u) return null
  return {
    id: u.id ?? '', // user_profiles.id (lo pone el callback session de authjs.ts)
    email: u.email ?? null,
    metadata: {
      fullName: u.name ?? null,
      avatarUrl: u.image ?? null,
    },
    raw: u,
  }
}

/** Pide a /api/auth/token un access token RS256 fresco. null si no hay sesión. */
async function fetchMintedToken(): Promise<{ accessToken: string; expiresAt: number } | null> {
  try {
    const res = await fetch(TOKEN_ENDPOINT, { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    if (typeof data?.accessToken !== 'string') return null
    return { accessToken: data.accessToken, expiresAt: data.expiresAt ?? null }
  } catch {
    return null
  }
}

/** Construye una AuthSession normalizada = identidad (Auth.js) + token (mint). */
async function buildSession(): Promise<AuthSession | null> {
  const [nextSession, minted] = await Promise.all([nextGetSession(), fetchMintedToken()])
  const user = mapUser(nextSession?.user)
  if (!user || !minted) return null
  return {
    user,
    accessToken: minted.accessToken,
    expiresAt: minted.expiresAt,
    refreshToken: null,
    raw: nextSession,
  }
}

// ─── Bootstrap silencioso del cutover (Fase B) ──────────────────────────────
// Al flipear a Auth.js, los usuarios con sesión Supabase (cookie/localStorage) NO
// tienen sesión Auth.js → /api/auth/token daría 401 y aparecerían "deslogueados".
// Si detectamos su sesión Supabase residual y aún no hay sesión Auth.js, disparamos
// signIn('google') UNA vez: como el usuario ya autorizó Google, normalmente vuelve
// sin pantalla de consentimiento (bootstrap transparente). Transitorio y removible
// pasada la ventana de cutover (cuando ya nadie tenga sesión Supabase vieja).
const LEGACY_BOOTSTRAP_FLAG = 'authjs_legacy_bootstrap_attempted'

function hasLegacySupabaseSession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && /^sb-.*-auth-token$/.test(k) && window.localStorage.getItem(k)) return true
    }
  } catch {
    /* localStorage inaccesible (SSR/privacy) → no bootstrap */
  }
  return false
}

/**
 * Dispara el bootstrap si procede. Idempotente (flag en sessionStorage) para no
 * entrar en bucle si Google vuelve sin crear sesión. No interfiere con las propias
 * rutas de Auth.js (/api/auth/*). Devuelve true si disparó el redirect.
 */
function maybeBootstrapFromLegacySession(): boolean {
  if (typeof window === 'undefined') return false
  if (window.location.pathname.startsWith('/api/auth')) return false
  try {
    if (window.sessionStorage.getItem(LEGACY_BOOTSTRAP_FLAG)) return false
  } catch {
    return false
  }
  if (!hasLegacySupabaseSession()) return false
  try {
    window.sessionStorage.setItem(LEGACY_BOOTSTRAP_FLAG, '1')
  } catch {
    /* si no podemos marcar el intento, no disparamos (evita bucle) */
    return false
  }
  void nextSignIn('google', { callbackUrl: window.location.href })
  return true
}

export function createAuthjsAuthAdapter(): AuthClientPort {
  return {
    async getSession() {
      const nextSession = await nextGetSession()
      if (!mapUser(nextSession?.user)) {
        // Sin sesión Auth.js → bootstrap silencioso desde sesión Supabase vieja (cutover).
        maybeBootstrapFromLegacySession()
        return null
      }
      return buildSession()
    },

    async getUser() {
      const nextSession = await nextGetSession()
      return mapUser(nextSession?.user)
    },

    async getAccessToken() {
      const minted = await fetchMintedToken()
      return minted?.accessToken
    },

    async signInWithGoogle(options?: SignInOptions): Promise<SignInResult> {
      try {
        // El callbackUrl (retorno post-login) sale de la página actual. El funnel
        // premium (return_to con start_checkout + campaign) es la deuda C2 —
        // se honra al cablear los callers, no aquí.
        const callbackUrl =
          typeof window !== 'undefined' ? window.location.href : '/'
        void options // funnel (C2) se honra al cablear los callers, no aquí
        await nextSignIn('google', { callbackUrl })
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'sign_in_failed' }
      }
    },

    async signInWithIdToken(_args: SignInWithIdTokenArgs): Promise<IdTokenSignInResult> {
      // Google One Tap (id_token) con Auth.js exige un provider Credentials/id_token
      // dedicado → se resuelve al cablear GoogleOneTap en el flip. DORMIDO.
      return { session: null, user: null, error: 'id_token_sign_in_not_enabled' }
    },

    async completeOAuthCallback() {
      // Auth.js ya resolvió el callback server-side (set-cookie + redirect); aquí
      // solo se relee la sesión. Sin PKCE/locks/localStorage (eso era de Supabase).
      return buildSession()
    },

    async signOut() {
      await nextSignOut({ redirect: false })
    },

    async refreshSession() {
      // No hay refresh de sesión Auth.js del lado cliente; re-acuñar el token
      // (que /api/auth/token deriva de la cookie vigente) cumple el contrato.
      return buildSession()
    },

    async updateUser(_attrs: Record<string, unknown>) {
      // Auth.js OAuth no expone updateUser de cliente; los perfiles se editan por
      // endpoints propios. Devolver el usuario actual (no-op) sin romper callers.
      const nextSession = await nextGetSession()
      return mapUser(nextSession?.user)
    },

    onAuthStateChange(cb: (change: AuthChange) => void) {
      let stopped = false
      let lastUserId: string | null | undefined = undefined

      const tick = async () => {
        if (stopped) return
        const nextSession = await nextGetSession()
        const uid = nextSession?.user?.id ?? null
        if (uid === lastUserId) return
        const first = lastUserId === undefined
        lastUserId = uid
        const session = uid ? await buildSession() : null
        // Cutover Fase B: en el primer tick sin sesión Auth.js, intentar bootstrap
        // desde la sesión Supabase vieja (idempotente por el flag de sessionStorage).
        if (!uid && first) maybeBootstrapFromLegacySession()
        const event = first ? 'INITIAL_SESSION' : uid ? 'SIGNED_IN' : 'SIGNED_OUT'
        cb({ event, session, isNewUser: false })
      }

      void tick()
      const interval = setInterval(() => void tick(), POLL_INTERVAL_MS)
      return () => {
        stopped = true
        clearInterval(interval)
      }
    },
  }
}
