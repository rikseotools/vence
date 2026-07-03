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

interface MintedToken {
  accessToken: string
  expiresAt: number
  /** Identidad devuelta por el bridge (cuando no hay sesión Auth.js todavía). */
  user: { id: string; email: string | null } | null
}

// ─── Bridge de sesión del cutover (Fase B) ──────────────────────────────────
// Al flipear a Auth.js, los usuarios ACTIVOS con sesión Supabase aún NO tienen
// sesión Auth.js → /api/auth/token daría 401 → sus /api/v2 caerían en masa (el flood
// de los intentos 2/3 del 03/07). Solución: leer el access_token Supabase de
// localStorage y ADJUNTARLO a /api/auth/token; el servidor (bridge) lo verifica
// (mode=on, HS256) y acuña un RS256 con sub=user_profiles.id, devolviendo también la
// identidad. Así buildSession devuelve una sesión CON usuario → el AuthProvider NO
// entra en su rama "sin usuario" (que borra localStorage) → cero flood, cero re-login.
// No parsea la sesión entera (solo el token), no pelea con el AuthProvider. Migra a
// Auth.js al re-loguear. Transitorio/removible cuando no queden sesiones Supabase.
function getLegacySupabaseAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      // La app usa un storageKey PERSONALIZADO `sb-<ref>-auth` (SIN sufijo -token,
      // ver lib/supabase.ts). Aceptamos también el `-token` por defecto de supabase-js.
      if (!k || !/^sb-.*-auth(-token)?$/.test(k)) continue
      const raw = window.localStorage.getItem(k)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const sess =
        parsed?.access_token ? parsed
        : parsed?.currentSession?.access_token ? parsed.currentSession
        : parsed?.session?.access_token ? parsed.session
        : null
      const token = sess?.access_token
      if (typeof token !== 'string' || !token) continue
      const expiresAt: number | null = typeof sess?.expires_at === 'number' ? sess.expires_at : null
      // Descartar expirado (10s margen): el servidor lo rechazaría igual → sin bridge → login.
      if (expiresAt !== null && expiresAt * 1000 < Date.now() + 10_000) continue
      return token
    }
  } catch {
    /* localStorage inaccesible / JSON malo → sin bridge */
  }
  return null
}

/**
 * Pide a /api/auth/token un access token RS256 fresco. En el cutover adjunta el Bearer
 * Supabase (si existe) para que el servidor haga el bridge. Devuelve token + identidad.
 */
async function fetchMintedToken(): Promise<MintedToken | null> {
  try {
    const legacy = getLegacySupabaseAccessToken()
    const headers: Record<string, string> = legacy ? { Authorization: `Bearer ${legacy}` } : {}
    const res = await fetch(TOKEN_ENDPOINT, { credentials: 'include', headers })
    if (!res.ok) return null
    const data = await res.json()
    if (typeof data?.accessToken !== 'string') return null
    return {
      accessToken: data.accessToken,
      expiresAt: data.expiresAt ?? null,
      user: data.user?.id ? { id: data.user.id, email: data.user.email ?? null } : null,
    }
  } catch {
    return null
  }
}

/**
 * Construye una AuthSession normalizada. Identidad: sesión Auth.js si la hay; si no
 * (usuario existente en el cutover), la que devuelve el bridge de /api/auth/token.
 */
async function buildSession(): Promise<AuthSession | null> {
  const [nextSession, minted] = await Promise.all([nextGetSession(), fetchMintedToken()])
  if (!minted) return null
  const user =
    mapUser(nextSession?.user) ??
    (minted.user
      ? { id: minted.user.id, email: minted.user.email, metadata: { fullName: null, avatarUrl: null }, raw: minted.user }
      : null)
  if (!user) return null
  return { user, accessToken: minted.accessToken, expiresAt: minted.expiresAt, refreshToken: null, raw: nextSession ?? { bridge: true } }
}

export function createAuthjsAuthAdapter(): AuthClientPort {
  return {
    async getSession() {
      // buildSession ya cae a la sesión Supabase existente si no hay Auth.js (cutover).
      return buildSession()
    },

    async getUser() {
      // buildSession ya resuelve la identidad por Auth.js o por el bridge (cutover).
      const s = await buildSession()
      return s?.user ?? null
    },

    async getAccessToken() {
      // fetchMintedToken adjunta el Bearer Supabase → el servidor hace el bridge si
      // aún no hay sesión Auth.js. Devuelve RS256 en ambos casos.
      const minted = await fetchMintedToken()
      return minted?.accessToken ?? undefined
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
        // buildSession cae a la sesión Supabase existente si no hay Auth.js (cutover).
        const session = await buildSession()
        const uid = session?.user?.id ?? null
        if (uid === lastUserId) return
        const first = lastUserId === undefined
        lastUserId = uid
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
