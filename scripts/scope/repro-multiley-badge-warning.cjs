// scripts/scope/repro-multiley-badge-warning.cjs
//
// REPRODUCCIÓN UI del fix B (feedback Alfonso #2, 25/07) contra el app VIVO. Dirige el
// configurador "Test combinando leyes" en un navegador real y demuestra que:
//   1) cada ley seleccionada sin acotar muestra el badge "toda la ley" (visibilidad).
//   2) al acotar UNA ley a artículos (dejando otras enteras), aparece el AVISO del caso
//      mixto ("Mezclas leyes acotadas con leyes completas") — justo lo que le faltaba a
//      Alfonso para entender por qué "salían preguntas fuera".
//
// Uso: REPRO_BASE=https://www.vence.es node scripts/scope/repro-multiley-badge-warning.cjs
const { chromium } = require('@playwright/test')

const BASE = process.env.REPRO_BASE || 'https://www.vence.es'
let fails = 0
const ok = (c, m) => { console.log(`  ${c ? '✅' : '❌'} ${m}`); if (!c) fails++ }

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext()).newPage()
  await page.goto(`${BASE}/test/por-leyes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(5000)

  console.log('\n── Estado inicial: leyes seleccionadas sin acotar ──')
  const badgesWhole = await page.getByText(/toda la ley/i).count()
  ok(badgesWhole > 0, `badge "toda la ley" renderiza en vivo (${badgesWhole} leyes)`)
  const warnBefore = await page.getByText(/Mezclas leyes acotadas con leyes completas/i).count()
  ok(warnBefore === 0, 'sin acotar ninguna, el aviso mixto NO aparece (no molesta cuando no toca)')

  console.log('\n── Acoto UNA ley (Ley 40/2015) a artículos ──')
  const search = page.getByPlaceholder(/buscar/i)
  if (await search.count()) { await search.first().fill('Ley 40/2015'); await page.waitForTimeout(1200) }
  await page.getByRole('button', { name: /Artículos/i }).first().click()
  await page.waitForTimeout(1500)

  // En el modal: dejar solo un subconjunto → deseleccionar todos y marcar unos pocos.
  const modalDesel = page.getByRole('button', { name: /Deseleccionar todos/i })
  if (await modalDesel.count()) { await modalDesel.first().click(); await page.waitForTimeout(500) }
  // marcar los primeros checkboxes de artículo visibles dentro del modal
  const modal = page.locator('.fixed, [role="dialog"]').filter({ hasText: /Aplicar filtro/i }).first()
  const artChecks = modal.locator('input[type="checkbox"]')
  const n = Math.min(4, await artChecks.count())
  for (let i = 0; i < n; i++) { await artChecks.nth(i).check({ force: true }).catch(() => {}) }
  ok(n > 0, `seleccionados ${n} artículos en el modal`)
  await page.getByRole('button', { name: /Aplicar filtro/i }).click()
  await page.waitForTimeout(1500)

  console.log('\n── Resultado: estado MIXTO (una acotada + resto enteras) ──')
  // limpiar el buscador para ver toda la lista + el aviso
  if (await search.count()) { await search.first().fill(''); await page.waitForTimeout(800) }
  const warnAfter = await page.getByText(/Mezclas leyes acotadas con leyes completas/i).count()
  const badgeArticulos = await page.getByText(/\d+\s+artículos?/).count()
  ok(warnAfter >= 1, 'aparece el AVISO del caso mixto tras acotar una ley')
  ok(badgeArticulos >= 1, 'aparece al menos un badge "N artículos" (ley acotada)')

  await browser.close()
  console.log(`\n${fails === 0 ? '✅ REPRO UI OK — badge + aviso mixto renderizan en el app vivo' : `❌ ${fails} aserción(es) fallidas`}`)
  process.exit(fails === 0 ? 0 : 1)
}
run().catch(e => { console.error(e); process.exit(1) })
