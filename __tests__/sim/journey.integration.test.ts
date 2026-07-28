// Integración: ejecuta un JOURNEY real contra un JourneyCtx SIMULADO (sin Playwright ni
// red). Prueba que el journey cablea bien sus invariantes y que el runner deriva el
// veredicto correcto — el "contrato" entre journey ↔ core, sin depender de producción.
import blipJourney from '../../scripts/sim/journeys/por-leyes-network-blip'
import examenJourney from '../../scripts/sim/journeys/examen-controles-flotantes'
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

// ── Journey de los controles flotantes del examen (bug Manolo) ────────────────────────────
//
// El ctx simulado imita lo único que ese journey mira del navegador: `page.evaluate`, que usa
// para (a) medir cada control (visible / quién recibe el clic / a qué altura) y (b) saber qué
// pregunta quedó centrada tras cada salto. Así se prueba el CABLEADO —que el journey juzga con
// el invariante correcto y que un control tapado tumba el veredicto— sin navegador ni prod.
function mockCtxExamen(opts: {
  hayPreguntas?: boolean
  occludedBy?: string | null
  topPx?: number
  cabeceraBottomPx?: number
  /** el botón de cuenta atrás NO cambia el reloj (simula que el clic no llegó) */
  relojNoAlterna?: boolean
  centradas?: (string | null)[]
}) {
  const steps: StepOutcome[] = []
  const centradas = opts.centradas ?? ['pregunta-3', 'pregunta-7', 'pregunta-3']
  let saltos = 0
  let modo = '⏱️ 0:05'
  const page = {
    async evaluate(fn: any, arg?: any) {
      const src = String(fn)
      // medirControl(selector) → el journey pasa el selector como argumento
      if (typeof arg === 'string') {
        return {
          visible: true,
          occludedBy: opts.occludedBy ?? null,
          topPx: opts.topPx ?? 116,
          cabeceraBottomPx: opts.cabeceraBottomPx ?? 105,
        }
      }
      // preguntaCentrada()
      if (/pregunta-/.test(src)) return centradas[Math.min(saltos++, centradas.length - 1)]
      return undefined // window.scrollTo
    },
    async waitForTimeout() {},
    locator(sel: string) {
      return {
        count: async () => (opts.hayPreguntas === false ? 0 : 25),
        innerText: async () => modo,
        click: async () => {
          if (sel.includes('cuenta atrás') && !opts.relojNoAlterna) modo = '⏳ 24:55'
        },
      }
    },
  }
  const ctx = {
    base: 'http://sim', positionType: 'auxiliar_administrativo_estado', page,
    async goto() {}, async api() { return { status: 200, json: {} } },
    lastRequest() { return null }, async injectFault() {},
    async screenshot() { return 'shot.png' }, async seesText() { return 0 }, async countRole() { return 0 },
    async step(name: string, fn: () => Promise<any>) {
      try { const v = await fn(); steps.push({ step: name, ok: true }); return v }
      catch (e: any) { steps.push({ step: name, ok: false, detail: e?.message }); throw e }
    },
  } as unknown as JourneyCtx
  return { ctx, steps }
}

describe('journey examen-controles-flotantes (contra ctx simulado)', () => {
  it('TODO BIEN: controles alcanzables, el reloj alterna y el salto va y vuelve', async () => {
    const { ctx, steps } = mockCtxExamen({})
    const inv = await examenJourney.run(ctx)
    expect(inv.every(i => i.ok)).toBe(true)
    expect(inv.map(i => i.name)).toEqual(expect.arrayContaining([
      'floating_control_reachable:reloj',
      'floating_control_reachable:ir a la siguiente en blanco',
      'reloj_alterna_modo',
      'salto_en_blanco_avanza',
      'salto_en_blanco_retrocede',
    ]))
    expect(verdictOf(steps, inv).passed).toBe(true)
  })

  it('EL BUG DE MANOLO: los controles quedan detrás de la cabecera → veredicto failed', async () => {
    const { ctx, steps } = mockCtxExamen({ occludedBy: 'header.sticky' })
    const inv = await examenJourney.run(ctx)
    const tapados = inv.filter(i => i.name.startsWith('floating_control_reachable') && !i.ok)
    expect(tapados).toHaveLength(3)
    expect(tapados[0].detail).toMatch(/tapado por header/)
    expect(verdictOf(steps, inv).passed).toBe(false)
  })

  it('el salto que no mueve de pregunta falla, aunque los controles se vean', async () => {
    const { ctx, steps } = mockCtxExamen({ centradas: ['pregunta-3', 'pregunta-3', 'pregunta-3'] })
    const inv = await examenJourney.run(ctx)
    expect(inv.find(i => i.name === 'salto_en_blanco_avanza')?.ok).toBe(false)
    expect(verdictOf(steps, inv).passed).toBe(false)
  })

  it('el reloj que no pasa a cuenta atrás falla (el clic no llegó al botón)', async () => {
    const { ctx } = mockCtxExamen({ relojNoAlterna: true })
    const inv = await examenJourney.run(ctx)
    expect(inv.find(i => i.name === 'reloj_alterna_modo')?.ok).toBe(false)
  })

  it('sin preguntas cargadas no juzga los controles: lo dice y para', async () => {
    const { ctx } = mockCtxExamen({ hayPreguntas: false })
    const inv = await examenJourney.run(ctx)
    expect(inv).toEqual([expect.objectContaining({ name: 'examen_cargado', ok: false })])
  })

  it('metadatos del journey correctos (nombre + severidad + corre autenticado)', () => {
    expect(examenJourney.name).toBe('examen-controles-flotantes')
    expect(examenJourney.severity).toBe('high')
    expect(examenJourney.as).toBeDefined()
  })
})
