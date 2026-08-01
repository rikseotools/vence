// lib/api/premium/textoPrecioFidelidad.ts
//
// Qué dicen el botón y el aviso del perfil cuando a alguien se le está apagando la suscripción.
// (T-448)
//
// Vive fuera del JSX por una razón concreta: **la regla que importa es una negativa** —si no hay
// oferta creada, NO se promete cifra— y una condición así, escrita como ternario anidado dentro de
// un `<button>`, no se puede probar y se rompe sin que nadie lo note. Enseñar «Mantener mi precio:
// 20 € al mes» a quien luego aterriza en «No tienes ningún precio de fidelidad activo» es peor que
// no haber enseñado ningún importe.

export interface PrecioFidelidad {
  /** Ya formateado por el servidor («20 €»), para que no haya dos formas de pintarlo. */
  importe: string
  /** «al mes», «cada 3 meses»… */
  periodicidad: string
}

/**
 * Texto del botón.
 * - Si su suscripción es renovable en su propia cuenta, esto no aplica: reactiva y ya está.
 * - Si no lo es y sabemos su precio, se dice la cifra: es todo el argumento.
 * - Si no lo es y NO lo sabemos, se invita sin prometer número.
 */
export function textoBotonSuscripcion(
  renovableEnSuCuenta: boolean | undefined,
  precio: PrecioFidelidad | null | undefined,
): string {
  if (renovableEnSuCuenta !== false) return 'Reactivar suscripción'
  if (!precio?.importe) return 'Mantener mi precio de fidelidad'
  return `Mantener mi precio: ${precio.importe} ${precio.periodicidad}`
}

/** Texto del aviso que acompaña al botón, con la misma regla sobre la cifra. */
export function textoAvisoCancelacion(
  renovableEnSuCuenta: boolean | undefined,
  precio: PrecioFidelidad | null | undefined,
): string {
  const base = 'Seguirás teniendo acceso Premium hasta esa fecha.'
  if (renovableEnSuCuenta !== false) return `${base} Si cambias de opinión, puedes reactivarla.`
  if (!precio?.importe) return `${base} Si quieres continuar, puedes volver a contratar manteniendo el precio que tenías.`
  return `${base} Si quieres continuar, mantienes tu precio de fidelidad: ${precio.importe} ${precio.periodicidad}.`
}
