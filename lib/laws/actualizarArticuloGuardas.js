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
// ## CORRECCIÓN del 28/07 — el aviso que había aquí era FALSO (T-193)
//
// Este fichero decía que `contaminado` «sobre-dispara» en el RGPD porque confunde variantes de
// redacción con material ajeno. Se midió y es al revés: **el comparador tiene razón**. El texto del
// RGPD que servimos NO es el oficial en 72 de sus 99 artículos, sino una reescritura sinónima —
// verificado contra TRES fuentes oficiales independientes (EUR-Lex consolidado, EUR-Lex original y
// espejo del BOE), que coinciden entre sí y discrepan de la nuestra. En el art. 43 la diferencia se
// come la obligación de los Estados miembros, así que no es estilo: es contenido normativo.
//
// Consecuencia práctica: **no se afloja la clasificación**. `contaminado` sigue bloqueando por
// defecto, y para el caso investigado se abre una puerta EXPLÍCITA (`incluirParafrasis`) que hay que
// pedir a mano, ley por ley y tanda por tanda. Aflojar el umbral habría estropeado además a
// `reactivar-articulo-boe.cjs`, donde esta misma clase es la guarda que impide reactivar un artículo
// con texto de otra norma.

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
 * @param {{incluirReordenado?: boolean, incluirParafrasis?: boolean}} [opciones]
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
    return opciones.incluirParafrasis
      ? {
          accion: 'reescribir',
          motivo:
            'origen YA investigado y documentado: el texto que servimos es una redacción NO oficial ' +
            'del mismo artículo (pedido con --reimportar-parafrasis). El anterior se guarda en ' +
            '`article_versions.previous_content`, así que no se borra la prueba',
        }
      : {
          accion: 'bloquear',
          motivo:
            'tenemos párrafos que el oficial no tiene: puede ser otra norma, una redacción derogada ' +
            'o una reescritura no oficial. Averigua el origen ANTES; si ya lo has hecho y la fuente ' +
            'es la correcta, pásalo con --reimportar-parafrasis',
        }
  }
  if (clase === 'sin_oficial') {
    return { accion: 'bloquear', motivo: 'no se ha podido leer el texto oficial: escribir a ciegas es lo contrario de verificar' }
  }
  return { accion: 'bloquear', motivo: `clase desconocida "${clase}": no se escribe lo que no se entiende` }
}

/**
 * ¿El texto oficial EXTRAÍDO está en condiciones de escribirse?
 *
 * POR QUÉ ES UNA COMPROBACIÓN APARTE (T-193, 28/07/2026). El script ya re-compara dentro de la
 * transacción, pero eso NO caza un defecto de extracción: compara lo escrito contra el texto
 * extraído, así que si la extracción trajo pegada la rúbrica o el encabezado de la sección
 * siguiente, **coinciden los dos lados y el defecto pasa limpio**. Ya ocurrió dos veces (el art. 31
 * del RGPD acababa en «…Sección 2 Seguridad de los datos personales» y el 73 empezaba por
 * «Presidencia»), y las dos se cazaron mirando el texto a ojo, nunca con un contador.
 *
 * Va antes de escribir y tumba la tanda ENTERA: si la extracción falla en uno, no hay motivo para
 * fiarse del resto.
 *
 * @param {string} texto      lo que se guardaría en `articles.content`
 * @param {string} [rubrica]  rúbrica OFICIAL del artículo, tal como la rotula la fuente
 * @returns {{ok:boolean, motivo:string}}
 */
function revisarTextoOficial(texto, rubrica) {
  const t = String(texto || '').trim()
  if (!t) return { ok: false, motivo: 'el texto extraído está VACÍO: no se escribe la nada sobre un artículo' }
  if (t.length < 40) return { ok: false, motivo: `solo ${t.length} caracteres: la extracción se ha quedado corta` }
  const r = String(rubrica || '').trim()
  if (r && t.toLowerCase().startsWith(r.toLowerCase())) {
    return { ok: false, motivo: `empieza por su propia rúbrica («${r}»), que en la BD vive en \`title\`: la poda ha fallado` }
  }
  // Encabezado de división colado al final: el corte se llevó lo que abría la sección siguiente.
  if (/\b(Secci[óo]n|Cap[íi]tulo|T[íi]tulo)\s+[IVXLC\d]+\s*$/i.test(t)) {
    return { ok: false, motivo: 'termina en un encabezado de división: el recorte se ha llevado el principio de la sección siguiente' }
  }
  return { ok: true, motivo: 'texto con pinta de artículo completo' }
}

/** Resumen de una tanda: qué se escribiría y qué se queda fuera. */
function resumirPlan(decisiones) {
  const por = { reescribir: 0, omitir: 0, bloquear: 0 }
  for (const d of decisiones) por[d.accion] = (por[d.accion] || 0) + 1
  return por
}

module.exports = {
  decidirReescritura,
  revisarTextoOficial,
  resumirPlan,
  CLASES_SEGURAS,
  CLASES_BAJO_PETICION,
  CLASES_BLOQUEADAS,
}
