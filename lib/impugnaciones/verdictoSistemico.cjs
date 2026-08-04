// lib/impugnaciones/verdictoSistemico.cjs
//
// LA PREGUNTA QUE HAY QUE HACERSE EN CADA IMPUGNACIÓN, hecha cumplir en el cierre [T-520].
//
// «Una impugnación llega por UNA pregunta, pero casi nunca es un caso aislado: quien la escribe
// solo ha visto la punta» — la regla es de Manuel (30/07/2026) y estaba escrita en el manual y en
// la checklist del dossier. Aun así se olvidaba, y el 04/08 lo dijo con todas las letras:
// *«después de cada impugnación deberías hacerte esa pregunta y que no se te olvide, porque si no
// no avanzamos nada»*.
//
// ## Por qué no bastaba con lo que había
//
// El dossier IMPRIME las hermanas del artículo bajo un «¿FALLO SISTÉMICO?» y la checklist lleva el
// punto 4.bis. Las dos cosas son AVISOS, y en esta casa ya está medido lo que valen: un aviso
// impreso entre otras diez líneas no es una condición (es la misma lección que ganó `snooze_until`
// cuando T-221 llevaba 24 h con «⛔ NO COGER» en el título, y la que ganó `claim` al pasar de
// avisar a impedir). Además el dossier se lee al EMPEZAR y el cierre llega media hora después, con
// el mensaje ya redactado: para entonces la pregunta se ha quedado por el camino.
//
// Aquí se pide en el ÚLTIMO paso, que es el único por el que pasan todas las impugnaciones.
//
// ## Por qué una taxonomía cerrada y no texto libre
//
// Un campo de texto libre se rellena con «lo he mirado» y no dice nada: no se puede contar, no se
// puede revisar y no distingue haber medido de haberlo dado por supuesto. Las tres salidas de
// abajo son exhaustivas —o es un caso aislado, o mediste y saliste con un número, o el número era
// grande y abriste ficha— y cada una **exige la prueba que le corresponde**: el aislado exige la
// razón, el medido exige la CIFRA, la ficha exige el id. Es el mismo criterio que `reserve`
// (aborta sin `--esfuerzo`) y que `due` (el motivo tiene que ser EXTERNO, y lo impide un CHECK).

const PREFIJOS = ['aislado', 'medido', 'ficha']

/** Longitud mínima de la explicación. Corta, pero obliga a escribir una frase de verdad. */
const MIN_RAZON = 25

/**
 * Valida el verdicto sistémico de un cierre.
 *
 * Formas admitidas (el prefijo va delante, separado por `:`):
 *
 *   aislado: <por qué no puede haber más casos>        → ≥25 caracteres de razón
 *   medido: <qué medí> → <N> casos                     → tiene que llevar una CIFRA
 *   ficha T-nnn: <qué se abrió>                        → id de tarea con forma válida
 *
 * @param {string|null|undefined} texto
 * @returns {{ok:boolean, clase:string|null, problema:string|null}}
 */
function validarVerdictoSistemico(texto) {
  const t = String(texto ?? '').trim()
  if (!t) {
    return { ok: false, clase: null, problema: 'falta el verdicto sistémico' }
  }

  const m = t.match(/^(aislado|medido|ficha)\b[:\s]*(.*)$/is)
  if (!m) {
    return {
      ok: false,
      clase: null,
      problema: `tiene que empezar por uno de: ${PREFIJOS.join(', ')}`,
    }
  }
  const clase = m[1].toLowerCase()
  const resto = m[2].trim()

  if (clase === 'ficha') {
    // El id va pegado al prefijo: «ficha T-519: …». Sin id no hay nada que consultar después.
    if (!/^T-\d{1,4}\b/i.test(resto)) {
      return { ok: false, clase, problema: 'falta el id de la ficha (p. ej. «ficha T-519: …»)' }
    }
    return { ok: true, clase, problema: null }
  }

  if (resto.length < MIN_RAZON) {
    return {
      ok: false,
      clase,
      problema: `la razón es demasiado corta (${resto.length} < ${MIN_RAZON} caracteres)`,
    }
  }

  if (clase === 'medido') {
    // Medir produce un NÚMERO. Sin cifra, «medido» es una forma elegante de decir que no se midió;
    // es justo el hueco por el que se colaba la regla escrita en el manual.
    if (!/\d/.test(resto)) {
      return { ok: false, clase, problema: 'un verdicto «medido» tiene que traer la CIFRA que salió' }
    }
  }

  return { ok: true, clase, problema: null }
}

module.exports = { validarVerdictoSistemico, PREFIJOS, MIN_RAZON }
