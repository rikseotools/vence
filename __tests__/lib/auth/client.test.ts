// Tests del adapter Supabase del puerto AuthClientPort (Fase 4 — Fase A).
// Verifican delegación 1:1 al cliente Supabase + mapeo a tipos agnósticos.

const mockAuth = {
  getSession: jest.fn(),
  getUser: jest.fn(),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  refreshSession: jest.fn(),
  updateUser: jest.fn(),
  onAuthStateChange: jest.fn(),
}
const mockSignInWithGoogle = jest.fn().mockResolvedValue({ success: true, data: { url: 'https://google' } })
const mockGetAuthHeaders = jest.fn()

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ auth: mockAuth }),
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
}))
jest.mock('@/lib/api/authHeaders', () => ({
  getAuthHeaders: () => mockGetAuthHeaders(),
}))

import { createSupabaseAuthAdapter } from '@/lib/auth/adapters/supabaseAdapter'

const SB_USER = {
  id: 'user-1',
  email: 'a@b.com',
  user_metadata: { full_name: 'Ada Lovelace', avatar_url: 'http://img/a.png' },
}
const SB_SESSION = {
  user: SB_USER,
  access_token: 'tok-123',
  expires_at: 1999999999,
  refresh_token: 'ref-456',
}

describe('supabaseAdapter — AuthClientPort', () => {
  beforeEach(() => jest.clearAllMocks())

  test('getSession() mapea la sesión Supabase a AuthSession', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: SB_SESSION }, error: null })
    const auth = createSupabaseAuthAdapter()
    const s = await auth.getSession()
    expect(s).toEqual({
      user: {
        id: 'user-1',
        email: 'a@b.com',
        metadata: { fullName: 'Ada Lovelace', avatarUrl: 'http://img/a.png' },
        raw: SB_USER,
      },
      accessToken: 'tok-123',
      expiresAt: 1999999999,
      refreshToken: 'ref-456',
      raw: SB_SESSION,
    })
  })

  test('getSession() devuelve null si no hay sesión', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    const auth = createSupabaseAuthAdapter()
    expect(await auth.getSession()).toBeNull()
  })

  test('getUser() mapea el usuario a AuthUser (email null si falta)', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u2', user_metadata: {} } }, error: null })
    const auth = createSupabaseAuthAdapter()
    const u = await auth.getUser()
    expect(u).toMatchObject({ id: 'u2', email: null, metadata: { fullName: null, avatarUrl: null } })
  })

  test('getAccessToken() extrae el Bearer de getAuthHeaders (singleflight de authHeaders)', async () => {
    mockGetAuthHeaders.mockResolvedValue({ Authorization: 'Bearer abc.def' })
    const auth = createSupabaseAuthAdapter()
    expect(await auth.getAccessToken()).toBe('abc.def')
  })

  test('getAccessToken() devuelve undefined si no hay Authorization', async () => {
    mockGetAuthHeaders.mockResolvedValue({ 'X-Device-Id': 'd1' })
    const auth = createSupabaseAuthAdapter()
    expect(await auth.getAccessToken()).toBeUndefined()
  })

  test('signInWithGoogle() delega en lib/supabase con las options', async () => {
    const auth = createSupabaseAuthAdapter()
    const r = await auth.signInWithGoogle({ funnel: 'premium-ads' })
    expect(mockSignInWithGoogle).toHaveBeenCalledWith({ funnel: 'premium-ads' })
    expect(r).toEqual({ success: true, data: { url: 'https://google' } })
  })

  test('signOut() / refreshSession() / updateUser() delegan al cliente', async () => {
    mockAuth.refreshSession.mockResolvedValue({ data: { session: SB_SESSION }, error: null })
    mockAuth.updateUser.mockResolvedValue({ data: { user: SB_USER }, error: null })
    const auth = createSupabaseAuthAdapter()

    await auth.signOut()
    expect(mockAuth.signOut).toHaveBeenCalled()

    const refreshed = await auth.refreshSession()
    expect(refreshed?.accessToken).toBe('tok-123')

    const updated = await auth.updateUser({ data: { full_name: 'x' } })
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ data: { full_name: 'x' } })
    expect(updated?.id).toBe('user-1')
  })

  test('onAuthStateChange() normaliza eventos, ignora desconocidos y devuelve unsubscribe', () => {
    const unsubscribe = jest.fn()
    let captured: ((evt: string, session: unknown) => void) | null = null
    mockAuth.onAuthStateChange.mockImplementation((cb: (evt: string, s: unknown) => void) => {
      captured = cb
      return { data: { subscription: { unsubscribe } } }
    })

    const auth = createSupabaseAuthAdapter()
    const changes: unknown[] = []
    const off = auth.onAuthStateChange((c) => changes.push(c))

    captured!('SIGNED_IN', SB_SESSION)
    captured!('TOKEN_REFRESHED', SB_SESSION)
    captured!('SIGNED_UP', SB_SESSION) // colapsa a SIGNED_IN + isNewUser
    captured!('UNKNOWN_EVENT', null) // ignorado

    expect(changes).toHaveLength(3)
    expect(changes[0]).toMatchObject({ event: 'SIGNED_IN', isNewUser: false })
    expect(changes[1]).toMatchObject({ event: 'TOKEN_REFRESHED' })
    expect(changes[2]).toMatchObject({ event: 'SIGNED_IN', isNewUser: true })

    off()
    expect(unsubscribe).toHaveBeenCalled()
  })

  // --- completeOAuthCallback (C4) — build-only, NO cablea la página todavía ---
  const SB_URL = 'https://proj123.supabase.co'
  const STORAGE_KEY = 'sb-proj123-auth'

  function setupCallbackEnv() {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SB_URL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    localStorage.clear()
    mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } })
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  }

  test('completeOAuthCallback() resuelve la sesión ya presente en localStorage (mapeada)', async () => {
    setupCallbackEnv()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SB_SESSION))
    const auth = createSupabaseAuthAdapter()
    const s = await auth.completeOAuthCallback()
    expect(s?.accessToken).toBe('tok-123')
    expect(s?.user.id).toBe('user-1')
    expect(s?.user.metadata).toEqual({ fullName: 'Ada Lovelace', avatarUrl: 'http://img/a.png' })
  })

  test('completeOAuthCallback() resuelve vía onAuthStateChange', async () => {
    setupCallbackEnv()
    let captured: ((evt: string, s: unknown) => void) | null = null
    mockAuth.onAuthStateChange.mockImplementation((cb: (evt: string, s: unknown) => void) => {
      captured = cb
      return { data: { subscription: { unsubscribe: jest.fn() } } }
    })
    const auth = createSupabaseAuthAdapter()
    const p = auth.completeOAuthCallback()
    captured!('SIGNED_IN', SB_SESSION) // el SDK entrega la sesión por eventos
    expect((await p)?.accessToken).toBe('tok-123')
  })

  test('completeOAuthCallback() hace el intercambio PKCE directo si el SDK se cuelga', async () => {
    jest.useFakeTimers()
    setupCallbackEnv()
    window.history.pushState({}, '', '/auth/callback?code=auth-xyz')
    localStorage.setItem(`${STORAGE_KEY}-code-verifier`, 'verifier-abc')
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ...SB_SESSION }) })
    const prevFetch = global.fetch
    global.fetch = fetchMock as unknown as typeof fetch

    const auth = createSupabaseAuthAdapter()
    const p = auth.completeOAuthCallback()
    await jest.advanceTimersByTimeAsync(3100) // dispara el directPkceTimeout (3s)
    const s = await p

    expect(fetchMock).toHaveBeenCalledWith(
      `${SB_URL}/auth/v1/token?grant_type=pkce`,
      expect.objectContaining({ method: 'POST' }),
    )
    expect(s?.accessToken).toBe('tok-123')
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy() // persistió la sesión
    expect(localStorage.getItem(`${STORAGE_KEY}-code-verifier`)).toBeNull() // limpió el verifier
    global.fetch = prevFetch
    jest.useRealTimers()
  })

  test('completeOAuthCallback() devuelve null si no llega sesión en 15s', async () => {
    jest.useFakeTimers()
    setupCallbackEnv()
    window.history.pushState({}, '', '/auth/callback') // sin code → sin exchange directo
    const auth = createSupabaseAuthAdapter()
    const p = auth.completeOAuthCallback()
    await jest.advanceTimersByTimeAsync(15100)
    expect(await p).toBeNull()
    jest.useRealTimers()
  })
})
