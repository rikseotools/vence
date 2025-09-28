/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ✅ Tu configuración existente
  },
  
  // ✅ Agregar configuración de SEO
  env: {
    SITE_URL: process.env.NODE_ENV === 'production' 
      ? 'https://www.ilovetest.pro'  // ✅ Con www en producción
      : 'http://localhost:3000'
  },
  
  // ✅ Redirigir automáticamente sin www a con www
  async redirects() {
    if (process.env.NODE_ENV === 'production') {
      return [
        {
          source: '/:path*',
          has: [
            {
              type: 'host',
              value: 'ilovetest.pro', // Sin www
            },
          ],
          destination: 'https://www.ilovetest.pro/:path*',
          permanent: true,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;