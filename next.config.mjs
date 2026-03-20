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
    // ✅ Versión del deploy para diagnóstico (Vercel inyecta VERCEL_GIT_COMMIT_SHA en build)
    NEXT_PUBLIC_DEPLOY_VERSION: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'local',
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
      // 🔄 Redirecciones de temas con numeración antigua de administrativo-estado (25 URLs 404 en GSC)
      // Temas que ya no existen: 12-14, 101-114, 205-210, 308-309 → redirigir al índice del temario
      ...([12, 13, 14, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 205, 206, 207, 208, 209, 210, 308, 309].map(n => ({
        source: `/administrativo-estado/temario/tema-${n}`,
        destination: '/administrativo-estado/temario',
        permanent: true,
      }))),
      // 🔄 Redirecciones de /teoria/ y /leyes/ con formato incorrecto (barras en slugs)
      // /teoria/ley-39/2015 → /teoria/ley-39-2015
      // /leyes/ley-39/2015 → /leyes/ley-39-2015
      ...(['teoria', 'leyes'].flatMap(prefix => [
        { source: `/${prefix}/ley-:num/:year(\\d{4})`, destination: `/${prefix}/ley-:num-:year`, permanent: true },
        { source: `/${prefix}/lo-:num/:year(\\d{4})`, destination: `/${prefix}/lo-:num-:year`, permanent: true },
        { source: `/${prefix}/rd-:num/:year(\\d{4})`, destination: `/${prefix}/rd-:num-:year`, permanent: true },
        { source: `/${prefix}/rdl-:num/:year(\\d{4})`, destination: `/${prefix}/rdl-:num-:year`, permanent: true },
        { source: `/${prefix}/reglamento-ue-:num/:year(\\d{3,4})`, destination: `/${prefix}/reglamento-ue-:num-:year`, permanent: true },
        { source: `/${prefix}/orden-:a/:b(\\d{4})`, destination: `/${prefix}/orden-:a-:b`, permanent: true },
        { source: `/${prefix}/orden-:a/:b/:c(\\d{4})`, destination: `/${prefix}/orden-:a-:b-:c`, permanent: true },
      ])),
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
