// Journey AUTENTICADO (auth propia, sin Supabase): un usuario con oposición ve
// "Test combinando leyes" SCOPED a su temario, sin "Error al cargar", con badges.
// Reproduce el escenario del incidente Alfonso (celador_murcia) con una CUENTA DE TEST.
//
// Identidad = la MISMA cuenta de test que el resto de canaries del sistema: SMOKE_USER_ID
// (SSM /vence-backend/SMOKE_USER_ID). NUNCA un cliente real. Overridable por SIM_IDENTITY_*.
// Sin SMOKE_USER_ID → el runner SALTA este journey (no falla).
import { requestIsScopedTo } from '../../../lib/sim/invariants'
import type { InvariantResult } from '../../../lib/sim/types'
import type { Journey } from '../../../lib/sim/journey'

const USER_ID = process.env.SIM_IDENTITY_USER_ID || process.env.SMOKE_USER_ID || ''
const EMAIL = process.env.SIM_IDENTITY_EMAIL || 'smoke@vence.es'
const POSITION = process.env.SIM_IDENTITY_POSITION || 'celador_murcia'

const journey: Journey = {
  name: 'user-scoped-por-leyes',
  severity: 'high',
  as: { userId: USER_ID, email: EMAIL, label: POSITION, positionType: POSITION },
  async run(ctx) {
    // Navegar PRIMERO establece el origen (fetch desde about:blank falla) y la sesión.
    await ctx.step('cargar /test/por-leyes (scoped)', () => ctx.goto('/test/por-leyes'), { shot: true })
    const tok = await ctx.step('validar sesión propia (/api/auth/token)', () => ctx.api('/api/auth/token'))
    await ctx.step('esperar leyes', () => ctx.page.waitForTimeout(6000))

    const lawsUrl = ctx.lastRequest('/api/laws-configurator')
    const errorShown = (await ctx.seesText(/Error al cargar/i)) > 0
    const badges = await ctx.seesText(/toda la ley/i)
    await ctx.screenshot('vista-scoped')

    const inv: InvariantResult[] = [
      { name: 'session_valid', ok: tok.status === 200, detail: tok.status !== 200 ? `/api/auth/token ${tok.status}` : undefined },
      requestIsScopedTo(lawsUrl, POSITION),
      { name: 'no_error_screen', ok: !errorShown, detail: errorShown ? '"Error al cargar" visible para su cuenta' : undefined },
      { name: 'badges_render', ok: badges > 0, detail: badges === 0 ? 'sin badges "toda la ley"' : undefined },
    ]
    return inv
  },
}
export default journey
