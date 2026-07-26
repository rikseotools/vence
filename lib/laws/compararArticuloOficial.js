'use strict'
//
// compararArticuloOficial — NÚCLEO PURO: clasifica en qué se diferencia el texto que
// servimos de un artículo respecto del texto OFICIAL del BOE consolidado.
//
// POR QUÉ EXISTE (26/07/2026, T-139). Cuando un artículo escopado está inactivo y no tiene
// gemelo activo al que re-anclar sus preguntas, la remediación es reactivarlo — pero solo
// si su texto es el bueno. Comparar por longitud o por "¿empieza igual?" **engaña**, y ya
// engañó: el art. 28 del Reglamento de Armas se dio por *truncado* (4.628 caracteres frente
// a 8.839) porque se comparó contra el bloque CRUDO del BOE, que trae todas las versiones y
// las notas de modificación. Contra el bloque VIGENTE eran 4.628 vs 4.672 — y resultó que
// no faltaba nada: estaban los 23 apartados, pero DESORDENADOS (el 10 donde va el 2).
//
// Esas dos averías piden remedios opuestos (importar lo que falta vs reordenar), así que la
// clase se distingue en vez de reducirlo todo a "difiere":
//
//   · `identico`    → mismo texto salvo acentos/puntuación/espacios. Reactivar sin tocar.
//   · `reordenado`  → están TODOS los párrafos oficiales, en otro orden o con otros saltos.
//                     Reactivar reescribiendo con el texto oficial (el orden importa: leer
//                     el apartado 10 antes del 2 es un defecto de lectura real).
//   · `erratas`     → los párrafos que difieren son el MISMO párrafo mal copiado (la
//                     disposición transitoria de la LO 3/1981 decía «el Defensor del
//                     Puebla»). Se arregla reescribiendo con el oficial.
//   · `incompleto`  → faltan párrafos oficiales. Importar el oficial completo.
//   · `contaminado` → tenemos párrafos que el BOE no tiene Y no se parecen a ninguno suyo:
//                     texto de otra norma, glosa editorial o versión derogada. Es el que
//                     NUNCA debe reactivarse a ciegas: hay que mirar de dónde salió eso.
//
// La distinción `erratas` vs `contaminado` no es cosmética: una errata se arregla
// reescribiendo, y texto ajeno hay que investigarlo. Meterlas en el mismo saco obliga a
// parar en seco por una letra cambiada, o —peor— invita a bajar el listón hasta tragarse
// el texto de otra norma.
//
// Trabaja sobre PÁRRAFOS y no sobre caracteres a propósito: las diferencias de formato
// (saltos de línea, viñetas) son ruido, y las que importan son "este apartado está o no".

const { normalizar } = require('../contenido/reanclarGuardas')

