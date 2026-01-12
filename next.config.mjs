import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Optimizaciones de rendimiento (estables en Next.js 16)
  experimental: {
    optimizeCss: true,
    cssChunking: 'strict',
    inlineCss: true,
    // Required for Sentry instrumentation
    instrumentationHook: true,
  },

  // ✅ Compresión mejorada
  compress: true,

  // ✅ Agregar configuración de SEO y Stripe
  env: {
    SITE_URL: process.env.NODE_ENV === 'production'
      ? 'https://www.vence.es'  // ✅ Con www en producción
      : 'http://localhost:3000',
    // ✅ Forzar exposición de variable Stripe al cliente (fix para Next.js 15.3+)
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },

  // ✅ URL ALIAS CORTA para mejor SEO
  async rewrites() {
    return [
      {
        source: '/test-oposiciones/constitucion-titulos',
        destination: '/test-oposiciones/test-de-la-constitucion-espanola-de-1978'
      },
      // ✅ También alias para las sub-rutas de títulos
      {
        source: '/test-oposiciones/constitucion-titulos/:path*',
        destination: '/test-oposiciones/test-de-la-constitucion-espanola-de-1978/:path*'
      }
    ]
  },

  // ✅ Redirecciones
  async redirects() {
    // Redirecciones mínimas necesarias (rutas que NO existen)
    const testRedirects = [
      // ⚠️ Esta ruta nunca existió en administrativo-estado, redirigir a la nueva
      {
        source: '/administrativo-estado/test/test-aleatorio-examen',
        destination: '/test/aleatorio-examen',
        permanent: false, // 302 temporal para poder cambiar si hay problemas
      },
      // 🔄 Redirecciones de temario viejo gamificado a temario nuevo gratis
      {
        source: '/temario/auxiliar-administrativo-estado/tema/:numero',
        destination: '/auxiliar-administrativo-estado/temario/tema-:numero',
        permanent: true,
      },
      {
        source: '/temario/administrativo-estado/tema/:numero',
        destination: '/administrativo-estado/temario/tema-:numero',
        permanent: true,
      },
    ];

    // Redirigir sin www a con www (solo en producción)
    if (process.env.NODE_ENV === 'production') {
      return [
        ...testRedirects,
        {
          source: '/:path*',
          has: [
            {
              type: 'host',
              value: 'vence.es', // Sin www
            },
          ],
          destination: 'https://www.vence.es/:path*',
          permanent: true,
        },
      ];
    }
    return testRedirects;
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "vence-x2",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically annotate React components to show their full name in breadcrumbs and session replay
  reactComponentAnnotation: {
    enabled: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
};

// Make sure adding Sentry options is the last code to run before exporting
export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
