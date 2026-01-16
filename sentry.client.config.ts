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
  ],

  // Environment tag
  environment: isProduction ? 'production' : 'development',
});
