// Journey: el configurador multi-ley HACE VISIBLE cuando mezclas una ley acotada con
// otra que entra entera (bug Alfonso #2). Acota una ley por su modal y verifica que
// aparece el aviso del caso mixto + los badges.
import { mixedInclusionIsWarned } from '../../../lib/sim/invariants'
import type { Journey } from '../../../lib/sim/journey'

const journey: Journey = {
  name: 'multiley-badge-warning',
  severity: 'medium',
  async run(ctx) {
    await ctx.step('cargar configurador', () => ctx.goto('/test/por-leyes'), { shot: true })
    await ctx.step('esperar leyes', () => ctx.page.waitForTimeout(5000))
    const badgesWhole = await ctx.seesText(/toda la ley/i)

    await ctx.step('acotar una ley a artículos', async () => {
      const search = ctx.page.getByPlaceholder(/buscar/i)
      if (await search.count()) { await search.first().fill('Ley 40/2015'); await ctx.page.waitForTimeout(1200) }
      const artBtn = ctx.page.getByRole('button', { name: /Artículos/i }).first()
      await artBtn.click()
      await ctx.page.waitForTimeout(1500)
      const desel = ctx.page.getByRole('button', { name: /Deseleccionar todos/i })
      if (await desel.count()) { await desel.first().click(); await ctx.page.waitForTimeout(400) }
      const modal = ctx.page.locator('.fixed, [role="dialog"]').filter({ hasText: /Aplicar filtro/i }).first()
      const checks = modal.locator('input[type="checkbox"]')
      const n = Math.min(3, await checks.count())
      for (let i = 0; i < n; i++) await checks.nth(i).check({ force: true }).catch(() => {})
      await ctx.page.getByRole('button', { name: /Aplicar filtro/i }).click()
      await ctx.page.waitForTimeout(1200)
      if (await search.count()) { await search.first().fill(''); await ctx.page.waitForTimeout(800) }
    }, { shot: true })

    const warningShown = (await ctx.seesText(/Mezclas leyes acotadas con leyes completas/i)) > 0
    await ctx.screenshot('estado-mixto')

    return [mixedInclusionIsWarned({ hasNarrowed: true, hasWhole: badgesWhole > 0, warningShown })]
  },
}
export default journey
