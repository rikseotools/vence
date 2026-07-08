// __tests__/lib/auth/authjsAdapter.test.ts
// Tests del adapter Auth.js (Fase B2). Mockea next-auth/react (evita su ESM) y fetch
// (/api/auth/token). Verifica el mapeo del puerto, el token, y el BRIDGE del cutover
// (sin sesión Auth.js + token Supabase en localStorage → el servidor acuña RS256).

const mockSignIn = jest.fn()
const mockSignOut = jest.fn()
const mockGetSession = jest.fn()

jest.mock('next-auth/react', () => ({
  signIn: (...a: unknown[]) => mockSignIn(...a),
  signOut: (...a: unknown[]) => mockSignOut(...a),
  getSession: (...a: unknown[]) => mockGetSession(...a),
}))

import { createAuthjsAuthAdapter } from '@/lib/auth/adapters/authjsAdapter'

const APP_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

/** Configura la respuesta de /api/auth/token en función del request (headers).
 * `status` modela el código HTTP: por defecto 200 si ok, 401 si no (sesión inválida).
 * Para simular un fallo TRANSITORIO del servidor, devolver `{ ok: false, status: 503 }`. */
function setTokenEndpoint(
  fn: (url: string, init?: RequestInit) => { ok: boolean; body?: unknown; status?: number },
) {
  ;(global.fetch as jest.Mock).mockImplementation(async (url: string, init?: RequestInit) => {
    const { ok, body, status } = fn(url, init)
    return { ok, status: status ?? (ok ? 200 : 401), json: async () => body }
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
  if (typeof window !== 'undefined') window.localStorage.clear()
})

describe('authjsAdapter — token path', () => {
  it('getAccessToken → devuelve el RS256 de /api/auth/token', async () => {
    setTokenEndpoint(() => ({ ok: true, body: { accessToken: 'rs256.jwt.token', expiresAt: 123 } }))
    const adapter = createAuthjsAuthAdapter()
    expect(await adapter.getAccessToken()).toBe('rs256.jwt.token')
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/token', expect.objectContaining({ credentials: 'include' }))
  })

  it('getAccessToken → undefined si /api/auth/token da 401', async () => {
    setTokenEndpoint(() => ({ ok: false }))
    const adapter = createAuthjsAuthAdapter()
    expect(await adapter.getAccessToken()).toBeUndefined()
  })

  it('getAccessToken → undefined si el fetch lanza', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('network'))
    const adapter = createAuthjsAuthAdapter()
    expect(await adapter.getAccessToken()).toBeUndefined()
  })
})

describe('authjsAdapter — getSession/getUser (sesión Auth.js)', () => {
  it('getSession → identidad Auth.js + token RS256, id = user_profiles.id', async () => {
    mockGetSession.mockResolvedValue({ user: { id: APP_USER_ID, email: 'u@test.com', name: 'U Test', image: 'http://x/a.png' } })
    setTokenEndpoint(() => ({ ok: true, body: { accessToken: 'tok', expiresAt: 999 } }))
    const adapter = createAuthjsAuthAdapter()
    const s = await adapter.getSession()
    expect(s!.user.id).toBe(APP_USER_ID)
    expect(s!.user.email).toBe('u@test.com')
    expect(s!.user.metadata?.fullName).toBe('U Test')
    expect(s!.accessToken).toBe('tok')
  })

  it('getSession → null si no hay sesión Auth.js ni token bridge (401)', async () => {
    mockGetSession.mockResolvedValue(null)
    setTokenEndpoint(() => ({ ok: false }))
    const adapter = createAuthjsAuthAdapter()
    expect(await adapter.getSession()).toBeNull()
  })

  it('getUser → devuelve el usuario de la sesión Auth.js', async () => {
    mockGetSession.mockResolvedValue({ user: { id: APP_USER_ID, email: 'u@test.com' } })
    setTokenEndpoint(() => ({ ok: true, body: { accessToken: 'tok', expiresAt: 1 } }))
    const adapter = createAuthjsAuthAdapter()
    expect((await adapter.getUser())!.id).toBe(APP_USER_ID)
  })
})

