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
//
// ⚡ CACHÉ DEL TOKEN (fix flood /api/auth/token, 2026-07-15): el poll corre cada 5s
// pero el RS256 dura 1h → re-acuñarlo en cada tick generaba ~1,4M req/día a
// /api/auth/token (675k mints + 525k 401), enmascarado el 11/07 muestreando la
// telemetría (no arreglado). Ahora el token minteado se CACHEA (por instancia del
// adapter, que es singleton en prod) y se reusa hasta TOKEN_SKEW_SEC antes de
// expirar; un 401 aplica UNAUTH_BACKOFF_MS de espera (anónimos dejan de martillear).
// La detección de logout sigue viva: el poll re-verifica la sesión cuando el token
// caduca, y el broadcast de signOut invalida la caché en todas las pestañas al instante.

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
/**
 * Margen (segundos) antes de la expiración del RS256 para re-acuñarlo. Con TTL de 1h
 * y este margen de 5 min, un usuario activo acuña ~1 token/55min en vez de 1 cada 5s.
 */
const TOKEN_SKEW_SEC = 5 * 60
/** Tras un 401 (sin sesión), no volver a pedir token hasta pasado este backoff. Corta el
 *  martilleo de /api/auth/token de los visitantes ANÓNIMOS (que no tienen sesión). */
const UNAUTH_BACKOFF_MS = 60_000
/** Canal/clave para propagar el logout entre pestañas sin polling agresivo. */
const LOGOUT_BROADCAST_KEY = 'vence_auth_logout_at'
/**
 * Clave(s) de la sesión Supabase en localStorage. La app usa un storageKey
 * PERSONALIZADO `sb-<ref>-auth` (SIN sufijo -token, ver lib/supabase.ts);
 * aceptamos también el `-token` por defecto de supabase-js. Compartida entre el
 * LECTOR (bridge) y el BORRADO (signOut) para que no se desincronicen.
 */
const LEGACY_SB_KEY_RE = /^sb-.*-auth(-token)?$/

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
  /** epoch en SEGUNDOS en que expira (contrato de mintAccessToken). */
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
      if (!k || !LEGACY_SB_KEY_RE.test(k)) continue
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
 * Borra la sesión Supabase legacy de localStorage. IMPRESCINDIBLE en signOut bajo el
 * flip: si no se borra, el BRIDGE la relee en el siguiente getSession() y acuña un RS256
 * nuevo → el usuario se RE-LOGUEA solo tras "cerrar sesión". Al limpiarla, el bridge se
 * queda sin fuente → 401 → sesión null → SIGNED_OUT de verdad. Idempotente y defensivo
 * (recolecta las claves antes de borrar para no saltarse índices al mutar localStorage).
 */
function clearLegacySupabaseSession(): void {
  if (typeof window === 'undefined') return
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && LEGACY_SB_KEY_RE.test(k)) keys.push(k)
    }
    keys.forEach((k) => window.localStorage.removeItem(k))
  } catch {
    /* localStorage inaccesible → nada que limpiar */
  }
}

/**
 * Resultado DISCRIMINADO de acuñar el token. Distinguir estos casos es lo que evita
 * los deslogueos espurios: un 401 (sesión genuinamente inválida) SÍ debe desloguear,
 * pero un 5xx/red/timeout es un fallo TRANSITORIO del servidor y NUNCA debe hacerlo.
 */
type MintOutcome =
  | { status: 'ok'; token: MintedToken }
  | { status: 'unauthenticated' } // 401 — sesión inválida/caducada → logout legítimo
  | { status: 'transient' }       // 5xx / 429 / 503 / red / timeout → conservar sesión

/**
 * Pide a /api/auth/token un access token RS256 fresco. En el cutover adjunta el Bearer
 * Supabase (si existe) para que el servidor haga el bridge. Devuelve un resultado
 * discriminado: SOLO un 401 se considera "sin sesión"; cualquier otro fallo es
 * transitorio y el cliente debe mantener la sesión y reintentar en el próximo tick.
 */
async function fetchMintedToken(): Promise<MintOutcome> {
  try {
    const legacy = getLegacySupabaseAccessToken()
    const headers: Record<string, string> = legacy ? { Authorization: `Bearer ${legacy}` } : {}
    const res = await fetch(TOKEN_ENDPOINT, { credentials: 'include', headers })
    if (res.status === 401) return { status: 'unauthenticated' }
    // 5xx / 429 / 503 (emisor no configurado) / cualquier otro no-ok → transitorio.
    if (!res.ok) return { status: 'transient' }
    const data = await res.json().catch(() => null)
    // Respuesta malformada = hipo del servidor, NO ausencia de sesión → transitorio.
    if (!data || typeof data.accessToken !== 'string') return { status: 'transient' }
    return {
      status: 'ok',
      token: {
        accessToken: data.accessToken,
        expiresAt: data.expiresAt ?? null,
        user: data.user?.id ? { id: data.user.id, email: data.user.email ?? null } : null,
      },
    }
  } catch {
    // Error de red / timeout → transitorio (no desloguear).
    return { status: 'transient' }
  }
}

