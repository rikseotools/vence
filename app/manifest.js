export default function manifest() {
  return {
    name: 'Vence.es - Oposiciones Auxiliar Administrativo',
    short_name: 'Vence.es',
    description: 'Preparación online para oposiciones de Auxiliar Administrativo del Estado',
    start_url: '/',
    display: 'standalone',
    background_color: '#1e40af',
    theme_color: '#1e40af',
    orientation: 'portrait-primary',
    scope: '/',
    lang: 'es',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ]
  }
}