// backend/src/instrument.ts
//
// Inicialización de Sentry para el backend NestJS/Fargate.
// DEBE importarse ANTES que cualquier otro código (require/import) en
// main.ts para que la instrumentación auto se aplique a Nest internals.
//
// Bloque 4 — Gap b del audit "Sentry funcionando":
// Antes de hoy el backend NO tenía SDK Sentry → errores en endpoints
// del backend (/api/v2/answer-and-save, etc.) NO llegaban a Sentry,
// solo a observable_events + CloudWatch Logs. Ahora Sentry los recibe
// también para Session Replay correlation, grouping, releases y dashboard.
//
// Habilitado SOLO si SENTRY_DSN existe — operación degradada si falta
// (no rompe arranque del backend).

import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const dsn =
  process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? null;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.GIT_COMMIT_SHA?.slice(0, 8),

    // Performance: 10% sample (igual que frontend, consistente)
    tracesSampleRate: 0.1,

    // Profiling: 10% de los traces se profileean
    profilesSampleRate: 0.1,

    integrations: [
      // Profiling de CPU/memoria — ayuda a detectar endpoint lentos
      nodeProfilingIntegration(),
    ],

    // Ignorar errores esperados que no son señal
    ignoreErrors: [
      // Cliente abortó request (network, navigation) — no es nuestro bug
      'AbortError',
      'The operation was aborted',
      // Timeouts BD que ya capturamos con quick-fail (DbTimeoutError)
      // — el ExceptionFilter los emite a observable_events; en Sentry
      // queremos verlos para correlación, pero filtrar si son spam
      // bajamos sampleRate específico via beforeSend.
    ],

    beforeSend(event, hint) {
      try {
        // Si el error original es un timeout esperado (quick-fail),
        // marcar como warning para no inflar las criticas en Sentry
        const err = hint?.originalException;
        if (
          err &&
          typeof err === 'object' &&
          'name' in err &&
          (err as { name?: string }).name === 'TimeoutError'
        ) {
          event.level = 'warning';
          event.tags = {
            ...event.tags,
            quick_fail: 'true',
          };
        }
        // Tag source consistente con el resto de observabilidad
        event.tags = {
          ...event.tags,
          source: 'fargate',
          service: 'vence-backend',
        };
      } catch {
        /* never break Sentry */
      }
      return event;
    },
  });

  // eslint-disable-next-line no-console
  console.log(
    `[Sentry] backend inicializado (env=${process.env.NODE_ENV}, dsn=${dsn.slice(0, 40)}...)`,
  );
} else {
  // eslint-disable-next-line no-console
  console.warn(
    '[Sentry] DSN no configurada (SENTRY_DSN o NEXT_PUBLIC_SENTRY_DSN) — backend Sentry deshabilitado',
  );
}
