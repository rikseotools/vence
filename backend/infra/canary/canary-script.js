/**
 * CloudWatch Synthetics canary — Vence preview-aws.
 * Bloque 5 Fase E.4.4 (2026-05-26).
 *
 * Ejecutado por AWS cada 5 min. Si falla 2 veces consecutivas, dispara
 * alarma CloudWatch → SNS → email a venceoposiciones@gmail.com.
 *
 * Steps (cada uno con screenshot automático):
 *   1. GET / → home, status 2xx, body contiene "vence", time <5s
 *   2. GET /auxiliar-administrativo-estado → oposición landing
 *   3. GET /auxiliar-administrativo-estado/temario/tema-1 → SSG BD-dependent
 *   4. GET /api/observability/ingest POST → ingest acepta
 *
 * El framework Synthetics inyecta:
 *   - synthetics.executeStep(name, fn)   — registra duración + screenshot
 *   - synthetics.getDefaultPage()        — browser ya inicializado
 *   - synthetics.takeScreenshot(name)    — screenshot manual
 *   - log                                — logger CloudWatch
 */
const synthetics = require('Synthetics')
const log = require('SyntheticsLogger')

const TARGET = process.env.TARGET_URL || 'https://preview-aws.vence.es'

const apiCanary = async function () {
  log.info(`[vence-canary] target = ${TARGET}`)

  const page = await synthetics.getPage()

  await page.setExtraHTTPHeaders({ 'X-Vence-Canary': 'cloudwatch-synthetics' })

  // ============================================================
  // STEP 1: home
  // ============================================================
  await synthetics.executeStep('home', async () => {
    const startedAt = Date.now()
    // waitUntil:'domcontentloaded' = HTML llegó + parseado.
    // Más rápido que networkidle0 (que espera scripts 3rd party como GA,
    // Sentry, Stripe). Para un canary de "está la web up" es suficiente.
    const resp = await page.goto(TARGET + '/', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    if (!resp) throw new Error('home: no response')
    if (resp.status() < 200 || resp.status() >= 400) {
      throw new Error(`home: status ${resp.status()}`)
    }
    const duration = Date.now() - startedAt
    // Umbral 8s: incluye DNS lookup + SSL + CloudFront miss (cold) + SSR.
    // Si tarda más, hay problema real (ECS sin tasks, CloudFront down, etc.).
    if (duration > 8000) {
      throw new Error(`home: too slow ${duration}ms (umbral 8000ms)`)
    }
    const title = await page.title()
    if (!/vence/i.test(title)) {
      throw new Error(`home: title sin 'vence' — ${title}`)
    }
    log.info(`[home] ${resp.status()} ${duration}ms title="${title}"`)
  })

  // ============================================================
  // STEP 2: oposición landing
  // ============================================================
  await synthetics.executeStep('oposicion-landing', async () => {
    const resp = await page.goto(TARGET + '/auxiliar-administrativo-estado', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    if (!resp || resp.status() >= 400) {
      throw new Error(`oposicion: status ${resp?.status() ?? 'no-resp'}`)
    }
    log.info(`[oposicion-landing] ${resp.status()}`)
  })

  // ============================================================
  // STEP 3: tema (SSG BD-dependent — verifica build accedió a BD)
  // ============================================================
  await synthetics.executeStep('tema-1-ssg', async () => {
    const resp = await page.goto(
      TARGET + '/auxiliar-administrativo-estado/temario/tema-1',
      { waitUntil: 'networkidle0', timeout: 30_000 },
    )
    if (!resp || resp.status() >= 400) {
      throw new Error(`tema-1: status ${resp?.status() ?? 'no-resp'}`)
    }
    // Sanity: contenido real renderizado (>2000 chars en body)
    const bodyLen = await page.evaluate(() => document.body.textContent.length)
    if (bodyLen < 2000) {
      throw new Error(`tema-1: body sospechosamente vacío (${bodyLen} chars)`)
    }
    log.info(`[tema-1-ssg] ${resp.status()} body=${bodyLen} chars`)
  })

  // ============================================================
  // STEP 4: API observability ingest (POST)
  // ============================================================
  await synthetics.executeStep('observability-ingest', async () => {
    const resp = await page.evaluate(async (url) => {
      try {
        const r = await fetch(url + '/api/observability/ingest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': url,
          },
          body: JSON.stringify({
            events: [
              {
                ts: new Date().toISOString(),
                source: 'frontend',
                severity: 'info',
                eventType: 'custom',
                errorMessage: `canary-cloudwatch-${Date.now()}`,
              },
            ],
          }),
        })
        return { status: r.status, ok: r.ok }
      } catch (e) {
        return { status: 0, error: String(e) }
      }
    }, TARGET)
    if (!resp.ok) {
      throw new Error(`ingest: status ${resp.status} ${resp.error || ''}`)
    }
    log.info(`[observability-ingest] ${resp.status}`)
  })

  log.info('[vence-canary] all steps OK')
}

exports.handler = async () => {
  return await apiCanary()
}
