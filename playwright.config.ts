/**
 * Playwright E2E config — Bloque 5 Fase E.4.1
 *
 * Suite mínima de smoke crítico que valida el frontend en dos entornos en
 * paralelo (preview AWS + producción Vercel). Bloquea cutover si preview
 * regresa donde producción funciona.
 *
 * Inspirado en VicoHR — patrones validados en producción:
 *   - 2 suites (canary 24/7 + regression CI)
 *   - forbidOnly en CI bloquea merges con .only/.skip
 *   - Timeouts probados (action 10s, nav 30s, test 60s)
 *   - Reporters layered (github + list + html)
 *
 * Modos de ejecución:
 *   npm run test:e2e               # ambos entornos (preview AWS + prod Vercel)
 *   npm run test:e2e:preview       # solo preview AWS
 *   npm run test:e2e:prod          # solo prod Vercel (baseline)
 *   npm run test:e2e -- -g "home"  # solo tests que matcheen "home"
 *
 * Override de URLs (raro):
 *   PREVIEW_URL=https://otra.vence.es npm run test:e2e
 *   PROD_URL=https://staging.vence.es npm run test:e2e
 */
import { defineConfig, devices } from '@playwright/test'

const PREVIEW_URL = process.env.PREVIEW_URL ?? 'https://preview-aws.vence.es'
const PROD_URL = process.env.PROD_URL ?? 'https://www.vence.es'
const IS_CI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // En CI fallar rápido si hay tests con .only/.skip — bloquea merges con
  // tests modificados a mano que ocultaron casos.
  forbidOnly: IS_CI,
  // Reintentos: CI 2× (red GHA puede flaquear), local 0× (queremos
  // fallos deterministas en dev).
  retries: IS_CI ? 2 : 0,
  // Paralelismo: respetuoso con prod — 2 workers en CI, 3 local. Cada
  // worker corre los proyectos secuencialmente, así nunca más de 6 reqs
  // simultáneas contra Vercel/AWS.
  workers: IS_CI ? 2 : 3,
  // Reporters: html siempre + github (annotations) + list (legible).
  reporter: IS_CI
    ? [['html', { open: 'never' }], ['list'], ['github']]
    : [['html', { open: 'on-failure' }], ['list']],
  // Timeouts:
  //   - test: 60s (un spec lento partir)
  //   - expect: 10s (cargas ECS sin warm tardan)
  //   - actionTimeout: 10s (clicks, fills)
  //   - navigationTimeout: 30s (CloudFront miss + SSR)
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: IS_CI ? 'retain-on-failure' : 'off',
    // User-Agent identificable: NO contar como "usuario real" en analytics.
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Playwright/Vence-E2E',
    // Header detectable por backend si quisiéramos rate-limit-exempt o
    // marcado en observable_events.
    extraHTTPHeaders: {
      'x-vence-e2e': '1',
    },
  },
  projects: [
    {
      name: 'preview-aws',
      use: { ...devices['Desktop Chrome'], baseURL: PREVIEW_URL },
    },
    {
      name: 'prod-vercel',
      use: { ...devices['Desktop Chrome'], baseURL: PROD_URL },
    },
  ],
})
