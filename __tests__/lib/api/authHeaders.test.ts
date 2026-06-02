// Tests de CARACTERIZACIÓN de lib/api/authHeaders.ts (red de seguridad pre-Fase 4B).
// Fijan el comportamiento ACTUAL (singleflight + cooldown 30s + fallback + device headers)
// para que la migración del sábado a `auth.*` solo tenga que mantenerlos verdes.
// El estado de módulo (refreshPromise/lastRefreshTime) se resetea con jest.resetModules().

const mockAuthApi = {
  getSession: jest.fn(),
  refreshSession: jest.fn(),
}
jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ auth: mockAuthApi }),
}))

function loadGetAuthHeaders(): () => Promise<Record<string, string>> {
  // require fresh tras resetModules → reinicia refreshPromise/lastRefreshTime
  return require('@/lib/api/authHeaders').getAuthHeaders
}

describe('getAuthHeaders — caracterización (singleflight + cooldown)', () => {
  let nowSpy: jest.SpyInstance

  beforeEach(() => {
    jest.resetModules()
    mockAuthApi.getSession.mockReset()
    mockAuthApi.refreshSession.mockReset()
    localStorage.clear()
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(10_000_000)
  })

  afterEach(() => {
    nowSpy.mockRestore()
  })

  test('primera llamada refresca la sesión y devuelve Bearer', async () => {
    mockAuthApi.refreshSession.mockResolvedValue({ data: { session: { access_token: 'tok-1' } } })
    const getAuthHeaders = loadGetAuthHeaders()

    const headers = await getAuthHeaders()

    expect(mockAuthApi.refreshSession).toHaveBeenCalledTimes(1)
    expect(headers.Authorization).toBe('Bearer tok-1')
  })

  test('singleflight: N llamadas concurrentes comparten UNA sola refreshSession', async () => {
    let resolveRefresh!: (v: unknown) => void
    mockAuthApi.refreshSession.mockReturnValue(new Promise((r) => { resolveRefresh = r }))
    const getAuthHeaders = loadGetAuthHeaders()

    const p1 = getAuthHeaders()
    const p2 = getAuthHeaders()
    const p3 = getAuthHeaders()

    resolveRefresh({ data: { session: { access_token: 'tok-sf' } } })
    const [h1, h2, h3] = await Promise.all([p1, p2, p3])

    expect(mockAuthApi.refreshSession).toHaveBeenCalledTimes(1) // anti-429
    expect(h1.Authorization).toBe('Bearer tok-sf')
    expect(h2.Authorization).toBe('Bearer tok-sf')
    expect(h3.Authorization).toBe('Bearer tok-sf')
  })

  test('cooldown 30s: 2ª llamada <30s usa getSession cacheada, NO refreshSession', async () => {
    mockAuthApi.refreshSession.mockResolvedValue({ data: { session: { access_token: 'tok-r' } } })
    mockAuthApi.getSession.mockResolvedValue({ data: { session: { access_token: 'tok-cached' } } })
    const getAuthHeaders = loadGetAuthHeaders()

    await getAuthHeaders() // refresca; lastRefreshTime = 10_000_000
    nowSpy.mockReturnValue(10_000_000 + 29_000) // +29s (< 30s)
    const h2 = await getAuthHeaders()

    expect(mockAuthApi.refreshSession).toHaveBeenCalledTimes(1)
    expect(mockAuthApi.getSession).toHaveBeenCalledTimes(1)
    expect(h2.Authorization).toBe('Bearer tok-cached')
  })

  test('pasados 30s vuelve a refrescar', async () => {
    mockAuthApi.refreshSession.mockResolvedValue({ data: { session: { access_token: 'tok-r' } } })
    const getAuthHeaders = loadGetAuthHeaders()

    await getAuthHeaders()
    nowSpy.mockReturnValue(10_000_000 + 31_000) // +31s (> 30s)
    await getAuthHeaders()

    expect(mockAuthApi.refreshSession).toHaveBeenCalledTimes(2)
  })

  test('fallback a getSession si refreshSession no devuelve token', async () => {
    mockAuthApi.refreshSession.mockResolvedValue({ data: { session: null } })
    mockAuthApi.getSession.mockResolvedValue({ data: { session: { access_token: 'tok-fb' } } })
    const getAuthHeaders = loadGetAuthHeaders()

    const headers = await getAuthHeaders()

    expect(headers.Authorization).toBe('Bearer tok-fb')
  })

  test('sin sesión → sin header Authorization (pero no lanza)', async () => {
    mockAuthApi.refreshSession.mockResolvedValue({ data: { session: null } })
    mockAuthApi.getSession.mockResolvedValue({ data: { session: null } })
    const getAuthHeaders = loadGetAuthHeaders()

    const headers = await getAuthHeaders()

    expect(headers.Authorization).toBeUndefined()
  })

  test('refreshSession que lanza → fallback a getSession sin propagar', async () => {
    mockAuthApi.refreshSession.mockRejectedValue(new Error('429'))
    mockAuthApi.getSession.mockResolvedValue({ data: { session: { access_token: 'tok-after-throw' } } })
    const getAuthHeaders = loadGetAuthHeaders()

    const headers = await getAuthHeaders()

    expect(headers.Authorization).toBe('Bearer tok-after-throw')
  })

  test('incluye X-Device-Id y X-Hw-Fingerprint desde localStorage', async () => {
    mockAuthApi.refreshSession.mockResolvedValue({ data: { session: { access_token: 't' } } })
    localStorage.setItem('vence_device_id', 'dev-123')
    localStorage.setItem('vence_hw_fingerprint', 'hw-456')
    const getAuthHeaders = loadGetAuthHeaders()

    const headers = await getAuthHeaders()

    expect(headers['X-Device-Id']).toBe('dev-123')
    expect(headers['X-Hw-Fingerprint']).toBe('hw-456')
  })
})
