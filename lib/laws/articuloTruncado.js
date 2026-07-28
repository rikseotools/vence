// lib/laws/articuloTruncado.js
//
// ¿El texto que tenemos de un artículo está COMPLETO respecto del oficial?
//
// Gap que cierra (T-241): un artículo puede estar presente y activo pero con el texto truncado o
// condensado. Ningún detector lo miraba — `verify-law-source.cjs` compara el INVENTARIO (qué
// artículos faltan) y `lib/laws/completeness.ts` deriva el estado de la EVIDENCIA; un artículo al
// que le falta un párrafo pasa como bueno por los dos. Lo destapó de rebote el detector de citas:
// al art. 4.9 del RGPD le faltaba el párrafo segundo entero, y una explicación que lo citaba bien
// parecía estar inventándoselo.
//
// CRITERIO: se compara el TRAMO FINAL, no la longitud.
//   · Un artículo truncado conserva el principio y pierde el final — y el final es justo donde
//     viven plazos, mayorías, excepciones y remisiones, o sea lo examinable.
//   · Comparar LONGITUDES no vale: probado el 28/07 contra el BOE consolidado troceando por marcas
//     «Artículo N», dio 11 falsos positivos en la Constitución (los tres de más tráfico —159, 143
//     y 14— estaban completos). Entre dos marcas el BOE mete rúbricas y notas de vigencia.
//
// El núcleo es PURO para poder testearlo sin red ni BD; quien lo usa se encarga de traer el texto
// oficial VIGENTE (ver `boeBloqueVigente`, porque el bloque trae todas las redacciones históricas).

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9ñ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Longitud del tramo final que se exige encontrar. Ni tan corto que case por azar ni tan largo
 *  que una errata tipográfica lo tumbe. */
const COLA = 90

/**
 * @returns null si está completo (o no es concluyente), o {cola, nuestro, oficial} si falta el final.
 */
function articuloTruncado(nuestro, oficial) {
  const no = norm(oficial)
  const nn = norm(nuestro)
  // Sin oficial suficiente no se concluye NADA: es preferible callar que acusar (mismo sesgo que
  // el resto de detectores del proyecto — un cubo lleno de falsos positivos no lo drena nadie).
  if (no.length < 200 || !nn) return null
  const cola = no.slice(-COLA)
  if (nn.includes(cola)) return null
  return { cola, nuestro: nn.length, oficial: no.length }
}

module.exports = { articuloTruncado, normalizaArticulo: norm, COLA }
