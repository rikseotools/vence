// Next.js instrumentation.
// Observabilidad 100% in-house (Sentry retirado 05/07/2026). No hay init de
// terceros; `emit()` es stateless (no requiere registro global).
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Captura de errores (stateless, sin init):
  //   - API routes → withErrorLogging (validation_error_logs + observable_events)
  //   - Render/route errors server-side → onRequestError (abajo)
  //   - Cliente → lib/observability/client.ts
  //
  // Sampler de event-loop lag (T-075, Capa 5 del postmortem 21/07): el
  // frontend corre como contenedor Fargate de larga vida (`server-keepalive.cjs`),
  // así que `register()` se ejecuta una vez al arrancar y el proceso persiste →
  // un sampler con setInterval vive como daemon. Solo en el runtime Node
  // (el Edge runtime no tiene `perf_hooks`).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startEventLoopLagSampler } = await import(
      '@/lib/observability/eventLoopLag'
    )
    startEventLoopLagSampler()
  }
}

export const onRequestError = async (
  err: { digest?: string } & Error,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string };
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
    renderSource:
      | 'react-server-components'
      | 'react-server-components-payload'
      | 'server-rendering';
    revalidateReason: 'on-demand' | 'stale' | undefined;
    renderType: 'dynamic' | 'dynamic-resume';
  },
) => {
  // Errores de render/route server-side (Server Components, SSR) que
  // withErrorLogging (que envuelve API routes) NO captura. → observable_events.
  try {
    const { emit } = await import('@/lib/observability/emit');
    await emit({
      source: 'vercel',
      severity: 'error',
      eventType: 'server_render_error',
      endpoint: request.path,
      errorMessage: (err?.message || 'render error').slice(0, 2000),
      metadata: {
        method: request.method,
        digest: err?.digest ?? null,
        routeType: context?.routeType,
        routePath: context?.routePath,
        renderSource: context?.renderSource,
        stack: (err?.stack || '').slice(0, 2000),
      },
    });
  } catch {
    // observabilidad caída jamás rompe el runtime
  }
};
