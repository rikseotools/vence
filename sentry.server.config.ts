// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { tagDbTimeoutEvent } from "@/lib/observability/sentry-hooks";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Define how likely traces are sampled. Adjust this value in production.
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production',

  // Filter out noisy errors
  ignoreErrors: [
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
  ],

  // Phase 3 hardening — captura explícita de quick-fail timeouts
  // (lib/db/timeout.ts:DbTimeoutError). Sin este hook, los timeouts solo
  // aparecen en console.warn de la lambda y se pierden cuando muere.
  // tagDbTimeoutEvent marca cada timeout con tag específico para poder
  // filtrar en el panel Sentry y medir frecuencia (saturación del pooler).
  // NO se silencia (no entra en ignoreErrors) — verlo es la señal que
  // queremos para detectar el siguiente blip del pooler en tiempo real.
  beforeSend: tagDbTimeoutEvent,
});