describe('authjsAdapter — signOut / signInWithIdToken', () => {
  it('signOut delega en next-auth sin redirect', async () => {
    mockSignOut.mockResolvedValue(undefined)
    const adapter = createAuthjsAuthAdapter()
    await adapter.signOut()
    expect(mockSignOut).toHaveBeenCalledWith({ redirect: false })
  })

  it('signOut borra la sesión Supabase legacy → el bridge NO re-loguea (auto-relogin)', async () => {
    mockSignOut.mockResolvedValue(undefined)
    const SB_KEY = 'sb-yqbpstxowvgipqspqrgo-auth'
    window.localStorage.setItem(
      SB_KEY,
      JSON.stringify({ access_token: 'supabase.hs256', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u' } }),
    )
    const adapter = createAuthjsAuthAdapter()
    await adapter.signOut()
    // La sesión legacy debe quedar limpia: sin ella el bridge no tiene de qué re-hidratar.
    expect(window.localStorage.getItem(SB_KEY)).toBeNull()
    // Y en efecto: sin sesión Auth.js ni token Supabase → getSession null (no re-login).
    mockGetSession.mockResolvedValue(null)
    setTokenEndpoint(() => ({ ok: false }))
    expect(await adapter.getSession()).toBeNull()
  })

  it('signInWithIdToken (One Tap) → HABILITADO: llama a nextSignIn(google-one-tap) con el id_token', async () => {
    // One Tap portado al flip Auth.js (commit 1966bf8f): ya NO es el stub
    // 'id_token_sign_in_not_enabled'. Delega en nextSignIn con el provider
    // Credentials 'google-one-tap' (verifica id_token server-side).
    const adapter = createAuthjsAuthAdapter()
    mockSignIn.mockResolvedValue({ error: null })
    mockGetSession.mockResolvedValue(null) // sin sesión tras el sign-in → 'no_session'
    setTokenEndpoint(() => ({ ok: false }))
    const res = await adapter.signInWithIdToken({ provider: 'google', token: 'idtok', nonce: 'n' })
    expect(mockSignIn).toHaveBeenCalledWith(
      'google-one-tap',
      expect.objectContaining({ id_token: 'idtok', nonce: 'n', redirect: false }),
    )
    expect(res.error).not.toBe('id_token_sign_in_not_enabled')
  })

  it('signInWithIdToken → propaga el error de nextSignIn', async () => {
    const adapter = createAuthjsAuthAdapter()
    mockSignIn.mockResolvedValue({ error: 'CredentialsSignin' })
    const res = await adapter.signInWithIdToken({ provider: 'google', token: 'x' })
    expect(res.session).toBeNull()
    expect(res.error).toBe('CredentialsSignin')
  })
})

describe('authjsAdapter — onAuthStateChange (polling)', () => {
  it('emite INITIAL_SESSION con la sesión y SIGNED_OUT al desaparecer', async () => {
    jest.useFakeTimers()
    mockGetSession.mockResolvedValue({ user: { id: APP_USER_ID, email: 'u@test.com' } })
    let hasSession = true
    setTokenEndpoint(() => (hasSession ? { ok: true, body: { accessToken: 'tok', expiresAt: 1 } } : { ok: false }))

    const adapter = createAuthjsAuthAdapter()
    const events: string[] = []
    const unsub = adapter.onAuthStateChange((c) => events.push(c.event))

    await jest.advanceTimersByTimeAsync(0)
    expect(events).toContain('INITIAL_SESSION')

    mockGetSession.mockResolvedValue(null)
    hasSession = false
    await jest.advanceTimersByTimeAsync(5000)
    expect(events).toContain('SIGNED_OUT')

    unsub()
    jest.useRealTimers()
  })

  it('un fallo TRANSITORIO (5xx/red) NO emite SIGNED_OUT — conserva la sesión y reintenta', async () => {
    jest.useFakeTimers()
    // La cookie Auth.js sigue válida todo el tiempo; solo el mint tiene un hipo.
    mockGetSession.mockResolvedValue({ user: { id: APP_USER_ID, email: 'u@test.com' } })
    let transient = false
    setTokenEndpoint(() =>
      transient ? { ok: false, status: 503 } : { ok: true, body: { accessToken: 'tok', expiresAt: 1 } },
    )

    const adapter = createAuthjsAuthAdapter()
    const events: string[] = []
    const unsub = adapter.onAuthStateChange((c) => events.push(c.event))

    await jest.advanceTimersByTimeAsync(0)
    expect(events).toContain('INITIAL_SESSION')

    // El servidor tiene un hipo (503) — NO debe desloguear (bug del auto-logout espurio).
    transient = true
    await jest.advanceTimersByTimeAsync(5000)
    await jest.advanceTimersByTimeAsync(5000)
    expect(events).not.toContain('SIGNED_OUT')

    // Al recuperarse el servidor sigue logueado (uid no cambió → sin evento nuevo).
    transient = false
    await jest.advanceTimersByTimeAsync(5000)
    expect(events).not.toContain('SIGNED_OUT')
    expect(events.filter((e) => e === 'INITIAL_SESSION')).toHaveLength(1)

    unsub()
    jest.useRealTimers()
  })

  it('SIMULACIÓN: servidor flaky (ok→503→500→504→red→ok→401) — cero deslogueos espurios, 1 SIGNED_OUT solo al 401', async () => {
    jest.useFakeTimers()
    mockGetSession.mockResolvedValue({ user: { id: APP_USER_ID, email: 'u@test.com' } })

    const OK = { ok: true, status: 200, body: { accessToken: 'tok', expiresAt: 1 } as unknown }
    // Guion de respuestas de /api/auth/token: un paso por tick (5s).
    const script: Array<{ ok: boolean; status?: number; body?: unknown; throws?: boolean }> = [
      OK, // t0 → INITIAL_SESSION
      { ok: false, status: 503 }, // t1 → hipo servidor
      { ok: false, status: 500 }, // t2 → hipo servidor
      { ok: false, status: 504 }, // t3 → gateway timeout (BD saturada)
      { ok: false, throws: true }, // t4 → error de red (fetch lanza)
      OK, // t5 → recupera (mismo uid → sin evento)
      { ok: false, status: 401 }, // t6 → sesión caducada DE VERDAD → SIGNED_OUT
    ]
    let step = 0
    ;(global.fetch as jest.Mock).mockImplementation(async () => {
      const s = script[Math.min(step, script.length - 1)]
      if (s.throws) throw new Error('network down')
      return { ok: s.ok, status: s.status ?? (s.ok ? 200 : 401), json: async () => s.body }
    })

    const adapter = createAuthjsAuthAdapter()
    const events: string[] = []
    const unsub = adapter.onAuthStateChange((c) => events.push(c.event))

    await jest.advanceTimersByTimeAsync(0)
    expect(events).toEqual(['INITIAL_SESSION'])

    for (let t = 1; t <= 6; t++) {
      step = t
      await jest.advanceTimersByTimeAsync(5000)
    }

    // Los 5 fallos transitorios (t1..t5) NO deslogean; solo el 401 (t6) emite SIGNED_OUT.
    expect(events).toEqual(['INITIAL_SESSION', 'SIGNED_OUT'])

    unsub()
    jest.useRealTimers()
  })

  it('respuesta malformada (200 sin accessToken) → transitorio, NO desloguea', async () => {
    jest.useFakeTimers()
    mockGetSession.mockResolvedValue({ user: { id: APP_USER_ID, email: 'u@test.com' } })
    let malformed = false
    setTokenEndpoint(() =>
      malformed ? { ok: true, body: {} } : { ok: true, body: { accessToken: 'tok', expiresAt: 1 } },
    )

    const adapter = createAuthjsAuthAdapter()
    const events: string[] = []
    const unsub = adapter.onAuthStateChange((c) => events.push(c.event))

    await jest.advanceTimersByTimeAsync(0)
    expect(events).toContain('INITIAL_SESSION')

    // 200 OK pero cuerpo sin accessToken = hipo del servidor, NO ausencia de sesión.
    malformed = true
    await jest.advanceTimersByTimeAsync(5000)
    expect(events).not.toContain('SIGNED_OUT')

    unsub()
    jest.useRealTimers()
  })
})

describe('authjsAdapter — BRIDGE del cutover (Fase B)', () => {
  const SB_KEY = 'sb-yqbpstxowvgipqspqrgo-auth'
  const future = Math.floor(Date.now() / 1000) + 3600
  const sbSession = { access_token: 'supabase.hs256', expires_at: future, user: { id: APP_USER_ID, email: 'u@test.com' } }

  // Simula el bridge server-side: /api/auth/token con Bearer Supabase válido → RS256 + user.
  function bridgeServer(_url: string, init?: RequestInit) {
    const authz = (init?.headers as Record<string, string> | undefined)?.Authorization
    if (authz === 'Bearer supabase.hs256') {
      return { ok: true, body: { accessToken: 'rs256.bridged', expiresAt: future, user: { id: APP_USER_ID, email: 'u@test.com' } } }
    }
    return { ok: false } // sin Bearer válido (y sin sesión Auth.js en estos tests) → 401
  }

  it('sin sesión Auth.js + token Supabase → getSession devuelve sesión vía bridge', async () => {
    mockGetSession.mockResolvedValue(null)
    window.localStorage.setItem(SB_KEY, JSON.stringify(sbSession))
    setTokenEndpoint(bridgeServer)
    const adapter = createAuthjsAuthAdapter()
    const s = await adapter.getSession()
    expect(s).not.toBeNull()
    expect(s!.user.id).toBe(APP_USER_ID)
    expect(s!.accessToken).toBe('rs256.bridged') // RS256 acuñado por el bridge
    expect(mockSignIn).not.toHaveBeenCalled() // sin redirect disruptivo
  })

  it('getAccessToken adjunta el Bearer Supabase → recibe el RS256 bridged', async () => {
    mockGetSession.mockResolvedValue(null)
    window.localStorage.setItem(SB_KEY, JSON.stringify(sbSession))
    setTokenEndpoint(bridgeServer)
    const adapter = createAuthjsAuthAdapter()
    expect(await adapter.getAccessToken()).toBe('rs256.bridged')
  })

  it('token Supabase EXPIRADO → NO se adjunta → 401 → getSession null (→ login)', async () => {
    mockGetSession.mockResolvedValue(null)
    window.localStorage.setItem(SB_KEY, JSON.stringify({ ...sbSession, expires_at: Math.floor(Date.now() / 1000) - 100 }))
    setTokenEndpoint(bridgeServer)
    const adapter = createAuthjsAuthAdapter()
    expect(await adapter.getSession()).toBeNull()
  })

  it('sin token Supabase → sin Bearer → 401 → getSession null', async () => {
    mockGetSession.mockResolvedValue(null)
    setTokenEndpoint(bridgeServer)
    const adapter = createAuthjsAuthAdapter()
    expect(await adapter.getSession()).toBeNull()
  })

  it('con sesión Auth.js → prevalece la identidad Auth.js (no la del bridge)', async () => {
    mockGetSession.mockResolvedValue({ user: { id: APP_USER_ID, email: 'u@test.com', name: 'AuthjsName' } })
    window.localStorage.setItem(SB_KEY, JSON.stringify(sbSession))
    setTokenEndpoint(() => ({ ok: true, body: { accessToken: 'rs256.authjs', expiresAt: future, user: null } }))
    const adapter = createAuthjsAuthAdapter()
    const s = await adapter.getSession()
    expect(s!.user.metadata?.fullName).toBe('AuthjsName')
    expect(s!.accessToken).toBe('rs256.authjs')
  })
})
