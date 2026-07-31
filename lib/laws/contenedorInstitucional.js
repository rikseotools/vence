// lib/laws/contenedorInstitucional.js
//
// ¿Es esta "ley" en realidad un CONTENEDOR institucional, y no una norma con articulado?
// Núcleo puro: sin BD y sin red, para poder fijar el criterio en tests. [T-026]
//
// ── POR QUÉ EXISTE ────────────────────────────────────────────────────────────────────────
//
// El sistema de completitud exige que toda ley tenga una fuente oficial contra la que
// comparar artículo por artículo. Pero parte del temario no son normas: son fichas de
// organismos (FMI, OMS, OTAN, FAO, EUROJUST, tribunales europeos, instituciones de la UE) que
// se preguntan por HECHOS —sede, funciones, quién la preside— y no tienen articulado que
// cotejar. Registradas como leyes normales caen en `no_source` y engordan el bucket de deuda
// **sin ser un defecto real**, tapando las leyes que sí necesitan trabajo.
//
// La exención ya existe en el clasificador (`is_virtual`), y sus equivalentes de abril
// (Consejo DDHH ONU, Principios Fuerza ONU, OTAN GC, EUROJUST GC) están marcados así. Lo que
// faltaba era aplicarla a los que se crearon después.
//
// ⚠️ El criterio es DELIBERADAMENTE estrecho, porque marcar `is_virtual` a una norma de verdad
// la saca de la vigilancia para siempre y en silencio. Exige las tres cosas a la vez, y la
// tercera es una declaración explícita escrita al crear el contenedor — no una heurística
// sobre el tamaño del texto. Un Protocolo de la UE de un solo artículo NO cumple, y no debe.

/** Marca textual que el propio contenedor lleva escrita cuando se creó como tal. */
const DECLARACION = /contenido institucional|preguntas de hecho,? no de articulado/i

/**
 * @param {{articulosActivos:number, boeUrl:string|null|undefined, textoPrimerArticulo:string|null|undefined}} ley
 * @returns {{esContenedor:boolean, motivo:string}}
 */
function clasificarContenedorInstitucional(ley) {
  const arts = Number(ley?.articulosActivos ?? 0)
  const url = String(ley?.boeUrl ?? '').trim()
  const txt = String(ley?.textoPrimerArticulo ?? '')

  if (arts !== 1) return { esContenedor: false, motivo: `tiene ${arts} artículos: si hay articulado, hay fuente que comparar` }
  if (url) return { esContenedor: false, motivo: 'ya tiene fuente registrada: se verifica contra ella, no se exime' }
  if (!DECLARACION.test(txt)) return { esContenedor: false, motivo: 'no se declara contenedor institucional: podría ser una norma real de un solo artículo' }

  return { esContenedor: true, motivo: 'un solo artículo, sin fuente y declarado contenido institucional' }
}

module.exports = { clasificarContenedorInstitucional, DECLARACION }
