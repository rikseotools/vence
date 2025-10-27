/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ✅ Tu configuración existente
  },
  
  // ✅ Optimizaciones de rendimiento
  experimental: {
    optimizeCss: true,
    cssChunking: 'strict',
    inlineCss: true,
  },
  
  // ✅ Compresión mejorada
  compress: true,
  
  // ✅ Agregar configuración de SEO
  env: {
    SITE_URL: process.env.NODE_ENV === 'production' 
      ? 'https://www.vence.es'  // ✅ Con www en producción
      : 'http://localhost:3000'
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