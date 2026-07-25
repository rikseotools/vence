// scripts/scope/repro-alfonso-authenticated.cjs
//
// REPRODUCCIÓN AUTENTICADA "como el usuario" — auth PROPIA (AWS/Auth.js RS256), SIN
// Supabase (prohibido; el bridge Supabase está desconectado). Forja la cookie de sesión
// Auth.js (`__Secure-authjs.session-token`) cifrada con AUTH_SECRET (leído de SSM en
// memoria, nunca impreso) para un userId dado y corre Playwright bajo esa sesión.
//
// Verifica el fix de Alfonso (celador_murcia) EN SU IDENTIDAD, todo por UI (la app
// resuelve el reto anti-scraping sola; no ensuciamos datos ni respondemos nada):
//   1) sesión propia válida (/api/auth/token 200).
//   2) /test/por-leyes carga SCOPED a su oposición, sin "Error al cargar", con badges.
//   3) al acotar UNA de sus leyes → aparece el AVISO del caso mixto.
//
// El filtrado pregunta-a-pregunta (nada fuera de la selección) se prueba a nivel API en
// scripts/scope/repro-multiley-badge-warning.cjs + la verificación E2E anónima (el
// filtrado por artículo es independiente del userId). Aquí probamos SU experiencia UI.
//
// Uso: AWS_PROFILE=vence AWS_REGION=eu-west-2 node scripts/scope/repro-alfonso-authenticated.cjs
const { execSync } = require('child_process')
const { encode } = require('next-auth/jwt')
const { chromium } = require('@playwright/test')

const BASE = process.env.REPRO_BASE || 'https://www.vence.es'
const USER_ID = process.env.REPRO_USER_ID || '7c6612bd-5eb6-4f60-9f00-73f42be3804b' // Alfonso
const USER_EMAIL = process.env.REPRO_USER_EMAIL || 'alfonsomartinezocho@gmail.com'
const POSITION = process.env.REPRO_POSITION || 'celador_murcia'
const COOKIE = '__Secure-authjs.session-token'

let fails = 0
const ok = (c, m) => { console.log(`  ${c ? '✅' : '❌'} ${m}`); if (!c) fails++ }

async function mintCookie() {
  const secret = execSync(
    'aws ssm get-parameter --name "/vence-frontend/AUTH_SECRET" --with-decryption --query "Parameter.Value" --output text',
    { encoding: 'utf8' },
  ).trim()
  const now = Math.floor(Date.now() / 1000)
  const token = { appUserId: USER_ID, email: USER_EMAIL, name: 'e2e', sub: USER_ID, iat: now, exp: now + 3600, jti: 'e2e-repro' }
  return encode({ token, secret, salt: COOKIE, maxAge: 3600 })
}

async function run() {
  const jwe = await mintCookie()
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  await ctx.addCookies([{ name: COOKIE, value: jwe, domain: 'www.vence.es', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }])
  const page = await ctx.newPage()

  console.log('\n── 1) sesión propia (AWS/Auth.js, sin Supabase) ──')
  let lawsCall = null
  page.on('request', r => { if (r.url().includes('/api/laws-configurator')) lawsCall = r.url() })
  await page.goto(`${BASE}/perfil`, { waitUntil: 'networkidle' })
  const tok = await page.evaluate(async b => { const r = await fetch(b + '/api/auth/token', { credentials: 'include' }); return r.status }, BASE)
  ok(tok === 200, `/api/auth/token 200 (sesión Auth.js propia válida para ${USER_EMAIL})`)

  console.log('\n── 2) /test/por-leyes SCOPED a su oposición ──')
  await page.goto(`${BASE}/test/por-leyes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(6000)
  ok((lawsCall || '').includes(`positionType=${POSITION}`), `laws-configurator SCOPED a ${POSITION} (no anónimo)`)
  ok(await page.getByRole('heading', { name: /Error al cargar/i }).count() === 0, 'sin "Error al cargar" para su cuenta')
  const badgesWhole = await page.getByText(/toda la ley/i).count()
  ok(badgesWhole > 0, `badges "toda la ley" renderizan en su vista scoped (${badgesWhole})`)

  console.log('\n── 3) acoto UNA de SUS leyes → aviso del caso mixto ──')
  const search = page.getByPlaceholder(/buscar/i)
  if (await search.count()) { await search.first().fill('Ley 40/2015'); await page.waitForTimeout(1200) }
  const artBtn = page.getByRole('button', { name: /Artículos/i }).first()
  if (await artBtn.count()) {
    await artBtn.click(); await page.waitForTimeout(1500)
    const desel = page.getByRole('button', { name: /Deseleccionar todos/i })
    if (await desel.count()) { await desel.first().click(); await page.waitForTimeout(400) }
    const modal = page.locator('.fixed, [role="dialog"]').filter({ hasText: /Aplicar filtro/i }).first()
    const checks = modal.locator('input[type="checkbox"]')
    const n = Math.min(3, await checks.count())
    for (let i = 0; i < n; i++) await checks.nth(i).check({ force: true }).catch(() => {})
    await page.getByRole('button', { name: /Aplicar filtro/i }).click()
    await page.waitForTimeout(1200)
    if (await search.count()) { await search.first().fill(''); await page.waitForTimeout(800) }
  }
  const warn = await page.getByText(/Mezclas leyes acotadas con leyes completas/i).count()
  ok(warn >= 1, 'aparece el AVISO del caso mixto en su vista autenticada')

  await browser.close()
  console.log(`\n${fails === 0 ? '✅ REPRO AUTENTICADA OK — como Alfonso (auth propia AWS), scoped + aviso' : `❌ ${fails} fallo(s)`}`)
  process.exit(fails === 0 ? 0 : 1)
}
run().catch(e => { console.error('ERR', e.message); process.exit(1) })
