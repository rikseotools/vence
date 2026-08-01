// lib/oposiciones/resumenCabecera.ts — la frase de la cabecera de /oposiciones.
//
// ── POR QUÉ ESTO ES UNA FUNCIÓN Y NO TEXTO SUELTO EN EL JSX ─────────────────────────────────
//
// Porque en el JSX se rompía y nadie lo veía. La cabecera decía **«8con inscripción abierta
// ahora»**, sin espacio, y el código fuente parecía correcto:
//
//     {' '}{conInscripcion.length} con inscripción abierta ahora.
//
// El espacio está escrito. Lo que pasa es que **JSX recorta el espacio inicial de un texto que
// empieza justo detrás de una expresión** y termina en salto de línea: React recibía
// `[" ", 8, "con inscripción abierta ahora."]`. Se ve en el HTML servido, no en el fichero — por
// eso una lectura del código no lo caza, y por eso la frase se construye aquí, donde es una
// cadena normal y se puede probar.

/** Frase que acompaña al recuento de oposiciones con plazo abierto. `null` si no hay ninguna. */
export function fraseInscripcionAbierta(cuantas: number): string | null {
  if (!Number.isFinite(cuantas) || cuantas <= 0) return null
  // Singular y plural: «1 con inscripción abierta» chirría, y estas cifras cambian solas.
  return cuantas === 1
    ? '1 con inscripción abierta ahora.'
    : `${cuantas} con inscripción abierta ahora.`
}

/** Recuento de plazas ya formateado, para no repetir el `toLocaleString` en cada superficie. */
export function formatoPlazas(plazas: number): string {
  return Number(plazas || 0).toLocaleString('es-ES')
}
