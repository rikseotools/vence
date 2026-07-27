'use strict'
//
// correccionPlazas — NÚCLEO PURO de la única vía legítima para CORREGIR una cifra de plazas
// contra el boletín (paso 4 del §6 de `docs/runbooks/provenance-convocatorias.md`).
//
// POR QUÉ EXISTE (T-191, 27/07/2026). El §6 tiene cuatro salidas para una cifra sin documento que
// la pruebe: clonar el documento bueno, clonar el correcto, firmar `cifra_derivada`… y **corregir
// la cifra contra el boletín**. Las tres primeras tienen herramienta; la cuarta —la ÚNICA que
// cambia un dato que el opositor lee en la landing— se hacía a mano. Al cerrar T-191 hubo que
// corregir `administrativo-aragon` de 139 a 144 y la guarda anti-concurrencia, el dual-write en
// transacción y la traza los puso quien lo hizo, de memoria. La siguiente sesión puede no ponerlos.
//
// EL CASO REAL QUE HAY QUE IMPEDIR. El 139 de Aragón salía de restar a las 144 convocadas las 5
// plazas reservadas a colectivos (violencia de género, terrorismo, personas transexuales). Esa
// resta NO aparece escrita en ningún sitio — es el mismo patrón que el 2.163 de Policía Nacional
// (2.704 − 541) que el runbook cita como invención presentada como hecho. Las plazas reservadas
// son plazas del turno libre CON reserva, no plazas descontadas: en el caso hermano de Madrid la
// cifra correcta (111) INCLUYE las 11 de reserva por discapacidad.
//
// LA GUARDA CLAVE, y es la razón de ser de este módulo: **la cifra nueva tiene que aparecer en la
// cita aportada**, comprobado con `cifraEnTexto` — EL MISMO predicado que usa el detector
// `plazas_afirmadas_sin_documento`. Así es imposible escribir por esta vía una cifra que el
// detector no daría por probada: escritor y detector comparten criterio por construcción, que es
// lo que evitó que los tres espejos del detector de anulados volvieran a divergir.
//
// Tests: `__tests__/lib/convocatoria/correccionPlazas.test.js`.

const { cifraEnTexto } = require('./cifraEnTexto.cjs')

/** Campos corregibles. Son los que el detector juzga y los que pinta la landing. */
const CAMPOS = ['plazas_libres', 'plazas_promocion_interna', 'plazas_discapacidad']

/** Longitud mínima de la cita. Por debajo no es una cita, es un recorte sin contexto. */
const MIN_CITA = 40

/**
 * ¿La cita PARECE una prueba, con el mismo criterio que el detector `cita_no_prueba_nada`?
 * O tiene prosa (≥5 palabras en minúscula: una cláusula), o carga al menos dos de las cifras
 * afirmadas (una fila de tabla). Un membrete de boletín no es ninguna de las dos cosas.
 *
 * @param {string} cita
 * @param {Array<number|null|undefined>} cifras las que la fila afirmará tras la corrección
 */
function citaPruebaAlgo(cita, cifras = []) {
  const t = String(cita || '').trim()
  if (t.length < MIN_CITA) return false
  const palabrasEnProsa = (t.match(/\b[a-záéíóúñü]{3,}\b/g) || []).length
  if (palabrasEnProsa >= 5) return true
  const presentes = cifras.filter((n) => Number.isFinite(n) && cifraEnTexto(n, t)).length
  return presentes >= 2
}

/**
 * Valida una corrección ANTES de tocar nada. Devuelve todos los motivos de rechazo juntos:
 * quien la usa merece verlos de una vez, no ir descubriéndolos de uno en uno.
 *
 * @param {object} p
 * @param {string} p.campo          uno de CAMPOS
 * @param {number} p.valor          cifra nueva (la que dice el boletín)
 * @param {number|null} p.actual    lo que hay HOY en BD (para el optimistic check)
 * @param {number|null} [p.esperado] lo que quien corrige CREE que hay; si no coincide con `actual`, se rehúsa
 * @param {string} p.cita           cita literal del boletín que sostiene la cifra
 * @param {string} p.url            URL del documento citado
 * @param {string} p.motivo         por qué la cifra publicada estaba mal
 * @returns {{ok:boolean, errores:string[], avisos:string[]}}
 */
function validarCorreccion({ campo, valor, actual, esperado, cita, url, motivo } = {}) {
  const errores = []
  const avisos = []

  if (!CAMPOS.includes(campo)) errores.push(`campo no corregible por esta vía: ${campo} (válidos: ${CAMPOS.join(', ')})`)
  // `valorValido` se calcula UNA vez y gobierna las comprobaciones que usan la cifra: pasarle
  // basura al núcleo compartido no es asunto suyo. `cifraEnTexto(-3, …)` revienta al pedirle a
  // `enLetra` el nombre de un negativo, y lo cazó el test de "valor negativo" de este módulo.
  const valorValido = Number.isInteger(valor) && valor >= 0
  if (!valorValido) errores.push(`la cifra nueva debe ser un entero >= 0 (recibido: ${valor})`)
  if (!url || !/^https?:\/\//i.test(String(url))) errores.push('falta --url del documento oficial que prueba la cifra')
  if (!motivo || String(motivo).trim().length < 25) errores.push('falta --motivo: por qué la cifra publicada estaba mal (>= 25 caracteres)')

  if (!cita || String(cita).trim().length < MIN_CITA) {
    errores.push(`falta --cita literal del boletín (>= ${MIN_CITA} caracteres)`)
  } else if (valorValido && !cifraEnTexto(valor, cita)) {
    // LA guarda: si la cita no contiene la cifra, esa cita no la prueba. Sin excepciones ni flag
    // de escape: para eso está la válvula firmada `cifra_derivada`, que deja rastro aparte.
    errores.push(`la cita aportada NO contiene la cifra ${valor} (ni en dígitos ni en letra): esa cita no la prueba`)
  } else if (!citaPruebaAlgo(cita, valorValido ? [valor] : [])) {
    errores.push('la cita no parece una prueba (ni cláusula en prosa, ni fila de tabla con sus cifras): un membrete no vale')
  }

  if (esperado !== undefined && esperado !== null && actual !== esperado) {
    errores.push(`el valor en BD (${actual}) no es el esperado (${esperado}): otra sesión lo cambió — revísalo antes de escribir`)
  }
  if (actual === valor) avisos.push(`el valor en BD ya es ${valor}: no hay nada que corregir`)

  return { ok: errores.length === 0, errores, avisos }
}

module.exports = { validarCorreccion, citaPruebaAlgo, CAMPOS, MIN_CITA }
