// scripts/sim/run.ts
//
// Vence Sim — RUNNER. Ejecuta journeys contra el app VIVO: navegador (Playwright) + API
// (desde la sesión del navegador, así la app resuelve el reto anti-scraping) + captura de
// pantalla + inyección de fallos + aserción de invariantes. Emite el resultado de cada
// journey a `observable_events` (event_type='sim_journey_result') y guarda screenshots +
// reporte JSON. Exit 1 si algún journey crítico falla.
//
// Auth PROPIA (AWS/Auth.js), NUNCA Supabase: para journeys con identidad, lee AUTH_SECRET
// de SSM y forja la cookie de sesión (lib/sim/session).
//
// Uso:
//   AWS_PROFILE=vence AWS_REGION=eu-west-2 npx tsx scripts/sim/run.ts [journeyGlob]
//   SIM_BASE=https://www.vence.es SIM_EMIT=1 npx tsx scripts/sim/run.ts por-leyes
import { config as loadEnv } from 'dotenv'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// El runner corre fuera de Next → carga .env.local para DATABASE_URL (emisión de
// observabilidad). No pisa variables ya presentes en el entorno.
if (existsSync('.env.local')) loadEnv({ path: '.env.local' })
import { chromium, type BrowserContext, type Page } from '@playwright/test'
import postgres from 'postgres'
import { mintOwnAuthCookie, cookieForPlaywright } from '../../lib/sim/session'
import { faultHandler } from '../../lib/sim/faults'
import { verdictOf, type SimResult, type StepOutcome } from '../../lib/sim/types'
import { toObservabilityEvent, suiteSummary, oneLineSummary } from '../../lib/sim/report'
import type { Journey, JourneyCtx } from '../../lib/sim/journey'
import { leerArgs, seleccionar } from '../../lib/sim/seleccion'
import { resolverAuthSecret } from '../../lib/sim/secretos'

const BASE = process.env.SIM_BASE || 'https://www.vence.es'
const HOST = new URL(BASE).hostname
const EMIT = process.env.SIM_EMIT === '1'
const REPORT_DIR = process.env.SIM_REPORT_DIR || join(process.cwd(), 'sim-reports', String(Date.now()))
const { filtro: FILTER, soloPostDeploy: SOLO_POST_DEPLOY } = leerArgs(process.argv.slice(2))

let AUTH_SECRET: string | null = null
function authSecret(): string {
  if (AUTH_SECRET) return AUTH_SECRET
  // 1) env (CI canary: viene de un secret de GitHub Actions). 2) fallback SSM (dev con
  // perfil AWS que tenga ssm:GetParameter). Env-first = no dependemos de SSM en runtime.
  // De dónde sale el valor lo decide `lib/sim/secretos.ts` (env-first, SSM como comodidad en
  // local). Es el único punto del harness atado a una nube: al mudarse a koigrid se usa el
  // proveedor `env` y aquí no cambia nada.
  const resuelto = resolverAuthSecret({
    env: process.env,
    ejecutar: (comando: string) => execSync(comando, { encoding: 'utf8' }),
  })
  if (!resuelto) throw new Error('[sim] sin AUTH_SECRET: define SIM_AUTH_SECRET o usa un proveedor de secretos')
  AUTH_SECRET = resuelto
  return AUTH_SECRET
}

