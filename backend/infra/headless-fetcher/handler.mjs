/**
 * Lambda handler — Headless Fetcher con Puppeteer + Chromium.
 *
 * Renderiza páginas JS-rendered y devuelve el HTML post-hydration, listo para
 * que el backend NestJS lo procese con su `cleanHtml()` + Claude Haiku.
 *
 * Stack: @sparticuz/chromium (binary precompilado optimizado para Lambda) +
 * puppeteer-core (cliente sin browser propio). Es la combinación estándar
 * recomendada por @sparticuz para Lambda.
 *
 * Input (event):
 *   {
 *     url: string                      // URL a renderizar
 *     wait_for?: string                // Selector CSS a esperar antes de devolver
 *                                      // HTML. Default: networkidle0.
 *     timeout_ms?: number              // Timeout fetch+render. Default 30000.
 *     user_agent?: string              // UA custom. Default: stealth realista.
 *     viewport?: { width, height }     // Default 1366x768
 *   }
 *
 * Output:
 *   {
 *     ok: boolean
 *     status: number                   // HTTP status de la navegación
 *     html: string | null              // HTML rendido tras hydration
 *     final_url: string                // URL final tras redirects
 *     render_time_ms: number           // Tiempo de render (sin cold start)
 *     error?: string                   // Mensaje si ok=false
 *   }
 *
 * Roadmap: docs/roadmap/deteccion-convocatorias-oeps-completo.md (Fase 1)
 * Audit:   docs/maintenance/audit-seguimiento-coverage.md
 */

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// APIs de configuración de @sparticuz/chromium 117+: hay que llamarlas ANTES
// de `executablePath()`. Sin ellas Chromium puede no inicializar bien en
// Lambda y se obtiene "Navigating frame was detached".
chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const DEFAULT_VIEWPORT = { width: 1366, height: 768 };

// Cache del browser entre invocaciones warm. Cold start lanza Chromium una
// sola vez; mientras la Lambda esté caliente, las siguientes invocaciones
// reutilizan el proceso.
let cachedBrowser = null;

async function getBrowser() {
  if (cachedBrowser && cachedBrowser.connected) {
    return cachedBrowser;
  }

  cachedBrowser = await puppeteer.launch({
    args: [
      ...chromium.args,
      '--disable-blink-features=AutomationControlled',
      '--disable-features=site-per-process',
    ],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });

  return cachedBrowser;
}

async function renderUrl(input) {
  const url = input.url;
  if (!url || typeof url !== 'string') {
    return { ok: false, status: 0, html: null, final_url: '', render_time_ms: 0, error: 'missing or invalid url' };
  }

  const waitFor = input.wait_for ?? null;
  const timeoutMs = Math.min(input.timeout_ms ?? DEFAULT_TIMEOUT_MS, 55_000);
  const userAgent = input.user_agent ?? DEFAULT_USER_AGENT;
  const viewport = input.viewport ?? DEFAULT_VIEWPORT;

  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.setUserAgent(userAgent);
  await page.setViewport(viewport);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  });

  // Stealth: ocultar señales típicas de Puppeteer.
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // eslint-disable-next-line no-undef
    window.chrome = { runtime: {} };
  });

  const t0 = Date.now();
  let status = 0;
  let finalUrl = url;
  let html = null;
  let error;

  try {
    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: timeoutMs,
    });

    if (response) {
      status = response.status();
      finalUrl = response.url();
    }

    if (waitFor) {
      try {
        await page.waitForSelector(waitFor, { timeout: Math.min(10_000, timeoutMs / 3) });
      } catch (_e) {
        // Selector no apareció — devolvemos el HTML actual igualmente.
      }
    }

    html = await page.content();
  } catch (e) {
    error = e?.message ?? String(e);
    try {
      html = await page.content();
    } catch (_) {
      /* ignore */
    }
  } finally {
    await page.close().catch(() => {});
  }

  const renderTimeMs = Date.now() - t0;

  return {
    ok: !error && status >= 200 && status < 400,
    status,
    html,
    final_url: finalUrl,
    render_time_ms: renderTimeMs,
    error,
  };
}

async function emitTelemetry(result, input) {
  const url = process.env.OBSERVABILITY_INGEST_URL;
  if (!url) return;

  const payload = {
    source: 'lambda-headless-fetcher',
    severity: result.ok ? 'info' : 'error',
    event_type: 'headless_fetch',
    endpoint: input.url,
    duration_ms: result.render_time_ms,
    error_message: result.error,
    metadata: {
      status: result.status,
      final_url: result.final_url,
      html_bytes: result.html?.length ?? 0,
    },
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2_000),
    });
  } catch (_e) {
    // Telemetría caída ≠ fetch caído. No propagamos.
  }
}

export const handler = async (event) => {
  const input = typeof event === 'string' ? JSON.parse(event) : event;
  const result = await renderUrl(input);
  await emitTelemetry(result, input);
  return result;
};
