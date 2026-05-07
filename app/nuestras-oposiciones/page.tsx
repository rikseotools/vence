// app/nuestras-oposiciones/page.tsx
// Redirección permanente a /oposiciones (consolidación de catálogos
// duplicados — 07-may-2026). La ruta /oposiciones es la versión moderna
// con filtros SEO por CCAA/grupo/tipo y datos en BD; /nuestras-oposiciones
// era el legacy que solo leía del config estático.
//
// Mantenemos esta ruta como redirect 308 para no romper enlaces externos
// (footer cacheado, emails, backlinks). Google consolida el link juice
// en /oposiciones tras procesar el 308.
//
// === BORRAR ESTA RUTA TRAS 2027-05-07 ===
// Si Search Console no muestra impressions/clicks de /nuestras-oposiciones
// durante 2-3 meses seguidos, es seguro borrar esta carpeta entera. Los
// emails históricos con DEFAULT_REDIRECT viejo ya no funcionarían, pero
// los logs de email-tracking deberían mostrar 0 hits a esta ruta para
// entonces. Verificación: `curl -I https://www.vence.es/nuestras-oposiciones`
// debe seguir devolviendo 308 hasta el día del borrado.
import { permanentRedirect } from 'next/navigation'

export default function NuestrasOposicionesRedirect() {
  permanentRedirect('/oposiciones')
}