/** Trocea en párrafos no vacíos, ya normalizados para comparar. */
function parrafos(texto) {
  return String(texto || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/**
 * ¿Está este párrafo dentro del otro texto?
 *
 * Se comprueba por INCLUSIÓN y no por igualdad porque los dos lados parten en párrafos de
 * forma distinta: un lado puede tener el apartado 1 y el 2 pegados en una sola línea. Sin
 * esto, un texto completo pero con otros saltos de línea saldría como "incompleto".
 */
function contiene(textoNormalizado, parrafo) {
  const p = normalizar(parrafo)
  return p.length > 0 && textoNormalizado.includes(p)
}

/**
 * ¿Son estos dos párrafos el MISMO párrafo, uno de ellos mal copiado?
 *
 * Se mide por prefijo + sufijo comunes en vez de por distancia de edición: es barato sobre
 * párrafos largos y captura exactamente la forma de una errata (todo igual salvo un tramo
 * en medio). Con el umbral en 0,9 una palabra cambiada pasa y un párrafo distinto no.
 */
function mismoParrafoConErrata(a, b) {
  const x = normalizar(a)
  const y = normalizar(b)
  if (!x || !y) return false
  const min = Math.min(x.length, y.length)
  const max = Math.max(x.length, y.length)
  // El tope es ABSOLUTO, no porcentual, y a propósito: un 10% de un artículo de 4.000
  // caracteres son 400 — un apartado entero. Una errata es un puñado de letras.
  if (max - min > 10) return false
  let pre = 0
  while (pre < min && x[pre] === y[pre]) pre++
  let suf = 0
  while (suf < min - pre && x[x.length - 1 - suf] === y[y.length - 1 - suf]) suf++
  const divergencia = min - pre - suf
  return divergencia <= Math.max(3, Math.round(0.02 * min))
}

/**
 * Compara nuestro texto con el oficial.
 *
 * @param {string|null} nuestro `articles.content`
 * @param {string|null} oficial texto del bloque VIGENTE del BOE (usar `bloqueVigente`, no el
 *                              bloque crudo: el crudo trae todas las versiones y las notas)
 * @returns {{clase:'identico'|'reordenado'|'incompleto'|'contaminado'|'sin_oficial',
 *            faltan:string[], sobran:string[], resumen:string}}
 */
function compararArticuloOficial(nuestro, oficial) {
  const nOf = normalizar(oficial)
  const nNu = normalizar(nuestro)
  if (!nOf) return { clase: 'sin_oficial', faltan: [], sobran: [], resumen: 'no se ha podido leer el texto oficial' }

  if (nOf === nNu) return { clase: 'identico', faltan: [], sobran: [], resumen: 'idéntico al oficial (salvo formato)' }

  // Erratas a nivel de TEXTO COMPLETO, antes de trocear. Hace falta porque nuestro texto
  // puede tener los saltos de línea en otro sitio: la disposición transitoria de la LO
  // 3/1981 estaba partida en dos líneas, así que el párrafo oficial no casaba con ninguno
  // de los nuestros y la errata («el Defensor del Puebla») se leía como texto ajeno.
  if (mismoParrafoConErrata(nNu, nOf)) {
    return { clase: 'erratas', faltan: [], sobran: [], resumen: 'el texto es el oficial con erratas (se corrige reescribiendo)' }
  }

  // Se juzga desde el lado OFICIAL y por RESIDUO, no comparando párrafo contra párrafo. La
  // razón es que los dos lados trocean distinto: nuestro art. 28 del Reglamento de Armas
  // mete varios apartados en una línea, así que "¿está mi párrafo en el oficial?" daba
  // FALSO para un texto que lo tenía todo, y lo acusaba de contaminado.
  //
  //   1. de cada párrafo oficial se pregunta si está en el nuestro (completitud),
  //   2. los que no, se buscan como gemelo con errata entre los nuestros,
  //   3. y lo que queda de nuestro texto tras quitar todo lo oficial es el RESIDUO:
  //      material que no viene del BOE.
  const oficiales = parrafos(oficial)
  const mios = parrafos(nuestro)
  const faltan = []
  const erratas = []
  let residuo = nNu
  const quitar = (frag) => {
    const i = residuo.indexOf(frag)
    if (i > -1) residuo = residuo.slice(0, i) + residuo.slice(i + frag.length)
  }
  for (const p of oficiales) {
    if (contiene(nNu, p)) {
      quitar(normalizar(p))
      continue
    }
    const gemelo = mios.find((m) => mismoParrafoConErrata(m, p))
    if (gemelo) {
      erratas.push(p)
      quitar(normalizar(gemelo))
    } else {
      faltan.push(p)
    }
  }
  // El residuo se mide en proporción: unas pocas letras sueltas son ruido de troceado, un
  // párrafo entero es material ajeno.
  const ratioResiduo = nNu.length ? residuo.length / nNu.length : 0
  const sobran = ratioResiduo > 0.05 ? mios.filter((m) => !contiene(nOf, m) && !erratas.some((e) => mismoParrafoConErrata(m, e))) : []

  // Lo AJENO manda sobre lo que falte: un texto con material de otra norma no se arregla
  // importando el oficial; primero hay que saber de dónde salió.
  if (sobran.length) {
    return {
      clase: 'contaminado',
      faltan,
      sobran,
      resumen: `${Math.round(ratioResiduo * 100)}% del texto no viene del BOE${faltan.length ? ` y faltan ${faltan.length} párrafo(s)` : ''}`,
    }
  }
  if (faltan.length) {
    return { clase: 'incompleto', faltan, sobran, resumen: `faltan ${faltan.length} párrafo(s) del oficial` }
  }
  if (erratas.length) {
    return { clase: 'erratas', faltan, sobran, resumen: `${erratas.length} párrafo(s) son el oficial mal copiado (se corrigen reescribiendo)` }
  }
  return {
    clase: 'reordenado',
    faltan: [],
    sobran: [],
    resumen: 'están todos los párrafos oficiales, pero en otro orden o con otros saltos',
  }
}

module.exports = { compararArticuloOficial, parrafos }
