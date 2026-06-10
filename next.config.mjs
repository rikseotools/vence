import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bloque 5 Fase E (ECS Fargate path, no SST/OpenNext): build standalone
  // para Docker/ECS. Genera .next/standalone con server.js + minimal
  // node_modules, ~10x más ligero que el build normal. Es el output que consume el build Docker para ECS Fargate (open-next/standalone).
  output: 'standalone',

  // Timeout de prerender por página en `next build`. El default (60s) es
  // demasiado justo para páginas SSG data-heavy (p.ej.
  // /test-oposiciones/procedimiento-administrativo: varias queries + un count
  // sobre questions). Bajo contención de BD al prerenderizar muchas páginas en
  // paralelo (saturación del pooler), una sola página puede superar 60s y
  // abortar TODO el build. Las queries individuales son ~2-3s → 180s da margen
  // sin enmascarar un problema real. (07/06/2026: deploy de 136d8e3d falló 2×
  // aquí; root cause = contención build-time, no regresión de código.)
  staticPageGenerationTimeout: 180,

  // ✅ Optimizaciones de rendimiento (estables en Next.js 16)
  experimental: {
    optimizeCss: true,
    cssChunking: 'strict',
    // inlineCss DESACTIVADO 2026-05-06 — Bug Next.js 16 + RSC streaming.
    //
    // Síntoma: TypeError "controller[kState].transformAlgorithm is not a function"
    // intermitente durante render con force-dynamic + Suspense. Status 200 la
    // mayoría de veces (response parcial), pero a veces 30s timeout. Detectado
    // primero en /auxiliar-administrativo-asturias/temario/tema-12 (commit 77e3e107
    // activó esta flag).
    //
    // Causa raíz confirmada en https://github.com/vercel/next.js/discussions/75995
    // (causa #4 de las 7 documentadas). NO es Sentry-causado, es race condition
    // de inlineCss durante streaming finalization.
    //
    // Coste de desactivar: pierde ~8-14KB de CSS crítico inline → FCP/LCP sube
    // ~50-100ms en first paint. Mitigado por: optimizeCss activo (minify+dedup),
    // cssChunking:'strict' (chunks pequeños), CloudFront cache agresivo,
    // y la mayoría de users de Vence son recurrentes (CSS en cache navegador).
    //
    // Reactivar cuando Next.js publique parche del bug.
    // inlineCss: true,
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
    // ✅ Versión del deploy para diagnóstico. En Fargate el workflow inyecta
    // GIT_COMMIT_SHA/NEXT_PUBLIC_GIT_COMMIT_SHA
    NEXT_PUBLIC_DEPLOY_VERSION:
      process.env.GIT_COMMIT_SHA?.slice(0, 8)
      || process.env.NEXT_PUBLIC_GIT_COMMIT_SHA?.slice(0, 8)
      || 'local',
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
      // 🗂️ Convocatorias archivadas → canónica actual (preserva equity SEO)
      // Cuando caduca una OEP, la fila antigua pasa a slug -YYYY (is_active=false)
      // y creamos nueva fila con slug canónico para OEP activa.
      {
        source: '/auxiliar-administrativo-madrid-2025',
        destination: '/auxiliar-administrativo-madrid',
        permanent: true,
      },
      {
        source: '/auxiliar-administrativo-madrid-2025/:path*',
        destination: '/auxiliar-administrativo-madrid/:path*',
        permanent: true,
      },
      {
        source: '/auxiliar-administrativo-canarias-2024',
        destination: '/auxiliar-administrativo-canarias',
        permanent: true,
      },
      {
        source: '/auxiliar-administrativo-canarias-2024/:path*',
        destination: '/auxiliar-administrativo-canarias/:path*',
        permanent: true,
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
      // 🔄 Estatuto de Galicia: slug 'virtual' (contenedor histórico de preguntas) → slug real (LO 1/1981)
      // Las 171 preguntas se reasignaron a sus artículos correctos del Estatuto LO 1/1981 el 15/05/2026.
      // La ley virtual queda is_active=false en BD; este redirect cubre los enlaces externos.
      {
        source: '/leyes/estatuto-autonomia-galicia-virtual',
        destination: '/leyes/estatuto-autonomia-galicia',
        permanent: true,
      },
      {
        source: '/leyes/estatuto-autonomia-galicia-virtual/:path*',
        destination: '/leyes/estatuto-autonomia-galicia/:path*',
        permanent: true,
      },
      {
        source: '/teoria/estatuto-autonomia-galicia-virtual',
        destination: '/teoria/estatuto-autonomia-galicia',
        permanent: true,
      },
      {
        source: '/teoria/estatuto-autonomia-galicia-virtual/:path*',
        destination: '/teoria/estatuto-autonomia-galicia/:path*',
        permanent: true,
      },
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
  },
};

// Make sure adding Sentry options is the last code to run before exporting
export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
