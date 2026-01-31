import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Optimizaciones de rendimiento (estables en Next.js 16)
  experimental: {
    optimizeCss: true,
    cssChunking: 'strict',
    inlineCss: true,
    // instrumentationHook ya no es necesario en Next.js 15+ (está habilitado por defecto)
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
      // 🔄 Redirect de /convocatorias/* a /oposiciones/ (migración SEO - 702 URLs afectadas)
      // Las páginas de convocatorias individuales fueron eliminadas el 13/01/2026
      {
        source: '/convocatorias',
        destination: '/oposiciones',
        permanent: true, // 301 para transferir autoridad SEO
      },
      {
        source: '/convocatorias/:path*',
        destination: '/oposiciones',
        permanent: true, // 301 para transferir autoridad SEO
      },
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
      // 🔄 Redirecciones de /teoria/ con formato incorrecto (bots/crawlers)
      // /teoria/ley-39/2015 → /teoria/ley-39-2015
      {
        source: '/teoria/ley-:num/:year(\\d{4})',
        destination: '/teoria/ley-:num-:year',
        permanent: true,
      },
      {
        source: '/teoria/lo-:num/:year(\\d{4})',
        destination: '/teoria/lo-:num-:year',
        permanent: true,
      },
      {
        source: '/teoria/rd-:num/:year(\\d{4})',
        destination: '/teoria/rd-:num-:year',
        permanent: true,
      },
      {
        source: '/teoria/rdl-:num/:year(\\d{4})',
        destination: '/teoria/rdl-:num-:year',
        permanent: true,
      },
      {
        source: '/teoria/reglamento-ue-:num/:year(\\d{3,4})',
        destination: '/teoria/reglamento-ue-:num-:year',
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

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Webpack-specific options (nueva API de Sentry)
  webpack: {
    // Automatically annotate React components
    reactComponentAnnotation: {
      enabled: true,
    },
    // Tree-shake Sentry logger statements
    treeshake: {
      removeDebugLogging: true,
    },
    // Automatic Vercel Cron Monitors
    automaticVercelMonitors: true,
  },
};

// Make sure adding Sentry options is the last code to run before exporting
export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
