/**
 * INTEGRACIÓN: el reintento de red (fix 24/07/2026) compone correctamente con el
 * protocolo de challenge anti-scraping. Un blip transitorio seguido de un 403
 * "challenge required" debe: reintentar el blip → recibir el 403 → resolver el
 * reto → reintentar con el token → devolver la respuesta buena. Verifica que las
 * dos capas (resiliencia de red + challenge) no se pisan.
 */
import { fetchWithChallenge } from '@/lib/api/fetchWithChallenge'

jest.mock('@/lib/observability/client', () => ({ emitClientEvent: jest.fn() }))

// Protocolo de challenge: token header fijo + reconocedor del body que devuelve true.
jest.mock('@/lib/security/captcha/protocol', () => ({
  CAPTCHA_TOKEN_HEADER: 'x-captcha-token',
  isChallengeRequiredResponse: () => true,
}))

// Bridge del reto: simula que el usuario resuelve el captcha y devuelve un token.
const mockSolve = jest.fn().mockResolvedValue('human-token-123')
jest.mock('@/lib/api/challengeBridge', () => ({ solveChallenge: (...a: unknown[]) => mockSolve(...a) }))

const challenge403 = () =>
  new Response(JSON.stringify({ challengeRequired: true, action: 'load_questions' }), {
    status: 403,
    headers: { 'x-challenge-required': '1' },
  })
const questionsOk = () =>
  new Response(JSON.stringify({ success: true, questions: [{ id: 'q1' }] }), { status: 200 })

describe('fetchWithChallenge — integración red + challenge', () => {
  let originalFetch: typeof global.fetch
  beforeEach(() => {
    originalFetch = global.fetch
    mockSolve.mockClear()
    jest.useFakeTimers()
  })
  afterEach(() => {
    global.fetch = originalFetch
    jest.useRealTimers()
  })

  it('blip de red → 403 challenge → token → respuesta buena (una sola vez cada capa)', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // blip de red
      .mockResolvedValueOnce(challenge403())                    // gate anti-scraping
      .mockResolvedValueOnce(questionsOk())                     // reintento con token → OK
    global.fetch = fetchMock as unknown as typeof global.fetch

    const p = fetchWithChallenge('/api/questions/filtered', { method: 'POST', body: '{}' })
    await jest.runAllTimersAsync()
    const res = await p
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)   // blip + 403 + retry-con-token
    expect(mockSolve).toHaveBeenCalledTimes(1)   // el reto se resolvió una vez
    // El 3er fetch lleva el token del reto.
    const lastInit = fetchMock.mock.calls[2][1] as RequestInit
    const headers = new Headers(lastInit.headers)
    expect(headers.get('x-captcha-token')).toBe('human-token-123')
  })
})
