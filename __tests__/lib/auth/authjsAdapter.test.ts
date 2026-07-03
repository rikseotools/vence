// __tests__/lib/auth/authjsAdapter.test.ts
// Tests del adapter Auth.js (Fase B2). Mockea next-auth/react (evita su ESM) y
// fetch (/api/auth/token). Verifica el mapeo del puerto + el camino del token.

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

function mockTokenResponse(ok: boolean, body?: unknown) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    json: async () => body,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

describe('authjsAdapter — token path', () => {
  it('getAccessToken → devuelve el RS256 de /api/auth/token', async () => {
    mockTokenResponse(true, { accessToken: 'rs256.jwt.token', expiresAt: 123 })
    const adapter = createAuthjsAuthAdapter()
    const token = await adapter.getAccessToken()
    expect(token).toBe('rs256.jwt.token')
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/token', { credentials: 'include' })
  })

  it('getAccessToken → undefined si no hay sesión (401)', async () => {
    mockTokenResponse(false)
    const adapter = createAuthjsAuthAdapter()
    expect(await adapter.getAccessToken()).toBeUndefined()
  })

  it('getAccessToken → undefined si el fetch lanza', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))
    const adapter = createAuthjsAuthAdapter()
    expect(await adapter.getAccessToken()).toBeUndefined()
  })
})