async function loadJourneys(): Promise<Journey[]> {
  const dir = join(__dirname, 'journeys')
  const files = readdirSync(dir).filter(f => /\.(ts|js|cjs|mjs)$/.test(f) && !f.endsWith('.d.ts'))
  const out: Journey[] = []
  for (const f of files) {
    const mod = await import(join(dir, f))
    const j: Journey = mod.default || mod.journey
    if (j && j.name) out.push(j)
  }
  return seleccionar(out, { filtro: FILTER, soloPostDeploy: SOLO_POST_DEPLOY })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Un modal a pantalla completa se traga TODOS los clics del journey, y el síntoma que llega es
 * un `locator.click: Timeout` sobre un botón que existe y se ve — un rato perdido buscando un
 * bug del app que no está ahí (28/07: la cuenta de test no tenía edad/género, así que el
 * onboarding se abría encima de cada journey autenticado). Se detecta al navegar y se falla
 * con lo que hay que arreglar, no con el timeout.
 */
async function assertSinModalBloqueante(page: Page): Promise<void> {
  const onboarding = await page
    .locator('text=/necesitamos saber estos datos/i')
    .count()
    .catch(() => 0)
  if (onboarding > 0) {
    throw new Error(
      '[sim] el modal de ONBOARDING está tapando la página: la cuenta de test no está ' +
      'completa (le falta edad, género, ciudad, oposición u onboarding_completed_at). ' +
      'Complétala en user_profiles — si no, ningún journey autenticado puede pulsar nada.',
    )
  }
}

function buildCtx(page: Page, ctxPw: BrowserContext, journey: Journey, steps: StepOutcome[], shotDir: string): JourneyCtx {
  const seen = new Map<string, string>()
  page.on('request', r => {
    for (const p of ['/api/laws-configurator', '/api/questions/filtered', '/api/auth/token']) {
      if (r.url().includes(p)) seen.set(p, r.url())
    }
  })
  let shotN = 0
  return {
    base: BASE,
    positionType: journey.as?.positionType,
    page,
    async goto(path) {
      await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {})
      await assertSinModalBloqueante(page)
    },
    async api(path, init) {
      return page.evaluate(async ({ b, path, init }) => {
        const r = await fetch(b + path, {
          method: init?.method || 'GET', credentials: 'include',
          headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
          body: init?.body ? JSON.stringify(init.body) : undefined,
        })
        let json: any = null; try { json = await r.json() } catch { /* */ }
        return { status: r.status, json }
      }, { b: BASE, path, init: init || null })
    },
    lastRequest(pattern) { return seen.get(pattern) || null },
    async injectFault(fault) {
      const h = faultHandler(fault)
      await ctxPw.route(fault.urlPattern, async route => {
        // adaptamos Playwright Route → AbstractRoute
        await h({
          abort: (c?: string) => route.abort(c as any),
          fulfill: ({ status, body }) => route.fulfill({ status, body }),
          continue: () => route.continue(),
        })
      })
    },
    async screenshot(name) {
      const file = join(shotDir, `${String(++shotN).padStart(2, '0')}-${name.replace(/\W+/g, '_')}.png`)
      await page.screenshot({ path: file, fullPage: false }).catch(() => {})
      return file
    },
    async seesText(re) { return page.getByText(re).count() },
    async countRole(role, name) { return page.getByRole(role as any, { name }).count() },
    async step(name, fn, opts) {
      try {
        const v = await fn()
        const shot = opts?.shot ? await this.screenshot(name) : undefined
        steps.push({ step: name, ok: true, screenshot: shot })
        return v
      } catch (e: any) {
        const shot = await this.screenshot(`FAIL-${name}`)
        steps.push({ step: name, ok: false, detail: e?.message?.slice(0, 200), screenshot: shot })
        throw e
      }
    },
  }
}

