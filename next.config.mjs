/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Optimizaciones de rendimiento (estables en Next.js 16)
  experimental: {
    optimizeCss: true,
    cssChunking: 'strict',
    inlineCss: true,
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

  // ✅ Redirigir automáticamente sin www a con www (solo en producción)
  async redirects() {
    if (process.env.NODE_ENV === 'production') {
      return [
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
    return [];
  },
};

export default nextConfig;