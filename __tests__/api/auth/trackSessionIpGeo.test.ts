/** @jest-environment node */
// __tests__/api/auth/trackSessionIpGeo.test.ts
// Tests del extractGeoFromVercelHeaders en track-session-ip.
// El helper sustituye la llamada externa a ip-api.com (3s timeout) por
// lectura sync de los headers que Vercel inyecta en cada request.

// Para testear el helper, importamos el archivo del route (la función está
// declarada como const top-level, no exportada) y verificamos el comportamiento
// observable a través de POST.

const mockGetDb = jest.fn()
const mockWithDbTimeout = jest.fn(async (fn: () => Promise<unknown>) => fn())

jest.mock('@/db/client', () => ({
  getDb: () => mockGetDb(),
}))

jest.mock('@/db/schema', () => ({
  userSessions: { id: 'id', userId: 'user_id', ipAddress: 'ip_address' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: jest.fn((...args: unknown[]) => ({ type: 'and', args })),
  isNull: jest.fn((...args: unknown[]) => ({ type: 'isNull', args })),
  desc: jest.fn((...args: unknown[]) => ({ type: 'desc', args })),
}))

jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_path: string, handler: any) => handler,
}))

jest.mock('@/lib/db/timeout', () => ({
  withDbTimeout: (fn: () => Promise<unknown>) => mockWithDbTimeout(fn),
  isDbTimeoutError: () => false,
}))

import { POST } from '@/app/api/auth/track-session-ip/route'

const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

function buildRequest(body: object, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/auth/track-session-ip', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '8.8.8.8',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

function setupDbMock() {
  const updateWhere = jest.fn().mockResolvedValue([])
  const updateSet = jest.fn(() => ({ where: updateWhere }))
  const update = jest.fn(() => ({ set: updateSet }))
  const limit = jest.fn().mockResolvedValue([{ id: 'session-recent' }])
  const orderBy = jest.fn(() => ({ limit }))
  const where = jest.fn(() => ({ orderBy }))
  const from = jest.fn(() => ({ where }))
  const select = jest.fn(() => ({ from }))
  mockGetDb.mockReturnValue({ update, select })
  return { update, updateSet, updateWhere }
}

describe('POST /api/auth/track-session-ip — geo desde Vercel headers', () => {
  beforeEach(() => {
    mockGetDb.mockReset()
    mockWithDbTimeout.mockClear()
  })

  test('extrae country/city/region de Vercel headers y los persiste', async () => {
    const { updateSet } = setupDbMock()
    const req = buildRequest(
      { userId: VALID_USER_ID, sessionId: '660e8400-e29b-41d4-a716-446655440000' },
      {
        'x-vercel-ip-country': 'ES',
        'x-vercel-ip-country-region': 'M',
        'x-vercel-ip-city': 'Madrid',
        'x-vercel-ip-latitude': '40.4168',
        'x-vercel-ip-longitude': '-3.7038',
      }
    )

    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.geo).toEqual({ city: 'Madrid', region: 'M', country: 'ES' })

    // updateSet recibe el geo
    const setArg = updateSet.mock.calls[0]?.[0]
    expect(setArg).toMatchObject({
      countryCode: 'ES',
      region: 'M',
      city: 'Madrid',
      coordinates: [-3.7038, 40.4168],
    })
    // isp NO debe estar (Vercel no lo da)
    expect(setArg.isp).toBeUndefined()
  })

  test('city URL-encoded se decodifica correctamente', async () => {
    setupDbMock()
    const req = buildRequest(
      { userId: VALID_USER_ID, sessionId: '660e8400-e29b-41d4-a716-446655440000' },
      {
        'x-vercel-ip-country': 'US',
        'x-vercel-ip-city': 'San%20Francisco',
        'x-vercel-ip-latitude': '37.7749',
        'x-vercel-ip-longitude': '-122.4194',
      }
    )

    const res = await POST(req as any)
    const body = await res.json()
    expect(body.geo.city).toBe('San Francisco')
  })

  test('sin headers Vercel (dev local) → sesión se guarda sin geo', async () => {
    const { updateSet } = setupDbMock()
    const req = buildRequest(
      { userId: VALID_USER_ID, sessionId: '660e8400-e29b-41d4-a716-446655440000' },
      // SIN headers x-vercel-ip-*
    )

    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.geo).toBe(null)

    // updateSet NO incluye geo
    const setArg = updateSet.mock.calls[0]?.[0]
    expect(setArg.countryCode).toBeUndefined()
    expect(setArg.city).toBeUndefined()
    expect(setArg.coordinates).toBeUndefined()
    // ipAddress sí (siempre)
    expect(setArg.ipAddress).toBeDefined()
  })

  test('lat/lon faltantes → coordinates no se setea', async () => {
    const { updateSet } = setupDbMock()
    const req = buildRequest(
      { userId: VALID_USER_ID, sessionId: '660e8400-e29b-41d4-a716-446655440000' },
      {
        'x-vercel-ip-country': 'ES',
        'x-vercel-ip-city': 'Madrid',
        // sin lat/lon
      }
    )

    await POST(req as any)
    const setArg = updateSet.mock.calls[0]?.[0]
    expect(setArg.countryCode).toBe('ES')
    expect(setArg.coordinates).toBeUndefined()
  })

  test('lat/lon inválidos (no number) → coordinates no se setea', async () => {
    const { updateSet } = setupDbMock()
    const req = buildRequest(
      { userId: VALID_USER_ID, sessionId: '660e8400-e29b-41d4-a716-446655440000' },
      {
        'x-vercel-ip-country': 'ES',
        'x-vercel-ip-city': 'Madrid',
        'x-vercel-ip-latitude': 'not-a-number',
        'x-vercel-ip-longitude': 'NaN',
      }
    )

    await POST(req as any)
    const setArg = updateSet.mock.calls[0]?.[0]
    expect(setArg.coordinates).toBeUndefined()
  })

  test('city encoded con caracteres raros — decodeURIComponent fallback', async () => {
    setupDbMock()
    // %ZZ es inválido → safeDecodeURIComponent debe devolver el string crudo
    const req = buildRequest(
      { userId: VALID_USER_ID, sessionId: '660e8400-e29b-41d4-a716-446655440000' },
      {
        'x-vercel-ip-country': 'ES',
        'x-vercel-ip-city': 'Bad%ZZEncoded',
      }
    )

    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    // Devuelve raw si decode falla
    expect(body.geo.city).toBe('Bad%ZZEncoded')
  })

  test('latencia: NO hace llamadas externas (sync)', async () => {
    // Si todavía estuviera la fetch a ip-api.com, esta llamada tardaría hasta 3s
    setupDbMock()
    const req = buildRequest(
      { userId: VALID_USER_ID, sessionId: '660e8400-e29b-41d4-a716-446655440000' },
      { 'x-vercel-ip-country': 'ES', 'x-vercel-ip-city': 'Madrid' }
    )

    const t0 = Date.now()
    await POST(req as any)
    const elapsed = Date.now() - t0

    // En test mockeado debería ser <100ms. Si fuera >2000ms es que llama a algo externo
    expect(elapsed).toBeLessThan(500)
  })
})
