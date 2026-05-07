// app/nuestras-oposiciones/page.tsx
// Redirección permanente a /oposiciones (consolidación de catálogos
// duplicados — 07-may-2026). La ruta /oposiciones es la versión moderna
// con filtros SEO por CCAA/grupo/tipo y datos en BD; /nuestras-oposiciones
// era el legacy que solo leía del config estático.
//
// Mantenemos esta ruta como redirect 308 para no romper enlaces externos
// (footer cacheado, emails, backlinks). Google consolida el link juice
// en /oposiciones tras procesar el 308.
import { permanentRedirect } from 'next/navigation'

export default function NuestrasOposicionesRedirect() {
  permanentRedirect('/oposiciones')
}
