// lib/laws/actualizarArticuloGuardas.js — política PURA de "¿puedo reescribir este artículo con el
// texto oficial?". Sin red, sin BD: entra el veredicto de `compararArticuloOficial` y sale una
// decisión con motivo.
//
// ## Por qué la política vive aparte del script (T-184, 27/07/2026)
//
// Reescribir `articles.content` es tocar el texto legal que lee el opositor y contra el que se
// validaron las claves de sus preguntas. La decisión de CUÁNDO se puede hacer es lo único con
// criterio de la operación —el resto es fetch y SQL— así que se aísla para poder probarla sin red.
//
// El reparto de clases no es arbitrario: cada una pide un remedio distinto y dos de ellas piden
// que intervenga una persona.
//
//   · `identico`    → no se toca. Escribir por escribir dispara `reset_questions_on_article_update`
//                     y manda a re-verificar preguntas que estaban bien.
//   · `incompleto`  → REESCRIBIR: nos falta materia del oficial. Es el daño gordo (el art. 28 del
//                     RGPD servía 12 párrafos de menos).
//   · `erratas`     → REESCRIBIR: es el texto oficial mal copiado.
//   · `reordenado`  → requiere `--incluir-reordenado`. Están los mismos párrafos en otro orden:
//                     casi siempre es nuestro troceo, pero puede ser una versión distinta, así que
//                     no entra en una tanda masiva sin que alguien lo pida.
//   · `contaminado` → BLOQUEADO. Tenemos párrafos que el oficial no tiene: puede ser otra norma o
//                     una redacción derogada, y sobrescribir borraría la prueba de qué pasó.
//   · `sin_oficial` → BLOQUEADO. No se ha podido leer la fuente; escribir a ciegas es lo contrario
//                     de verificar.
//
// ⚠️ AVISO medido el 27/07 sobre el RGPD: `contaminado` **sobre-dispara** cuando la divergencia es
// una VARIANTE DE REDACCIÓN y no material ajeno. En esa ley marcó 73 de 99 artículos, y al abrirlos
// `faltan` y `sobran` eran EL MISMO PÁRRAFO con una palabra cambiada («con arreglo al artículo 17»
// contra «el artículo 17»). Por eso `contaminado` bloquea en vez de reescribir: si la clase miente,
// que lo haga hacia el lado que no destruye nada.

/** Clases que se reescriben sin preguntar. */
const CLASES_SEGURAS = ['incompleto', 'erratas']
/** Clases que se reescriben solo si el operador lo pide explícitamente. */
const CLASES_BAJO_PETICION = ['reordenado']
/** Clases que NO se reescriben nunca por esta vía. */
const CLASES_BLOQUEADAS = ['contaminado', 'sin_oficial']

/**
 * ¿Se reescribe este artículo?
 *
 * @param {string} clase  veredicto de `compararArticuloOficial`
 * @param {{incluirReordenado?: boolean}} [opciones]
 * @returns {{accion:'omitir'|'reescribir'|'bloquear', motivo:string}}
 */
function decidirReescritura(clase, opciones = {}) {
  if (clase === 'identico') {
    return { accion: 'omitir', motivo: 'ya es el texto oficial: reescribir solo mandaría a re-verificar sus preguntas' }
  }
  if (CLASES_SEGURAS.includes(clase)) {
    return { accion: 'reescribir', motivo: clase === 'incompleto' ? 'falta materia del texto oficial' : 'es el texto oficial mal copiado' }
  }
  if (CLASES_BAJO_PETICION.includes(clase)) {
    return opciones.incluirReordenado
      ? { accion: 'reescribir', motivo: 'mismos párrafos en otro orden (pedido con --incluir-reordenado)' }
      : { accion: 'bloquear', motivo: 'mismos párrafos en otro orden: puede ser nuestro troceo o una versión distinta — pásalo con --incluir-reordenado si lo has mirado' }
  }
  if (clase === 'contaminado') {
    return {
      accion: 'bloquear',
      motivo:
        'tenemos párrafos que el oficial no tiene: puede ser otra norma, una redacción derogada… o ' +
        'una simple VARIANTE DE REDACCIÓN que el comparador no sabe distinguir (pasó en 73 de los 99 ' +
        'artículos del RGPD). Averígualo antes: sobrescribir borra la prueba',
    }
  }
  if (clase === 'sin_oficial') {
    return { accion: 'bloquear', motivo: 'no se ha podido leer el texto oficial: escribir a ciegas es lo contrario de verificar' }
  }
  return { accion: 'bloquear', motivo: `clase desconocida "${clase}": no se escribe lo que no se entiende` }
}

/** Resumen de una tanda: qué se escribiría y qué se queda fuera. */
function resumirPlan(decisiones) {
  const por = { reescribir: 0, omitir: 0, bloquear: 0 }
  for (const d of decisiones) por[d.accion] = (por[d.accion] || 0) + 1
  return por
}

module.exports = {
  decidirReescritura,
  resumirPlan,
  CLASES_SEGURAS,
  CLASES_BAJO_PETICION,
  CLASES_BLOQUEADAS,
}
