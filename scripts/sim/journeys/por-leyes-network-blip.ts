// Journey: la página "Test combinando leyes" se recupera de un BLIP de red del cliente
// (bug Alfonso #1). Inyecta 1 aborto en /api/laws-configurator y verifica que el retry de
// fetchWithChallenge recupera (sin "Error al cargar") en vez de dejar el dead-end.
import { faults } from '../../../lib/sim/faults'
import { recoveredFromBlip } from '../../../lib/sim/invariants'
import type { Journey } from '../../../lib/sim/journey'

const journey: Journey = {
  name: 'por-leyes-network-blip',
  severity: 'high',
  async run(ctx) {
    let attempts = 0
    ctx.page.on('request', (r: any) => { if (r.url().includes('/api/laws-configurator')) attempts++ })

    await ctx.injectFault(faults.networkAbort('**/api/laws-configurator**', 1))
    await ctx.step('cargar /test/por-leyes con 1 blip de red', () => ctx.goto('/test/por-leyes'), { shot: true })
    await ctx.step('esperar recuperación (retry+backoff)', () => ctx.page.waitForTimeout(6000))

    const errorShown = (await ctx.seesText(/Error al cargar/i)) > 0
    const contentRendered =
      (await ctx.countRole('heading', /Configura tu Test|Filtrar por Leyes|Filtrar por Artículos/i)) > 0 ||
      (await ctx.seesText(/toda la ley/i)) > 0
    await ctx.screenshot('resultado-tras-blip')

    return [recoveredFromBlip({ attempts, errorShown, contentRendered })]
  },
}
export default journey
