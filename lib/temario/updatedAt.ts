// lib/temario/updatedAt.ts
//
// Helper PURO para formatear la fecha "Actualizado a {fecha}" que se muestra
// en la cabecera de cada tema del temario.
//
// CONTEXTO (2026-05-26):
// Antes esta cadena se calculaba con `new Date().toLocaleDateString('es-ES', ...)`
// dentro de cada TopicContentView ('use client'). Resultado: hydration mismatch
// React #418 al cruce de día — el HTML cacheado por ISR (revalidate=3600)
// mantenía la fecha vieja durante 1h, pero el cliente renderizaba la nueva.
// Capturado por observabilidad en 10 hits 12h, todos entre 22:00-06:00 UTC
// (ventana donde Madrid cruza día respecto al server UTC).
//
// Fix robusto: el server component calcula la fecha (con timezone fijo
// Europe/Madrid para eliminar también el drift de zona) y la pasa como prop
// string immutable al client component. Server y cliente reciben el mismo
// valor → imposible mismatch.
//
// Semánticamente: "Actualizado a X" debe reflejar el momento de la última
// regeneración ISR del contenido, NO el "ahora del cliente".

const FORMATTER = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Madrid',
})

/**
 * Formatea una fecha en estilo "25 de mayo de 2026" con timezone fijo
 * Europe/Madrid. Pensado para llamarse desde server components dentro de
 * páginas ISR — el resultado se pasa como prop string al client component.
 *
 * @param d Fecha a formatear. Default `new Date()` — en server component
 *          esto será el momento de la regeneración ISR.
 */
export function formatUpdatedAt(d: Date = new Date()): string {
  return FORMATTER.format(d)
}
