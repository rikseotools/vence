// Diagnóstico runtime: inyecta sesión admin en localStorage, carga /admin headless
// y captura qué Authorization manda el navegador a /api/admin/* + los 401 + consola.
const { chromium } = require('playwright')
const fs = require('fs')

const SESSION = JSON.parse(fs.readFileSync('/tmp/admin_session.json', 'utf8'))
const STORAGE_KEY = 'sb-auth-auth'
const BASE = 'http://localhost:3000'

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  const adminReqs = []
  page.on('request', (req) => {
    const u = req.url()
    if (/\/api\/(v2\/)?admin\//.test(u)) {
      adminReqs.push({ url: u.replace(BASE, ''), auth: req.headers()['authorization'] ? 'Bearer ✅' : '❌ SIN AUTH' })
    }
  })
  const adminResp = []
  page.on('response', (res) => {
    const u = res.url()
    if (/\/api\/(v2\/)?admin\//.test(u)) adminResp.push({ url: u.replace(BASE, ''), status: res.status() })
  })
  const logs = []
  page.on('console', (m) => { if (m.type() === 'error' || /token|auth|401|sesi/i.test(m.text())) logs.push(`[${m.type()}] ${m.text().slice(0, 160)}`) })

  // 1) inyectar sesión ANTES de cualquier script (canónico para pre-auth en Playwright)
  const storageValue = JSON.stringify(SESSION)
  await ctx.addInitScript(({ key, value }) => {
    try { window.localStorage.setItem(key, value) } catch {}
  }, { key: STORAGE_KEY, value: storageValue })

  // 2) cargar /admin directamente (el singleton supabase leerá la sesión al init)
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })

  // 3) esperar a que el hook dispare (initialDelay 10s) + margen
  await page.waitForTimeout(16000)

  // 3b) ¿dónde acabó y qué renderizó?
  const finalUrl = page.url()
  const bodyText = (await page.evaluate(() => document.body?.innerText || '')).slice(0, 300).replace(/\n+/g, ' | ')
  const authProbe = await page.evaluate(async () => {
    try {
      // el cliente singleton se exporta como default; intentamos vía window si existe
      const w = window
      if (w.__supabase) {
        const { data } = await w.__supabase.auth.getSession()
        return { via: 'window', hasSession: !!data?.session, token: !!data?.session?.access_token }
      }
      return { via: 'none', note: 'no window.__supabase' }
    } catch (e) { return { error: String(e) } }
  })
  console.log('\n===== URL final =====\n  ' + finalUrl)
  console.log('===== body (300c) =====\n  ' + bodyText)
  console.log('===== sesión vista por cliente =====\n  ' + JSON.stringify(authProbe))

  // 4) qué hay en localStorage + qué ve el cliente
  const ls = await page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (!raw) return { found: false }
    try { const o = JSON.parse(raw); return { found: true, hasAccess: !!o.access_token, expEpoch: o.expires_at } }
    catch { return { found: true, parseError: true } }
  }, STORAGE_KEY)

  console.log('\n===== localStorage[' + STORAGE_KEY + '] =====')
  console.log(JSON.stringify(ls))
  console.log('\n===== PETICIONES a /api/admin/* (Authorization enviado) =====')
  if (!adminReqs.length) console.log('(ninguna — el hook no llegó a disparar?)')
  for (const r of adminReqs) console.log(`  ${r.auth}   ${r.url}`)
  console.log('\n===== RESPUESTAS /api/admin/* (status) =====')
  for (const r of adminResp) console.log(`  ${r.status}   ${r.url}`)
  console.log('\n===== CONSOLA (errores/auth) =====')
  for (const l of logs.slice(0, 25)) console.log('  ' + l)

  await browser.close()
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
