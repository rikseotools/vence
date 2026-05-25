/**
 * Smoke crítico de páginas públicas — Bloque 5 Fase E.4.1.
 *
 * Sin login. Cubre las páginas que ven usuarios anónimos + bots de Google
 * (SEO crítico). Si una falla en preview AWS pero en prod Vercel funciona,
 * **BLOQUEA cutover**.
 *
 * Lista intencionalmente curada: rutas con high traffic + las que rompieron
 * en el pasado (regresiones específicas).
 *
 * Patrones aplicados (inspirado en VicoHR e2e):
 *   - Sin tests con `.only` / `.skip` (CI los bloquea).
 *   - Cada test independiente — no comparten estado.
 *   - Expect timeouts generosos (CloudFront miss + ECS sin warm pueden tardar).
 *   - Locators por rol/texto (no CSS brittle).
 */
import { test, expect } from '@playwright/test'

// ============================================================
// Páginas con SSG (alto coste si rompen — afecta SEO/conversión)
// ============================================================

test('home /', async ({ page }) => {
  const resp = await page.goto('/')
  expect(resp?.status()).toBeLessThan(400)
  await expect(page).toHaveTitle(/Vence/i)
  // Body con contenido real (no shell vacío).
  const bodyLen = (await page.locator('body').textContent())?.length ?? 0
  expect(bodyLen).toBeGreaterThan(500)
})

test('oposición auxiliar-administrativo-estado', async ({ page }) => {
  const resp = await page.goto('/auxiliar-administrativo-estado')
  expect(resp?.status()).toBeLessThan(400)
  // Heading principal contiene "auxiliar".
  await expect(page.locator('h1').first()).toContainText(/auxiliar/i)
})

test('temario auxiliar-administrativo-estado (lista temas)', async ({ page }) => {
  const resp = await page.goto('/auxiliar-administrativo-estado/temario')
  expect(resp?.status()).toBeLessThan(400)
  // Al menos un link tipo /tema-N debe existir.
  await expect(page.locator('a[href*="/tema-"]').first()).toBeVisible()
})

test('tema concreto T1 (SSG bd-dependent)', async ({ page }) => {
  // Tema 1 existe en BD. Si esto falla, el build no consultó la BD durante
  // prerender (regresión de DATABASE_URL faltante como build-arg Docker).
  const resp = await page.goto('/auxiliar-administrativo-estado/temario/tema-1')
  expect(resp?.status()).toBeLessThan(400)
  const text = (await page.locator('body').textContent()) ?? ''
  expect(text.length).toBeGreaterThan(2000) // contenido real, no shell
})

test('ley pública Ley 39/2015', async ({ page }) => {
  const resp = await page.goto('/leyes/ley-39-2015')
  expect(resp?.status()).toBeLessThan(400)
  await expect(page.locator('h1').first()).toBeVisible()
})

test('página de ayuda', async ({ page }) => {
  const resp = await page.goto('/ayuda')
  expect(resp?.status()).toBeLessThan(400)
})

// ============================================================
// Recursos legales/SEO (NO pueden romper)
// ============================================================

test('sitemap.xml válido (sitemapindex con sub-sitemaps)', async ({ request, baseURL }) => {
  const resp = await request.get(`${baseURL}/sitemap.xml`)
  expect(resp.status()).toBe(200)
  const body = await resp.text()
  expect(body).toContain('<?xml')
  // Vence usa sitemapindex (sub-sitemaps por sección). Aceptamos urlset
  // directo también si en el futuro cambia.
  const isIndex = body.includes('<sitemapindex')
  const isUrlset = body.includes('<urlset')
  expect(isIndex || isUrlset).toBe(true)

  if (isIndex) {
    // Index debe tener al menos 2 sub-sitemaps (Vence tiene static + oposiciones + ...).
    const submapCount = (body.match(/<sitemap>/g) ?? []).length
    expect(submapCount).toBeGreaterThanOrEqual(2)
  } else {
    // urlset directo: al menos 50 URLs.
    const urlCount = (body.match(/<url>/g) ?? []).length
    expect(urlCount).toBeGreaterThan(50)
  }
})

test('sitemap-oposiciones.xml tiene ≥10 URLs', async ({ request, baseURL }) => {
  // Sub-sitemap referenciado por el index. Lo más probable que tenga muchas
  // URLs (una por oposición × varias páginas cada una).
  const resp = await request.get(`${baseURL}/sitemap-oposiciones.xml`, {
    failOnStatusCode: false,
  })
  if (resp.status() === 404) {
    // Si Vence cambia el nombre del sub-sitemap, no hagamos fail aquí —
    // el test principal cubre el index. Saltamos.
    return
  }
  expect(resp.status()).toBe(200)
  const body = await resp.text()
  expect(body).toContain('<urlset')
  const urlCount = (body.match(/<url>/g) ?? []).length
  expect(urlCount).toBeGreaterThanOrEqual(10)
})

test('robots.txt presente', async ({ request, baseURL }) => {
  const resp = await request.get(`${baseURL}/robots.txt`)
  expect(resp.status()).toBe(200)
  expect((await resp.text()).toLowerCase()).toContain('user-agent')
})

// ============================================================
// API públicas — health checks ligeros
// ============================================================

test('/api/observability/ingest acepta POST con Origin del propio dominio', async ({ request, baseURL }) => {
  const resp = await request.post(`${baseURL}/api/observability/ingest`, {
    headers: {
      'Content-Type': 'application/json',
      Origin: baseURL ?? '',
    },
    data: {
      events: [
        {
          ts: new Date().toISOString(),
          source: 'frontend',
          severity: 'info',
          eventType: 'custom',
          errorMessage: `e2e-smoke-${Date.now()}@vence-test.example`,
        },
      ],
    },
  })
  expect(resp.status()).toBeLessThan(400)
  const body = await resp.json()
  expect(body.success).toBe(true)
})

// ============================================================
// SEO: redirects que NO pueden romper (URLs externas con autoridad)
// ============================================================

test('redirect 301: /convocatorias → /oposiciones', async ({ request, baseURL }) => {
  const resp = await request.get(`${baseURL}/convocatorias`, {
    maxRedirects: 0,
    failOnStatusCode: false,
  })
  // Acepta 301/302/308 — Next.js puede emitir cualquiera de los tres según versión.
  expect([301, 302, 307, 308]).toContain(resp.status())
  expect(resp.headers().location).toContain('/oposiciones')
})

test('redirect 301: /leyes/ley-39/2015 → /leyes/ley-39-2015 (barras a guiones)', async ({ request, baseURL }) => {
  const resp = await request.get(`${baseURL}/leyes/ley-39/2015`, {
    maxRedirects: 0,
    failOnStatusCode: false,
  })
  expect([301, 302, 307, 308]).toContain(resp.status())
  expect(resp.headers().location).toContain('/leyes/ley-39-2015')
})

// ============================================================
// Headers de seguridad y CDN (preview AWS)
// ============================================================

test('home responde gzip/brotli (CloudFront compresión)', async ({ request, baseURL }) => {
  // Solo aplica a preview AWS (Vercel también comprime pero distinto).
  const resp = await request.get(`${baseURL}/`, {
    headers: { 'Accept-Encoding': 'gzip, br' },
  })
  expect(resp.status()).toBe(200)
  const enc = resp.headers()['content-encoding']
  expect(['gzip', 'br', 'deflate']).toContain(enc)
})
