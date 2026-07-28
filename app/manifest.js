/**
 * Manifiesto de la PWA — FUENTE ÚNICA.
 *
 * Next sirve esto en `/manifest.webmanifest`, que es lo que enlaza el <head> y lo que lee
 * el navegador. **Había además un `public/manifest.json` con una copia del mismo contenido
 * que no leía nadie**, y el 28/07/2026 costó un arreglo entero: se editó la copia muerta
 * creyendo que era esta. Se borró. Si hace falta tocar el manifiesto, es AQUÍ.
 *
 * Los iconos son requisito de instalación en Chrome Android (192 **y** 512). Hasta el
 * 28/07/2026 solo se declaraba el de 192 y, peor, ese fichero **no era un PNG**: eran 202
 * bytes de texto con un TODO dentro. Producción lo servía con 200 y `content-type:
 * image/png`, así que ningún check de disponibilidad podía verlo. Lo vigila ahora
 * `__tests__/guardrails/pwaManifest.guardrail.test.ts`, que lee la firma PNG y las
 * dimensiones reales en vez de comprobar que el fichero exista.
 */
export default function manifest() {
  return {
    // Lo que el usuario ve bajo el icono al instalarla: no puede nombrar UNA oposición
    // cuando la plataforma cubre más de cien.
    name: 'Vence - Preparación de oposiciones',
    short_name: 'Vence',
    description:
      'Temario y tests para preparar tu oposición: teoría, preguntas y seguimiento de convocatorias.',
    start_url: '/',
    display: 'standalone',
    background_color: '#1e40af',
    theme_color: '#1e40af',
    orientation: 'portrait-primary',
    scope: '/',
    lang: 'es',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // `maskable` aparte: Android recorta el icono a la forma del sistema, y declarar el
      // mismo con "any maskable" hace que se recorte también donde no debe.
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
