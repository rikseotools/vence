'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isProduction = process.env.NODE_ENV === 'production';

// Debug: ALWAYS log to see what's happening
if (typeof window !== 'undefined') {
  console.log('[Sentry] DSN check:', {
    dsn: dsn ? dsn.substring(0, 30) + '...' : 'UNDEFINED',
    hasDsn: !!dsn,
    env: process.env.NODE_ENV
  });
}

// Initialize Sentry on the client side
if (typeof window !== 'undefined' && dsn) {
  console.log('[Sentry] Client SDK initializing...');

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    debug: !isProduction,
    enabled: true,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: isProduction ? 0.1 : 0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    ignoreErrors: [
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      'AbortError',
      'The operation was aborted',
    ],
    environment: isProduction ? 'production' : 'development',
  });

  console.log('[Sentry] Client SDK initialized successfully');
}

export default function SentryInit() {
  useEffect(() => {
    if (!dsn) {
      console.warn('[Sentry] DSN not available - error tracking disabled');
    }
  }, []);

  return null;
}
