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

// ─── Fallback de sesión del cutover (Fase B) ────────────────────────────────
// Al flipear a Auth.js, los usuarios ACTIVOS con sesión Supabase (localStorage) aún
// NO tienen sesión Auth.js → /api/auth/token daría 401 y sus /api/v2 caerían en masa
// (el flood del 2º intento del 03/07). En vez de forzar re-login (redirect disruptivo
// = el bootstrap anterior), leemos su sesión Supabase existente y la usamos como
// fallback: el token HS256 lo verifica igual `mode=on` (rama HS256 de verifyAuth), así
// que el usuario NO pierde acceso. Migra a Auth.js de forma natural al re-loguear o
// cuando su sesión Supabase caduque (~1h). Transitorio y removible cuando ya no queden
// sesiones Supabase vivas.
interface LegacySupabaseSession {
  user: AuthUser
  accessToken: string
  expiresAt: number | null
}

function getLegacySupabaseSession(): LegacySupabaseSession | null {
  if (typeof window === 'undefined') return null
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k || !/^sb-.*-auth-token$/.test(k)) continue
      const raw = window.localStorage.getItem(k)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      // supabase-js guarda la sesión directa {access_token,...} o anidada.
      const sess =
        parsed?.access_token ? parsed
        : parsed?.currentSession?.access_token ? parsed.currentSession
        : parsed?.session?.access_token ? parsed.session
        : null
      const token = sess?.access_token
      if (typeof token !== 'string' || !token) continue
      const expiresAt: number | null = typeof sess?.expires_at === 'number' ? sess.expires_at : null
      // Descartar si expirado (10s de margen) → sin fallback → getSession null → login.
      if (expiresAt !== null && expiresAt * 1000 < Date.now() + 10_000) continue
      const su = sess?.user
      if (!su?.id) continue
      return {
        user: {
          id: su.id, // = user_profiles.id (mismo UUID en Supabase)
          email: su.email ?? null,
          metadata: {
            fullName: su.user_metadata?.full_name ?? su.user_metadata?.name ?? null,
            avatarUrl: su.user_metadata?.avatar_url ?? null,
          },
          raw: su,
        },
        accessToken: token,
        expiresAt,
      }
    }
  } catch {
    /* localStorage inaccesible / JSON malo → sin fallback */
  }
  return null
}

/**
 * Construye una AuthSession normalizada. Preferencia: sesión Auth.js (RS256). Si aún
 * no la hay (usuario existente en el cutover), cae a la sesión Supabase (HS256).
 */
async function buildSession(): Promise<AuthSession | null> {
  const [nextSession, minted] = await Promise.all([nextGetSession(), fetchMintedToken()])
  const user = mapUser(nextSession?.user)
  if (user && minted) {
    return { user, accessToken: minted.accessToken, expiresAt: minted.expiresAt, refreshToken: null, raw: nextSession }
  }
  const legacy = getLegacySupabaseSession()
  if (legacy) {
    return { user: legacy.user, accessToken: legacy.accessToken, expiresAt: legacy.expiresAt, refreshToken: null, raw: { legacy: true } }
  }
  return null
}

export function createAuthjsAuthAdapter(): AuthClientPort {
  return {
    async getSession() {
      // buildSession ya cae a la sesión Supabase existente si no hay Auth.js (cutover).
      return buildSession()
    },

    async getUser() {
      const nextSession = await nextGetSession()
      return mapUser(nextSession?.user) ?? getLegacySupabaseSession()?.user ?? null
    },

    async getAccessToken() {
      const minted = await fetchMintedToken()
      if (minted?.accessToken) return minted.accessToken
      // Cutover: sin token Auth.js todavía → usar el token Supabase (verificado por mode=on).
      return getLegacySupabaseSession()?.accessToken ?? undefined
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
