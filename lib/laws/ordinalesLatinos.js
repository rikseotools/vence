// FUENTE ÚNICA de los ordinales latinos con que el BOE numera los artículos añadidos por
// reforma: "177 bis", "177 ter", … "177 quaterdecies".
//
// ── POR QUÉ ESTE MÓDULO EXISTE ──
// Esta lista se ha reescrito mal TRES veces, y cada vez ha costado contenido:
//
//   1. `lib/boe-extractor.ts` la llevaba duplicada en CUATRO sitios con recortes distintos
//      (dos paraban en `septies`, dos en `decies`) y MAL ORDENADA (`ter` antes que
//      `terdecies`). Consecuencia medida en la LGT: perdía `177 undecies`, `duodecies`,
//      `terdecies` y `quaterdecies`, y al parsear "Artículo 177 quaterdecies" casaba
//      `quater` dejando el resto en el título → fila `article_number='177 quater'` con
//      `title='decies. Terminación…'`. Y lo peor: `GET /api/verify-articles` NO reportaba
//      los que faltaban, porque el extractor tampoco los veía → **verde falso justo donde
//      faltaba articulado** (T-045).
//   2. `mapaBloquesPorArticulo` (lib/laws/boeBloqueVigente.js) tenía su propia copia, corta:
//      `bis|ter|quater|quinquies|sexies|septies`. Los artículos con sufijo alto no se
//      mapeaban a su bloque del BOE y el verificador daba **HTTP 404** en 6 de los 14
//      artículos de la serie 177 de la LGT — un fallo que parece "el BOE no responde"
//      cuando en realidad es la lista incompleta.
//   3. Además la copia corta no aceptaba la variante CON TILDE, y el BOE escribe
//      "177 quáter" con tilde (pero "quaterdecies" sin ella).
//
// Con la lista en un solo sitio, añadir un ordinal nuevo es una línea y no puede volver a
// divergir entre parsers.
//
// ── LAS DOS REGLAS QUE HAY QUE RESPETAR ──
//   · ORDEN: de la alternativa MÁS LARGA a la más corta. `ter` es prefijo de `terdecies` y
//     `qu[aá]ter` de `quaterdecies`: si van antes, el regex casa el corto y el resto del
//     ordinal se cuela en el título.
//   · TILDE: `qu[aá]ter` cubre las dos grafías que usa el BOE.

const ORDINAL_SUFFIXES =
  'quaterdecies|terdecies|duodecies|undecies|quindecies|sexdecies|decies|nonies|octies|' +
  'septies|sexies|quinquies|qu[aá]ter|ter|bis'

module.exports = { ORDINAL_SUFFIXES }
