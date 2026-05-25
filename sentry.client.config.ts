// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isProduction = process.env.NODE_ENV === 'production';

// Debug: log initialization (remove after confirming it works)
if (typeof window !== 'undefined') {
  console.log('[Sentry Client] Initializing...', {
    hasDsn: !!dsn,
    env: process.env.NODE_ENV,
    isProduction,
  });
}

Sentry.init({
  dsn,

  // Define how likely traces are sampled. Adjust this value in production.
  tracesSampleRate: 0.1,

  // Enable debug temporarily to see what's happening
  debug: !isProduction,

  // Enable in all environments for now to test, then restrict to production
  enabled: true,

  // Session Replay configuration
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: isProduction ? 0.1 : 0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    // Auto-captura fetch 5xx (reemplaza nuestro FetchInterceptor casero —
    // Sentry hace breadcrumbs + integración con releases que el nuestro no).
    // Solo 5xx por defecto: 4xx típicamente son comportamiento esperado
    // (401/403/404). Ampliar a [[400, 599]] si quieres más granularidad.
    Sentry.httpClientIntegration({
      failedRequestStatusCodes: [[500, 599]],
    }),
    // console.error / console.warn → eventos Sentry. Captura logs explícitos
    // que el código emite (típicamente errores manejados que el catch
    // loguea sin relanzar).
    Sentry.captureConsoleIntegration({
      levels: ['error', 'warn'],
    }),
    // Bloque 4 — Web Vitals (LCP, FCP, CLS, INP, TTFB) + page-load tracing.
    // Mide performance real del usuario. Sampling con tracesSampleRate de
    // arriba (0.1 = 10% en producción para no inflar coste Sentry free tier).
    Sentry.browserTracingIntegration(),
  ],

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // Network errors
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    // User cancelled
    'AbortError',
    'The operation was aborted',
    // Sentry Replay trying to serialize DOM elements with React Fiber (not a real bug)
    'Converting circular structure to JSON',
    // Security errors from cross-origin frames, corrupted URLs, or browser extensions
    /SecurityError/,
    // Instagram/Meta WebView internal errors (not our code)
    /enableDidUserTypeOnKeyboardLogging/,
    /Java object is gone/,
    // React DOM removeChild error caused by browser extensions (Google Translate, Grammarly, etc.)
    // that modify the DOM and break React's reconciliation during navigation
    /removeChild.*Node/,
    // window.print() stale callback in Edge (browser-level timing issue)
    /execute 'print' on 'Window'/,
  ],

  // Environment tag
  environment: isProduction ? 'production' : 'development',

  // ════════════════════════════════════════════════════════════
  // Bloque 4 §10 — Espejar eventos Sentry a observable_events
  // ════════════════════════════════════════════════════════════
  // Sentry SIGUE siendo source-of-truth para client-side (Session
  // Replay, breadcrumbs, grouping). Pero también enviamos cada
  // evento a nuestra tabla unificada para queries SQL y alertas
  // custom desde el cron alerts-engine del backend.
  //
  // Por qué via beforeSend hook (no webhook server-side): elimina la
  // necesidad de configurar Internal Integration en el dashboard
  // Sentry. Todo desde código, 0 fricción para el admin.
  //
  // Best-effort: sendBeacon nunca bloquea, errores en el espejo NO
  // afectan a Sentry (devolvemos el event tal cual sí o sí).
  beforeSend(event) {
    try {
      if (typeof window === 'undefined') return event
      if (typeof navigator === 'undefined' || !navigator.sendBeacon) return event

      // Construir payload compatible con el schema observable_events.
      // source='frontend' → endpoint /api/observability/ingest acepta vía
      // Origin check sin secret hardcoded en JS.
      const ex = event.exception?.values?.[0]
      const errorMessage = (
        ex
          ? `${ex.type ?? 'Error'}: ${ex.value ?? ''}`
          : (event.message ?? '(no message)')
      ).slice(0, 2000)

      const severity =
        event.level === 'fatal'
          ? 'critical'
          : event.level === 'error'
            ? 'error'
            : event.level === 'warning'
              ? 'warn'
              : event.level === 'info'
                ? 'info'
                : event.level === 'debug'
                  ? 'debug'
                  : 'error'

      let endpoint: string | null = null
      try {
        if (event.request?.url) {
          endpoint = new URL(event.request.url).pathname
        }
      } catch {
        /* ignore */
      }

      const payload = JSON.stringify({
        events: [
          {
            ts: event.timestamp
              ? new Date(event.timestamp * 1000).toISOString()
              : new Date().toISOString(),
            source: 'frontend',
            severity,
            eventType: 'sentry_event',
            endpoint,
            deployVersion: event.release?.slice(0, 64),
            errorMessage,
            metadata: {
              sentry: {
                eventId: event.event_id,
                environment: event.environment,
                tags: event.tags,
              },
            },
          },
        ],
      })

      // navigator.sendBeacon NO bloquea, supervive navigation
      navigator.sendBeacon('/api/observability/ingest', payload)
    } catch {
      // Espejo es best-effort — JAMÁS romper Sentry
    }
    return event
  },
});