describe('authjsAdapter — getSession/getUser', () => {
  it('getSession → identidad (Auth.js) + token (mint), con id = user_profiles.id', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: APP_USER_ID, email: 'u@test.com', name: 'U Test', image: 'http://x/a.png' },
    })
    mockTokenResponse(true, { accessToken: 'tok', expiresAt: 999 })
    const adapter = createAuthjsAuthAdapter()
    const session = await adapter.getSession()
    expect(session).not.toBeNull()
    expect(session!.user.id).toBe(APP_USER_ID)
    expect(session!.user.email).toBe('u@test.com')
    expect(session!.user.metadata?.fullName).toBe('U Test')
    expect(session!.accessToken).toBe('tok')
    expect(session!.expiresAt).toBe(999)
  })

  it('getSession → null si no hay sesión Auth.js', async () => {
    mockGetSession.mockResolvedValue(null)
    mockTokenResponse(false)
    const adapter = createAuthjsAuthAdapter()
    expect(await adapter.getSession()).toBeNull()
  })

  it('getSession → null si hay sesión pero el mint falla (no token = no Bearer)', async () => {
    mockGetSession.mockResolvedValue({ user: { id: APP_USER_ID, email: 'u@test.com' } })
    mockTokenResponse(false)
    const adapter = createAuthjsAuthAdapter()
    expect(await adapter.getSession()).toBeNull()
  })

  it('getUser → mapea el usuario sin tocar /api/auth/token', async () => {
    mockGetSession.mockResolvedValue({ user: { id: APP_USER_ID, email: 'u@test.com' } })
    const adapter = createAuthjsAuthAdapter()
    const user = await adapter.getUser()
    expect(user!.id).toBe(APP_USER_ID)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('authjsAdapter — signOut / signInWithIdToken', () => {
  it('signOut delega en next-auth sin redirect', async () => {
    mockSignOut.mockResolvedValue(undefined)
    const adapter = createAuthjsAuthAdapter()
    await adapter.signOut()
    expect(mockSignOut).toHaveBeenCalledWith({ redirect: false })
  })

  it('signInWithIdToken (One Tap) → dormido con error explícito', async () => {
    const adapter = createAuthjsAuthAdapter()
    const res = await adapter.signInWithIdToken({ provider: 'google', token: 'x' })
    expect(res.session).toBeNull()
    expect(res.error).toBe('id_token_sign_in_not_enabled')
  })
})

describe('authjsAdapter — onAuthStateChange (polling)', () => {
  it('emite INITIAL_SESSION con la sesión y SIGNED_OUT al desaparecer', async () => {
    jest.useFakeTimers()
    mockGetSession.mockResolvedValue({ user: { id: APP_USER_ID, email: 'u@test.com' } })
    mockTokenResponse(true, { accessToken: 'tok', expiresAt: 1 })

    const adapter = createAuthjsAuthAdapter()
    const events: string[] = []
    const unsub = adapter.onAuthStateChange((change) => {
      events.push(change.event)
    })

    // tick inicial: advanceTimersByTimeAsync drena los awaits internos (nextGetSession + mint)
    await jest.advanceTimersByTimeAsync(0)
    expect(events).toContain('INITIAL_SESSION')

    // ahora sin sesión → siguiente poll (5s) debe emitir SIGNED_OUT
    mockGetSession.mockResolvedValue(null)
    await jest.advanceTimersByTimeAsync(5000)
    expect(events).toContain('SIGNED_OUT')

    unsub()
    jest.useRealTimers()
  })
})

describe('authjsAdapter — fallback de sesión Supabase en el cutover (Fase B)', () => {
  const LEGACY_KEY = 'sb-yqbpstxowvgipqspqrgo-auth-token'
  const future = Math.floor(Date.now() / 1000) + 3600
  const legacySession = {
    access_token: 'supabase.hs256.token',
    expires_at: future,
    user: { id: APP_USER_ID, email: 'a@b.com', user_metadata: { full_name: 'A B' } },
  }

  beforeEach(() => {
    window.localStorage.clear()
  })

  it('sin sesión Auth.js pero con sesión Supabase → getSession devuelve la sesión Supabase (user + token HS256)', async () => {
    mockGetSession.mockResolvedValue(null) // no Auth.js
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({}) }) // /api/auth/token 401
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacySession))
    const adapter = createAuthjsAuthAdapter()

    const session = await adapter.getSession()
    expect(session).not.toBeNull()
    expect(session!.user.id).toBe(APP_USER_ID)
    expect(session!.accessToken).toBe('supabase.hs256.token')
    expect(mockSignIn).not.toHaveBeenCalled() // NO redirect disruptivo
  })

  it('getAccessToken sin token Auth.js → cae al token Supabase', async () => {
    mockGetSession.mockResolvedValue(null)
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({}) })
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacySession))
    const adapter = createAuthjsAuthAdapter()
    expect(await adapter.getAccessToken()).toBe('supabase.hs256.token')
  })

  it('con sesión Auth.js → prevalece RS256 (NO usa la Supabase aunque exista)', async () => {
    mockGetSession.mockResolvedValue({ user: { id: APP_USER_ID, email: 'a@b.com' } })
    mockTokenResponse(true, { accessToken: 'rs256.jwt', expiresAt: 1 })
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacySession))
    const adapter = createAuthjsAuthAdapter()
    const session = await adapter.getSession()
    expect(session!.accessToken).toBe('rs256.jwt')
  })

  it('sesión Supabase EXPIRADA → no fallback → getSession null (→ login)', async () => {
    mockGetSession.mockResolvedValue(null)
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({}) })
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ ...legacySession, expires_at: Math.floor(Date.now() / 1000) - 100 }))
    const adapter = createAuthjsAuthAdapter()
    expect(await adapter.getSession()).toBeNull()
  })

  it('sin sesión de ningún tipo → getSession null', async () => {
    mockGetSession.mockResolvedValue(null)
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({}) })
    const adapter = createAuthjsAuthAdapter()
    expect(await adapter.getSession()).toBeNull()
  })

  it('getUser sin Auth.js → devuelve el user de la sesión Supabase', async () => {
    mockGetSession.mockResolvedValue(null)
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacySession))
    const adapter = createAuthjsAuthAdapter()
    const u = await adapter.getUser()
    expect(u!.id).toBe(APP_USER_ID)
    expect(u!.email).toBe('a@b.com')
  })
})
