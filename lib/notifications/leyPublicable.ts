// lib/notifications/leyPublicable.ts
//
// Qué artículos problemáticos se pueden PUBLICAR en una notificación (T-559).
//
// Vive aquí y no en `lib/laws/lawNameResuelta` a propósito: aquel es el criterio compartido
// con el backend (copia paritaria, no debe crecer con cosas que el backend no usa) y esto es
// la política de ESTA superficie. El criterio de "¿es una ley de verdad?" no se reescribe:
// se importa.
//
// POR QUÉ: el agregador de artículos problemáticos agrupa por `law_name`. Cuando el escritor
// persistía el relleno `'unknown'`, ese literal se comportaba como una ley más y fundía
// artículos de Excel 365, Word 365 y Access 365 en una sola tarjeta titulada
// «2 Artículos Problemáticos: unknown», cuyo botón de teoría llevaba a `/teoria/unknown`
// (404) y cuyo test intensivo acababa sirviendo otra materia.
//
// Se DESCARTA, no se rellena: una tarjeta cuya ley no sabemos no se puede accionar — sus dos
// botones necesitan la ley para construir su URL. Y el descarte se cuenta para poder emitirlo:
// tapar la tarjeta en silencio sería cambiar un fallo silencioso por otro.

import { esLeyResuelta } from '@/lib/laws/lawNameResuelta'

/** Lo mínimo que necesita un artículo problemático para decidir si se publica. */
export interface ArticuloConLey {
  law_name?: string | null
  [key: string]: unknown
}

export interface ParticionPorLey<T> {
  /** Los que tienen una ley de verdad: se agrupan y se publican. */
  publicables: T[]
  /** Los que no: se descartan (y se emiten). */
  descartados: T[]
  /**
   * Valores de ley distintos que se han descartado, tal cual estaban en BD.
   * Viajan en el evento para poder ir al escritor culpable sin adivinar.
   */
  leyesDescartadas: string[]
}

/**
 * Separa los artículos que se pueden publicar de los que no, por si su ley resuelve.
 *
 * Puro y sin efectos: quien emite es el llamador (este módulo no sabe de observabilidad).
 */
export function particionarPorLeyResuelta<T extends ArticuloConLey>(
  articulos: readonly T[],
): ParticionPorLey<T> {
  const publicables: T[] = []
  const descartados: T[] = []

  for (const a of articulos) {
    if (esLeyResuelta(a.law_name)) publicables.push(a)
    else descartados.push(a)
  }

  // `String(null)` → 'null' a propósito: interesa distinguir en el evento si lo que llegó
  // era el literal 'unknown', un vacío o un null de verdad. Son escritores distintos.
  const leyesDescartadas = [...new Set(descartados.map((a) => String(a.law_name)))]

  return { publicables, descartados, leyesDescartadas }
}
