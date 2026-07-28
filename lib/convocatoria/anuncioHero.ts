// lib/convocatoria/anuncioHero.ts — qué anuncia el HERO de la landing de una oposición.
// PURO (sin BD, sin red, sin formato de fechas) → testeable en aislamiento.
//
// ## Por qué existe (27/07/2026, T-134 · hueco `hero_badge` de `landingSurfaces.ts`)
//
// El hero anunciaba "CONVOCATORIA PUBLICADA" / "Convocatoria oficial publicada" con solo que la
// oposición tuviera una **referencia de boletín** guardada. Pero esa referencia suele ser el
// DECRETO DE LA OEP, que únicamente aprueba las plazas: la convocatoria (la que abre el plazo de
// instancias) puede no existir todavía. Resultado: la página afirmaba que hay convocatoria, el
// opositor la buscaba y no la encontraba.
//
// No es hipotético. Un usuario premium escribió a soporte el 27/07 por esto exactamente:
// «La instancia para Agrupación Profesional de Servicios Públicos (CARM) está cerrada? No termino
// de encontrar información». Su oposición estaba en `oep_aprobada` (50 plazas aprobadas, sin
// convocar) y el hero le decía que la convocatoria estaba publicada.
//
// ## El arreglo es de CONSTRUCCIÓN, no de vigilancia
//
// `landingSurfaces.ts` tenía este hueco DECLARADO ("nadie compara el BADGE con el estado real del
// proceso"). Se podía tapar con un detector, pero es mejor que el fallo **no pueda ocurrir**: el
// texto se deriva del estado del proceso, así que ya no hay nada que vigilar.
//
// ## Una sola fuente para todas las superficies del hero
//
// La página YA distinguía OEP de convocatoria para elegir el enlace oficial (F4/T-108), pero el
// badge y el subtítulo no usaban ese criterio: los botones decían una cosa y el texto otra. Aquí
// vive el criterio ÚNICO que consumen las tres superficies, para que no puedan volver a divergir.

// El criterio "¿aún no hay convocatoria?" vive en `enlaceOficial.cjs` y aquí se REEXPORTA.
// Motivo (28/07, T-134): el detector de enlaces es CommonJS y necesitaba el mismo criterio; tener
// la definición en un .ts obligaba a copiarla, y dos copias del mismo criterio divergen — que es
// justo el defecto que este módulo nació para eliminar en el hero. Los importadores existentes no
// cambian: siguen leyendo `esOepSinConvocatoria` de aquí.
import { esOepSinConvocatoria } from './enlaceOficial'
export { ESTADOS_SIN_CONVOCATORIA, esOepSinConvocatoria } from './enlaceOficial'

export interface AnuncioHeroInput {
  /** `convocatorias.estado_proceso` del ciclo vigente (vía `oposiciones_ssot`). */
  estadoProceso: string | null | undefined
  /** Referencia oficial mostrada (BOE/boletín). Puede ser la del decreto de la OEP. */
  boeReference?: string | null
  /** Fecha de publicación ya formateada (corta), si la hay. */
  boeFechaCorta?: string | null
}

export interface AnuncioHero {
  /** Texto del badge, tras el badge propio de la oposición. */
  badge: string
  /** Titular del subtítulo (antes del texto de examen). */
  titulo: string
  /** true si de verdad hay convocatoria publicada. */
  hayConvocatoria: boolean
}

/**
 * Decide lo que el hero puede AFIRMAR sin mentir.
 *
 * - Con convocatoria publicada → se mantiene el texto de siempre (con su fecha si la hay).
 * - Solo con la oferta aprobada → se dice ESO, que además es la información que el opositor
 *   necesita: las plazas están aprobadas y el plazo aún no ha abierto.
 * - Sin nada → "preparación disponible", como antes.
 */
export function anuncioHero(input: AnuncioHeroInput): AnuncioHero {
  const { estadoProceso, boeReference, boeFechaCorta } = input
  const sinConvocatoria = esOepSinConvocatoria(estadoProceso)

  if (!sinConvocatoria) {
    return {
      badge: boeFechaCorta ? `CONVOCATORIA PUBLICADA ${boeFechaCorta}` : 'CONVOCATORIA PUBLICADA',
      titulo: boeReference ? 'Convocatoria oficial publicada' : 'Preparación disponible',
      hayConvocatoria: true,
    }
  }

  // Fase de oferta: la referencia (si la hay) es del decreto de la OEP, no de una convocatoria.
  if (estadoProceso === 'oep_aprobada') {
    return {
      badge: boeFechaCorta ? `PLAZAS APROBADAS ${boeFechaCorta}` : 'PLAZAS APROBADAS',
      titulo: 'Plazas aprobadas, convocatoria pendiente de publicarse',
      hayConvocatoria: false,
    }
  }

  return { badge: 'PREPARACIÓN', titulo: 'Preparación disponible', hayConvocatoria: false }
}