/** nextGetSession() puede fallar transitoriamente (red/servidor); tratarlo como
 * "no lo sé" (null) y dejar que el resultado del mint sea la autoridad, en vez de
 * romper el poll. */
async function nextGetSessionSafe() {
  try {
    return await nextGetSession()
  } catch {
    return null
  }
}

/** Estado de sesión discriminado, base del poll y de buildSession. */
type SessionPoll =
  | { status: 'ok'; session: AuthSession }
  | { status: 'unauthenticated' }
  | { status: 'transient' }

export function createAuthjsAuthAdapter(): AuthClientPort {
  // ── Caché POR INSTANCIA (el adapter es singleton en prod) ────────────────────
  // Dos capas: (1) el TOKEN minteado (para getAccessToken, sin exigir identidad); (2) la
  // SESIÓN completa (identidad + token, para el poll). Mientras el token siga válido (con
  // margen TOKEN_SKEW_SEC) se reusan SIN pegar a /api/auth/token ni /api/auth/session →
  // mata el flood. `unauthUntil` aplica backoff tras un 401 (anónimos dejan de martillear).
  // En TESTS el `expiresAt` suele ser del pasado → nada se cachea → comportamiento previo.
  let cachedMint: MintedToken | null = null
  let cachedMintExpMs = 0
  let cachedSession: AuthSession | null = null
  let unauthUntil = 0

  const now = () => Date.now()
  const mintFresh = () => cachedMint !== null && cachedMintExpMs - TOKEN_SKEW_SEC * 1000 > now()
  function resetCache() {
    cachedMint = null
    cachedMintExpMs = 0
    cachedSession = null
    unauthUntil = 0
  }

  /**
   * Token RS256 con caché: lo reusa mientras siga fresco; solo pega a /api/auth/token al
   * expirar, tras el backoff de 401, o si `force`. NO exige identidad (eso es del poll).
   */
  async function getMintedToken(force?: boolean): Promise<MintOutcome> {
    const t = now()
    if (!force) {
      if (mintFresh()) return { status: 'ok', token: cachedMint as MintedToken }
      if (cachedMint === null && t < unauthUntil) return { status: 'unauthenticated' }
    }
    const outcome = await fetchMintedToken()
    if (outcome.status === 'ok') {
      cachedMint = outcome.token
      // Cachear solo con expiración FUTURA (tests usan expiresAt pasado → no se cachea).
      cachedMintExpMs = typeof outcome.token.expiresAt === 'number' ? outcome.token.expiresAt * 1000 : 0
      unauthUntil = 0
    } else if (outcome.status === 'unauthenticated') {
      resetCache()
      unauthUntil = t + UNAUTH_BACKOFF_MS
    }
    // 'transient' → no tocar la caché (reintentar en el próximo tick)
    return outcome
  }

  /**
   * Resuelve el estado de sesión (identidad + token). Reusa la sesión cacheada mientras
   * el MISMO token siga vigente → el poll de 5s no vuelve a leer /api/auth/session. Solo
   * al refrescar el token se re-lee la identidad. Propaga transitorio/401.
   */
  async function pollSession(opts?: { force?: boolean }): Promise<SessionPoll> {
    const t = now()
    const mint = await getMintedToken(opts?.force)
    if (mint.status === 'transient') return { status: 'transient' } // conservar caché
    if (mint.status === 'unauthenticated') return { status: 'unauthenticated' }
    const minted = mint.token
    // Token vigente + sesión cacheada del MISMO token → reusar identidad sin nextGetSession.
    if (!opts?.force && cachedSession && cachedSession.accessToken === minted.accessToken) {
      return { status: 'ok', session: cachedSession }
    }
    const nextSession = await nextGetSessionSafe()
    const user =
      mapUser(nextSession?.user) ??
      (minted.user
        ? { id: minted.user.id, email: minted.user.email, metadata: { fullName: null, avatarUrl: null }, raw: minted.user }
        : null)
    // Token válido pero sin identidad resoluble = sesión inservible → sign out.
    if (!user) {
      resetCache()
      unauthUntil = t + UNAUTH_BACKOFF_MS
      return { status: 'unauthenticated' }
    }
    const session: AuthSession = {
      user,
      accessToken: minted.accessToken,
      expiresAt: minted.expiresAt,
      refreshToken: null,
      raw: nextSession ?? { bridge: true },
    }
    cachedSession = session
    return { status: 'ok', session }
  }

  /**
   * Construye una AuthSession normalizada (AuthSession | null) para los callers one-shot
   * (getSession/getUser/completeOAuthCallback). Un fallo transitorio o un 401 devuelven
   * null; el poll (onAuthStateChange) usa pollSession directamente para NO desloguear ante
   * transitorios.
   */
  async function buildSession(opts?: { force?: boolean }): Promise<AuthSession | null> {
    const res = await pollSession(opts)
    return res.status === 'ok' ? res.session : null
  }

  // Logout cross-pestaña: signOut escribe LOGOUT_BROADCAST_KEY → las demás pestañas
  // reciben el evento `storage`, invalidan su caché y re-verifican en el próximo tick
  // (detección de logout en <5s sin polling agresivo).
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === LOGOUT_BROADCAST_KEY) resetCache()
    })
  }

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
      // Reusa el token cacheado (válido) o acuña uno fresco; el bridge adjunta el Bearer
      // Supabase server-side. NO exige identidad (solo el Bearer). Ante 401/transitorio →
      // undefined (el caller reintenta o el fetch cae en su manejo de 401).
      const m = await getMintedToken()
      return m.status === 'ok' ? m.token.accessToken : undefined
    },

    async signInWithGoogle(options?: SignInOptions): Promise<SignInResult> {
      try {
        // callbackUrl explícito del caller (páginas de login: lleva return_to +
        // oposición + campaña + funnel embebidos) → preserva el routing/tracking.
        // Si no lo pasan, la página actual como default.
        const callbackUrl =
          options?.callbackUrl ??
          (typeof window !== 'undefined' ? window.location.href : '/')
        await nextSignIn('google', { callbackUrl })
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'sign_in_failed' }
      }
    },

    async signInWithIdToken(args: SignInWithIdTokenArgs): Promise<IdTokenSignInResult> {
      // Google One Tap (id_token) portado al flip Auth.js: `nextSignIn` con el
      // provider Credentials `google-one-tap` verifica el id_token server-side
      // (firma JWKS + aud + iss + exp + nonce + email_verified) y establece la
      // sesión Auth.js; luego se relee. El RS256 lo acuña `/api/auth/token`.
      try {
        const res = await nextSignIn('google-one-tap', {
          id_token: args.token,
          nonce: args.nonce ?? '',
          redirect: false,
        })
        if (res?.error) return { session: null, user: null, error: res.error }
        // Sesión recién creada → forzar refresco (ignorar cualquier caché anónima previa).
        resetCache()
        const session = await buildSession({ force: true })
        if (!session?.user) return { session: null, user: null, error: 'no_session' }
        return { session, user: session.user }
      } catch (e) {
        return { session: null, user: null, error: (e as Error)?.message || 'one_tap_failed' }
      }
    },

    async completeOAuthCallback() {
      // Auth.js ya resolvió el callback server-side (set-cookie + redirect); aquí
      // solo se relee la sesión. Sin PKCE/locks/localStorage (eso era de Supabase).
      // Force: la sesión acaba de crearse, no reusar caché anónima previa.
      resetCache()
      return buildSession({ force: true })
    },

    async signOut() {
      // Bajo el flip, cerrar la sesión Auth.js NO basta: la sesión Supabase legacy
      // sigue en localStorage y el bridge la re-hidrataría → auto-relogin. Borrarla es
      // parte del contrato de signOut durante el cutover (transitorio como el bridge).
      resetCache()
      clearLegacySupabaseSession()
      // Avisar a las otras pestañas para que invaliden su caché al instante.
      if (typeof window !== 'undefined') {
        try { window.localStorage.setItem(LOGOUT_BROADCAST_KEY, String(Date.now())) } catch { /* ignore */ }
      }
      await nextSignOut({ redirect: false })
    },

    async refreshSession() {
      // No hay refresh de sesión Auth.js del lado cliente; re-acuñar el token
      // (que /api/auth/token deriva de la cookie vigente) cumple el contrato. `force`
      // para que un refresh explícito del caller (authHeaders) sí vaya a la red.
      return buildSession({ force: true })
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
        const res = await pollSession()
        // Fallo TRANSITORIO (5xx/red/timeout): NO tocar el estado — conservar la última
        // sesión conocida y reintentar en el siguiente tick. Esto elimina el auto-logout
        // espurio por hipos del servidor / saturación de BD / token caducado tras
        // inactividad (la cookie Auth.js de 30d sigue válida y re-acuña al reintentar).
        if (res.status === 'transient') return
        const session = res.status === 'ok' ? res.session : null
        const uid = session?.user?.id ?? null
        if (uid === lastUserId) return
        const first = lastUserId === undefined
        lastUserId = uid
        // Solo se llega aquí con 'ok' (uid) o 'unauthenticated' (uid=null, 401 real).
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