async function runJourney(journey: Journey): Promise<SimResult> {
  const startedAt = new Date().toISOString()
  const t0 = Date.now()
  const steps: StepOutcome[] = []
  const shotDir = join(REPORT_DIR, journey.name)
  mkdirSync(shotDir, { recursive: true })

  // Journey autenticado sin secreto disponible → SKIP (no fallo): el canary puede correr
  // los journeys anónimos aunque SIM_AUTH_SECRET no esté configurado. Se resuelve el
  // secreto ANTES de lanzar el navegador para no gastar recursos.
  let cookieValue: string | null = null
  if (journey.as && !journey.as.userId) {
    // Sin cuenta de test (SMOKE_USER_ID) no forjamos sesión de un cliente real → SKIP.
    const finishedAt = new Date().toISOString()
    return {
      journey: journey.name, severity: journey.severity,
      identity: { userId: '', email: journey.as.email, label: journey.as.label },
      startedAt, finishedAt, durationMs: Date.now() - t0,
      steps: [{ step: 'resolver identidad', ok: true, detail: 'SKIP: sin SMOKE_USER_ID/SIM_IDENTITY_USER_ID' }],
      invariants: [], passed: true, skipped: true,
    }
  }
  if (journey.as) {
    try {
      const nowSec = Math.floor(Date.now() / 1000)
      cookieValue = await mintOwnAuthCookie({ userId: journey.as.userId, email: journey.as.email }, authSecret(), { nowSec })
    } catch (e: any) {
      const finishedAt = new Date().toISOString()
      return {
        journey: journey.name, severity: journey.severity,
        identity: { userId: journey.as.userId, email: journey.as.email, label: journey.as.label },
        startedAt, finishedAt, durationMs: Date.now() - t0,
        steps: [{ step: 'resolver sesión', ok: true, detail: 'SKIP: sin AUTH_SECRET/SIM_AUTH_SECRET' }],
        invariants: [], passed: true, skipped: true,
      }
    }
  }

  const browser = await chromium.launch({ headless: true })
  const ctxPw = await browser.newContext()
  // El runner corre bajo `tsx` (esbuild con keepNames): esbuild reescribe las funciones con
  // nombre insertando una llamada al helper `__name`. Cuando un journey serializa una función
  // para el navegador (`page.evaluate`), ese helper viaja con ella pero NO existe allí, y el
  // journey muere con "ReferenceError: __name is not defined" — un fallo del harness que se
  // confunde con un fallo del app. Se define como identidad en cada documento antes de nada,
  // así cualquier journey puede usar `page.evaluate` con normalidad.
  await ctxPw.addInitScript(() => {
    // @ts-expect-error — shim de esbuild en el navegador
    if (typeof window.__name === 'undefined') window.__name = (fn: unknown) => fn
  })
  let error: string | undefined
  let invariants: SimResult['invariants'] = []
  try {
    if (cookieValue) await ctxPw.addCookies([cookieForPlaywright(cookieValue, HOST)])
    const page = await ctxPw.newPage()
    const ctx = buildCtx(page, ctxPw, journey, steps, shotDir)
    invariants = await journey.run(ctx)
  } catch (e: any) {
    error = e?.message?.slice(0, 300) || String(e)
  } finally {
    await browser.close()
  }

  const finishedAt = new Date().toISOString()
  const { passed, firstFailure } = verdictOf(steps, invariants, error)
  return {
    journey: journey.name, severity: journey.severity,
    identity: journey.as ? { userId: journey.as.userId, email: journey.as.email, label: journey.as.label } : null,
    startedAt, finishedAt, durationMs: Date.now() - t0, steps, invariants, passed, firstFailure, error,
  }
}

async function emit(results: SimResult[]) {
  if (!EMIT) return
  if (!process.env.DATABASE_URL) { console.warn('⚠️  [sim] SIM_EMIT=1 pero sin DATABASE_URL → no se emite (no-fatal)'); return }
  // La emisión NUNCA debe tumbar el canary: si la BD no está accesible, se avisa y sigue.
  let sql: ReturnType<typeof postgres> | null = null
  try {
    sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 })
    for (const r of results) {
      const ev = toObservabilityEvent(r)
      await sql`INSERT INTO observable_events (id, ts, source, severity, event_type, endpoint, duration_ms, metadata, created_at)
        VALUES (gen_random_uuid(), now(), ${ev.source}, ${ev.severity}, ${ev.eventType}, ${ev.endpoint}, ${r.durationMs}, ${sql.json(ev.metadata as any)}, now())`
    }
  } catch (e: any) {
    console.warn(`⚠️  [sim] emisión a observable_events falló (no-fatal): ${e?.message?.slice(0, 120)}`)
  } finally { if (sql) await sql.end().catch(() => {}) }
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true })
  const journeys = await loadJourneys()
  if (journeys.length === 0) {
    const motivo = SOLO_POST_DEPLOY
      ? ' marcados para verificar un release (`postDeploy: true`)'
      : FILTER ? ` que casen "${FILTER}"` : ''
    console.error('No hay journeys' + motivo)
    process.exit(2)
  }
  console.log(`▶ Vence Sim — ${journeys.length} journey(s) contra ${BASE}${EMIT ? ' [emit ON]' : ''}\n`)

  const results: SimResult[] = []
  for (const j of journeys) {
    const r = await runJourney(j)
    results.push(r)
    console.log(oneLineSummary(r))
    for (const inv of r.invariants) if (!inv.ok) console.log(`     ↳ ${inv.name}: ${inv.detail}`)
  }

  const summary = suiteSummary(results)
  writeFileSync(join(REPORT_DIR, 'report.json'), JSON.stringify({ base: BASE, summary, results }, null, 2))
  await emit(results)

  const skipNote = summary.skipped ? ` · ${summary.skipped} skip` : ''
  console.log(`\n${summary.ok ? '✅' : '❌'} ${summary.passed}/${summary.ran} journeys OK${skipNote} · reporte: ${REPORT_DIR}`)
  const criticalFailed = results.some(r => !r.passed && (r.severity === 'critical' || r.severity === 'high'))
  process.exit(criticalFailed ? 1 : 0)
}

main().catch(e => { console.error('RUNNER ERR', e); process.exit(3) })
