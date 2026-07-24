/**
 * SIMULACIÓN del efecto del fix de reintento de red (24/07/2026) sobre una
 * distribución realista de "sesiones" que sufren blips de conexión al generar
 * un test. Ejercita el CÓDIGO REAL (fetchWithChallenge) con un fetch falso que
 * reproduce N blips seguidos antes de conectar (o offline total), y mide:
 *   - cuántas sesiones se RECUPERAN solas (antes = dead-end, ahora = OK)
 *   - cuántas siguen fallando (offline sostenido: la física, no la arreglamos)
 *
 * No es aleatorio (Math.random está prohibido y rompe reproducibilidad): la
 * distribución de blips es determinista, calcada de lo observado (la mayoría
 * de Failed-to-fetch son 1 blip aislado; el offline sostenido es minoría).
 */
import { fetchWithChallenge, NETWORK_RETRIES } from '@/lib/api/fetchWithChallenge'

jest.mock('@/lib/observability/client', () => ({ emitClientEvent: jest.fn() }))

const ok = () => new Response(JSON.stringify({ success: true }), { status: 200 })

/** fetch que lanza `blips` TypeError seguidos y luego conecta (blips=Infinity = offline). */
function flakyFetch(blips: number) {
  let n = 0
  return jest.fn(async () => {
    if (n++ < blips) throw new TypeError('Failed to fetch')
    return ok()
  })
}

// Distribución determinista de una tanda de sesiones (nº de blips consecutivos
// antes de conectar). Refleja lo observado: dominan los blips cortos; unas pocas
// offline sostenido. Total 20 sesiones.
const SESSIONS: number[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 10 sin blip (caso feliz)
  1, 1, 1, 1, 1,               // 5 con 1 blip → recuperables
  2, 2,                        // 2 con 2 blips → recuperables (límite del backoff)
  Infinity, Infinity, Infinity, // 3 offline sostenido → NO recuperables
]

describe('SIMULACIÓN — recuperación ante blips de red', () => {
  let originalFetch: typeof global.fetch
  beforeEach(() => { originalFetch = global.fetch; jest.useFakeTimers() })
  afterEach(() => { global.fetch = originalFetch; jest.useRealTimers() })

  it('recupera todas las sesiones con <= NETWORK_RETRIES blips; solo cae el offline sostenido', async () => {
    let recovered = 0
    let failed = 0

    for (const blips of SESSIONS) {
      global.fetch = flakyFetch(blips) as unknown as typeof global.fetch
      const p = fetchWithChallenge('/api/questions/filtered', { method: 'POST' })
      // Consumir con manejo de rechazo para evitar unhandled rejection.
      const settled = p.then(() => 'ok').catch(() => 'fail')
      await jest.runAllTimersAsync()
      const outcome = await settled
      if (outcome === 'ok') recovered++
      else failed++
    }

    // Recuperables: las que tienen <= NETWORK_RETRIES blips (10 sin blip + 5 + 2).
    const expectedRecovered = SESSIONS.filter((b) => b <= NETWORK_RETRIES).length
    const expectedFailed = SESSIONS.filter((b) => b > NETWORK_RETRIES).length

    expect(recovered).toBe(expectedRecovered) // 17/20 salvadas por el fix
    expect(failed).toBe(expectedFailed)       // 3/20 offline sostenido (irrecuperable)
    expect(expectedRecovered).toBeGreaterThan(expectedFailed)
  })
})
