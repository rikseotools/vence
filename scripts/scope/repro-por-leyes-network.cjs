// scripts/scope/repro-por-leyes-network.cjs
//
// REPRODUCCIÓN ACTIVA del fix A (feedback Alfonso #1, 25/07). Simula un BLIP de red del
// cliente sobre /api/laws-configurator en /test/por-leyes y demuestra que:
//   A) blip TRANSITORIO (1 aborto, luego OK) → la página se RECUPERA (fetchWithChallenge
//      reintenta) y NO muestra "Error al cargar". ← lo que antes veía Alfonso.
//   B) caída SOSTENIDA (todos los intentos abortados) → tras los reintentos FINITOS
//      (NETWORK_RETRIES=2 → 3 intentos) sí muestra el error controlado (no cuelga).
//
// Prueba directa lo que la observabilidad no pudo captar en su reporte (su dispositivo
// no llegó ni a enviar eventos). Uso: node scripts/scope/repro-por-leyes-network.cjs
const { chromium } = require('@playwright/test')

const BASE = process.env.REPRO_BASE || 'http://127.0.0.1:3100'
const EP = '**/api/laws-configurator**'

let fails = 0
const ok = (c, m) => { console.log(`  ${c ? '✅' : '❌'} ${m}`); if (!c) fails++ }

async function run() {
  const browser = await chromium.launch({ headless: true })

  // ── TEST A: blip transitorio → recuperación ──
  console.log('\n── TEST A: 1 blip de red y recuperación ──')
  {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    let attempts = 0
    await ctx.route(EP, route => {
      attempts++
      if (attempts === 1) return route.abort('failed') // el blip
      return route.continue()                            // los reintentos pasan
    })
    await page.goto(`${BASE}/test/por-leyes`, { waitUntil: 'domcontentloaded' })
    // esperar a que resuelva la carga
    await page.waitForTimeout(6000)
    const errorShown = await page.getByRole('heading', { name: /Error al cargar/i }).count()
    const bodyText = (await page.locator('body').innerText()).slice(0, 4000)
    const recovered = /Configura tu Test|Filtrar por Leyes|Filtrar por Artículos|leyes seleccionadas|Sin leyes disponibles/i.test(bodyText)
    ok(attempts >= 2, `el endpoint se reintentó (intentos=${attempts}, ≥2)`)
    ok(errorShown === 0, 'NO aparece "Error al cargar" (se recuperó del blip)')
    ok(recovered, 'el configurador de leyes SÍ se renderizó tras el blip')
    await ctx.close()
  }

  // ── TEST B (control): caída sostenida → error controlado tras reintentos finitos ──
  console.log('\n── TEST B (control): caída sostenida ──')
  {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    let attempts = 0
    await ctx.route(EP, route => { attempts++; return route.abort('failed') }) // TODO cae
    await page.goto(`${BASE}/test/por-leyes`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(8000)
    const errorShown = await page.getByRole('heading', { name: /Error al cargar/i }).count()
    ok(attempts === 3, `reintentos FINITOS: 3 intentos exactos (1 + NETWORK_RETRIES=2), medido=${attempts}`)
    ok(errorShown >= 1, 'con caída sostenida SÍ muestra el error controlado (no cuelga infinito)')
    await ctx.close()
  }

  await browser.close()
  console.log(`\n${fails === 0 ? '✅ REPRO OK — el retry recupera el blip y el error sigue acotado' : `❌ ${fails} aserción(es) fallidas`}`)
  process.exit(fails === 0 ? 0 : 1)
}
run().catch(e => { console.error(e); process.exit(1) })
