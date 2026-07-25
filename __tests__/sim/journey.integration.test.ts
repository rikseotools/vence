// Integración: ejecuta un JOURNEY real contra un JourneyCtx SIMULADO (sin Playwright ni
// red). Prueba que el journey cablea bien sus invariantes y que el runner deriva el
// veredicto correcto — el "contrato" entre journey ↔ core, sin depender de producción.
import blipJourney from '../../scripts/sim/journeys/por-leyes-network-blip'
import { verdictOf, type StepOutcome } from '@/lib/sim/types'
import type { JourneyCtx } from '@/lib/sim/journey'

/** Ctx simulado configurable: controla lo que "ve" el journey. */
function mockCtx(opts: {
  requestsDuringGoto: number
  errorVisible: boolean
  contentVisible: boolean
}): { ctx: JourneyCtx; steps: StepOutcome[] } {
  const steps: StepOutcome[] = []
  let requestCb: ((r: any) => void) | null = null
  const page = {
    on: (ev: string, cb: any) => { if (ev === 'request') requestCb = cb },
    waitForTimeout: async () => {},
  }
  const ctx: JourneyCtx = {
    base: 'http://sim', positionType: undefined, page,
    async goto() {
      // simula N llamadas a laws-configurator (incluye la abortada + reintentos)
      for (let i = 0; i < opts.requestsDuringGoto; i++) requestCb?.({ url: () => '/api/laws-configurator?x' })
    },
    async api() { return { status: 200, json: {} } },
    lastRequest() { return null },
    async injectFault() {},
    async screenshot() { return 'shot.png' },
    async seesText(re: RegExp) {
      if (/Error al cargar/i.test(re.source)) return opts.errorVisible ? 1 : 0
      if (/toda la ley/i.test(re.source)) return opts.contentVisible ? 5 : 0
      return 0
    },
    async countRole(_role: string, re: RegExp) {
      if (/Configura tu Test|Filtrar/i.test(re.source)) return opts.contentVisible ? 1 : 0
      return 0
    },
    async step(name, fn) { try { const v = await fn(); steps.push({ step: name, ok: true }); return v } catch (e: any) { steps.push({ step: name, ok: false, detail: e?.message }); throw e } },
  }
  return { ctx, steps }
}

describe('journey por-leyes-network-blip (contra ctx simulado)', () => {
  it('RECUPERA: 2 intentos, sin error, con contenido → invariante ok + veredicto passed', async () => {
    const { ctx, steps } = mockCtx({ requestsDuringGoto: 2, errorVisible: false, contentVisible: true })
    const inv = await blipJourney.run(ctx)
    expect(inv).toHaveLength(1)
    expect(inv[0].name).toBe('recovered_from_network_blip')
    expect(inv[0].ok).toBe(true)
    expect(verdictOf(steps, inv).passed).toBe(true)
  })

  it('NO RECUPERA: 1 intento (sin retry) → invariante falla + veredicto failed', async () => {
    const { ctx, steps } = mockCtx({ requestsDuringGoto: 1, errorVisible: true, contentVisible: false })
    const inv = await blipJourney.run(ctx)
    expect(inv[0].ok).toBe(false)
    const v = verdictOf(steps, inv)
    expect(v.passed).toBe(false)
    expect(v.firstFailure).toMatch(/recovered_from_network_blip/)
  })

  it('metadatos del journey correctos (nombre + severidad)', () => {
    expect(blipJourney.name).toBe('por-leyes-network-blip')
    expect(blipJourney.severity).toBe('high')
  })
})
