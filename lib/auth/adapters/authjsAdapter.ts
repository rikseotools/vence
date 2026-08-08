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
// expirar; un 401 aplica el backoff de `backoffAcunado` (60 s a los anónimos, que son los que
// martilleaban; 2 s a quien tiene sesión, o el freno se convierte en el fallo — ver [T-671]).
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
import { isBearerFresh, TOKEN_SKEW_SEC } from '../tokenFreshness'
import { clearLegacySupabaseSession, esClaveSesionLegacy } from '../legacySupabaseStorage'
import { deriveMintReason, MINT_REASON_HEADER, type MintReason } from '../mintReason'
import { backoffTrasUnauth, puedeIntentarAcunar } from '../backoffAcunado'
import { safeGet, safeSet } from '@/lib/storage/safeLocalStorage'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NextSessionUser = any

const TOKEN_ENDPOINT = '/api/auth/token'
/** Cada cuánto se sondea la sesión para emular onAuthStateChange. */
const POLL_INTERVAL_MS = 5000
// El margen antes de la expiración para re-acuñar (`TOKEN_SKEW_SEC`, 5 min) ya NO se
// define aquí: vive en el núcleo puro `../tokenFreshness`, compartido con el adapter de
// Supabase. Tenerlo por duplicado fue el origen de T-210 (dos criterios de "¿hay que ir
// a la red?" conviviendo, y el otro ni miraba la expiración).
// El backoff tras un 401 ya NO se define aquí: vive en el núcleo puro `../backoffAcunado`,
// porque su duración DEPENDE de si el cliente tiene sesión (60 s anónimo / 2 s dentro) y ese
// criterio hay que poder probarlo sin levantar el adapter ([T-671]).
/** Canal/clave para propagar el logout entre pestañas sin polling agresivo. */
const LOGOUT_BROADCAST_KEY = 'vence_auth_logout_at'
// La clave de la sesión legacy y su borrado viven en `lib/auth/legacySupabaseStorage.ts`:
// el criterio estaba escrito aquí y OTRA VEZ (distinto) en AuthContext, y el rastro que una
// rama no borraba era justo el que resucitaba al usuario en la siguiente carga [T-434].

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
  /** epoch en SEGUNDOS en que expira (contrato de mintAccessToken), o null si no vino. */
  expiresAt: number | null
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
      if (!esClaveSesionLegacy(k)) continue
      const raw = safeGet(k)
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
async function fetchMintedToken(reason: MintReason = 'desconocido'): Promise<MintOutcome> {
  try {
    const legacy = getLegacySupabaseAccessToken()
    const headers: Record<string, string> = legacy ? { Authorization: `Bearer ${legacy}` } : {}
    // POR QUÉ acuñamos. El servidor no puede saberlo (solo ve la petición), y sin este dato
    // el 61% del desperdicio que quedó tras T-210 no se pudo explicar — hubo que conjeturar.
    // Va en cabecera, no en query, para no cambiar la clave de caché del endpoint.
    headers[MINT_REASON_HEADER] = reason
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
  let cachedSession: AuthSession | null = null
  let unauthUntil = 0
  /**
   * ¿Este contexto JS ha acuñado alguna vez? Solo sirve para etiquetar el MOTIVO (T-210), y a
   * propósito **sobrevive a `resetCache()`**: si se reseteara, una caché invalidada se
   * contaría como «carga inicial» y las dos causas —el suelo del sistema (la caché nace vacía
   * en cada carga de página) y algo que está tirando la caché— quedarían indistinguibles.
   */
  let yaAcuñoAlgunaVez = false
  /**
   * ¿Este navegador ha tenido sesión en algún momento de esta carga? Igual que
   * `yaAcuñoAlgunaVez`, **sobrevive a `resetCache()`** a propósito: `resetCache` corre justo
   * cuando el acuñado devuelve 401, así que si se borrara aquí perderíamos el único dato que
   * distingue «anónimo que martillea» de «usuario dentro al que se le cayó el token» — que es
   * exactamente la distinción que decide cuánto callar ([T-671]). Lo apaga el logout, que es
   * el único momento en que deja de ser cierto.
   */
  let huboSesionAlgunaVez = false

  const now = () => Date.now()
  // Frescura por el núcleo puro compartido (misma regla que el adapter de Supabase).
  // Sin `expiresAt` → NO fresco → se re-acuña (en TESTS el expiresAt suele ser pasado o
  // ausente, así que nada se cachea y el comportamiento observado no cambia).
  const mintFresh = () =>
    cachedMint !== null && isBearerFresh(cachedMint.expiresAt, now(), TOKEN_SKEW_SEC)
  function resetCache() {
    cachedMint = null
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
      // [T-671] El silencio tras un 401 lo decide el núcleo puro `backoffAcunado`, y su
      // duración depende de si este cliente TIENE sesión: 60 s para un anónimo (que es para
      // quien se puso el freno) y 2 s para quien está dentro. Antes eran 60 s para todos, y en
      // ese minuto cada petición salía sin `Authorization` — el usuario veía sus estadísticas
      // a 0 y no podía corregir su examen sin que nada lo intentara siquiera.
      if (!puedeIntentarAcunar({
        hayCache: cachedMint !== null,
        ahora: t,
        silencioHasta: unauthUntil,
        haySesionConocida: huboSesionAlgunaVez,
      })) {
        return { status: 'unauthenticated' }
      }
    }
    // Se calcula ANTES de acuñar, con el estado que motivó la decisión (después ya está
    // pisado). `acuñoAntes` es lo que separa el SUELO del sistema (carga de página: la caché
    // vive en memoria y nace vacía) de una caché que alguien está tirando — dos problemas
    // distintos que sin este dato se ven iguales. Ver lib/auth/mintReason.ts.
    const reason = deriveMintReason({
      forzado: Boolean(force),
      hayCache: cachedMint !== null,
      acuñoAntes: yaAcuñoAlgunaVez,
    })
    const outcome = await fetchMintedToken(reason)
    if (outcome.status === 'ok') {
      cachedMint = outcome.token
      yaAcuñoAlgunaVez = true
      huboSesionAlgunaVez = true
      unauthUntil = 0
    } else if (outcome.status === 'unauthenticated') {
      resetCache()
      unauthUntil = t + backoffTrasUnauth(huboSesionAlgunaVez)
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
      unauthUntil = t + backoffTrasUnauth(huboSesionAlgunaVez)
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
    // También aquí: hay identidad resuelta aunque el token venga del bridge. Es el otro
    // camino por el que se sabe que este navegador NO es un anónimo ([T-671]).
    huboSesionAlgunaVez = true
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
      // El único momento en que deja de ser cierto que este navegador tiene sesión. Sin
      // apagarlo aquí, un usuario que cierra sesión seguiría con el backoff corto de los
      // autenticados y volvería a martillear /api/auth/token, que es lo que el freno evita.
      huboSesionAlgunaVez = false
      clearLegacySupabaseSession()
      // Avisar a las otras pestañas para que invaliden su caché al instante.
      if (typeof window !== 'undefined') {
        safeSet(LOGOUT_BROADCAST_KEY, String(Date.now()))
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
