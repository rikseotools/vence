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

/**
 * ¿La cita habla de LA RESERVA? Guarda propia de la declaración, distinta de `citaPruebaAlgo`.
 *
 * La de la corrección vale para cifras: pide prosa o «dos de MIS cifras». Aquí las dos ramas fallan.
 * La de las cifras, porque en un desglose de boletín casi todas las columnas son suyas, no nuestras
 * («305 9 13 327»: solo el 327 es un dato nuestro), así que exigir dos rechazaría justo las citas
 * buenas. Y la de la prosa, porque cuenta palabras sin mirar cuáles: un membrete como «DOCM núm. 240
 * de 12 de diciembre de 2025 — 327» tiene cinco y no prueba absolutamente nada sobre la reserva.
 *
 * Lo que hace falta es lo obvio: para declarar cómo se relaciona el CUPO con el turno libre, la cita
 * tiene que **nombrar el cupo**. Con eso, un membrete no puede colarse por mucha fecha que lleve, y
 * las dos formas legítimas —la cláusula en prosa («del total de estas plazas se reservan…») y la
 * fila de tabla con su cabecera («Cupo general | Reserva personas con discapacidad | Total»)— pasan
 * las dos.
 */
const VOCABULARIO_RESERVA = /discapacidad|discapacitat|reserv|cupo|enfermedad mental|malaltia mental/i

/**
 * Marcas de que el boletín ENUMERA dos cupos distintos en vez de descontar uno del otro.
 *
 * Es la diferencia entre «se dividen en dos cupos: general 1.747 · reserva 131» (suman 1.878) y
 * «1.747 plazas, de las cuales 131 reservadas» (siguen siendo 1.747). Las dos frases llevan las
 * mismas dos cifras y significan lo contrario, así que lo que decide es el conector, no los números.
 * Deliberadamente corta: cada patrón sale de un boletín real. Ampliarla exige el mismo listón —
 * una cita literal donde la separación sea inequívoca.
 */
const SEPARACION_DE_CUPOS = /dos cupos|cupo general|turno general|además de las|aparte de las|adicionales a las|más otras/i

function citaSostieneUnDesglose(cita, exigidas = []) {
  const t = String(cita || '').trim()
  if (t.length < MIN_CITA) return false
  if (!VOCABULARIO_RESERVA.test(t)) return false
  return exigidas.every((n) => Number.isFinite(n) && cifraEnTexto(n, t))
}

/**
 * ¿Se puede DECLARAR que el cupo de discapacidad va dentro del turno libre, o aparte? — [T-218]
 *
 * Vive aquí y no en una herramienta propia porque es el MISMO acto que corregir una cifra: escribir
 * en la landing un hecho que el opositor lee, con una cita literal detrás. Lo que cambia es qué hay
 * que encontrar en la cita.
 *
 * ## La guarda: que la ARITMÉTICA de la declaración esté escrita
 *
 * Exigir la cifra del cupo tal cual no vale — no aparece casi nunca. Los boletines la reparten en
 * columnas: Castilla-La Mancha escribe «C2 Cuerpo Auxiliar 305 9 13 327» (general + discapacidad
 * general + discapacidad intelectual = total) y la Generalitat «C2-01. Cos auxiliar 204 14 21 6 245»
 * (libre + tres cupos = total). En los dos casos el número que guardamos como cupo (22 y 41) es una
 * SUMA que no está impresa.
 *
 * Lo que sí tiene que estar impreso es el número que la declaración implica:
 *   · `dentro`  → lo que guardamos como turno libre YA es el total ⇒ esa cifra debe estar en la cita.
 *   · `aparte`  → el total es `libres + cupo` ⇒ deben estar en la cita **la cifra de libres Y esa suma**.
 * Si el boletín no imprime el total que tu declaración implica, no estás leyendo una tabla: estás
 * interpretando. Y una interpretación no se publica como hecho (misma doctrina que `cifra_derivada`).
 *
 * Se usa `cifraEnTexto`, el mismo predicado del detector `plazas_afirmadas_sin_documento`: por
 * construcción, no se puede declarar apoyándose en una cita que el detector no daría por prueba.
 *
 * @param {{incluidas:boolean, cita:string, url:string, motivo:string,
 *          plazasLibres:number, plazasDiscapacidad:number, actual?:boolean|null}} args
 */
function validarDeclaracionReserva({ incluidas, cita, url, motivo, plazasLibres, plazasDiscapacidad, actual } = {}) {
  const errores = []
  const avisos = []

  if (typeof incluidas !== 'boolean') errores.push('--incluidas debe ser true (dentro del turno libre) o false (aparte)')
  if (!Number.isInteger(plazasLibres) || plazasLibres < 0) errores.push(`la convocatoria no tiene un turno libre válido en BD (${plazasLibres})`)
  if (!Number.isInteger(plazasDiscapacidad) || plazasDiscapacidad <= 0) {
    errores.push(`no hay cupo de discapacidad que declarar en BD (${plazasDiscapacidad}): sin cupo, la relación no significa nada`)
  }
  if (!url || !/^https?:\/\//i.test(String(url))) errores.push('falta --url del documento oficial (boletín) que prueba la relación')
  if (!motivo || String(motivo).trim().length < 25) errores.push('falta --motivo: qué dice el boletín, en tus palabras (>= 25 caracteres)')

  const cifrasOk = Number.isInteger(plazasLibres) && Number.isInteger(plazasDiscapacidad)
  if (!cita || String(cita).trim().length < MIN_CITA) {
    errores.push(`falta --cita literal del boletín (>= ${MIN_CITA} caracteres)`)
  } else if (cifrasOk && typeof incluidas === 'boolean') {
    // El total que la declaración implica, que es lo que la cita tiene que sostener.
    const total = incluidas ? plazasLibres : plazasLibres + plazasDiscapacidad
    // SEGUNDA FORMA de probar «aparte», y hay que admitirla porque es como escriben los boletines
    // en prosa: el BOCM de tcae-sermas-madrid dice «se dividen en DOS CUPOS: — Plazas del cupo
    // general: 1.747. — Plazas del cupo de reserva…: 131» y NO imprime el 1.878. Ahí las dos cifras
    // salen enumeradas como cupos distintos, que es justo lo que significa «aparte».
    // No vale con que aparezcan las dos cifras a secas: «425 plazas, de las cuales 43 reservadas»
    // también las trae y significa lo CONTRARIO. Hace falta que el texto las SEPARE.
    const separaLosCupos = SEPARACION_DE_CUPOS.test(String(cita)) &&
      cifraEnTexto(plazasLibres, cita) && cifraEnTexto(plazasDiscapacidad, cita)
    const exigidas = incluidas ? [plazasLibres] : (separaLosCupos ? [plazasLibres, plazasDiscapacidad] : [plazasLibres, total])
    const faltan = exigidas.filter((n) => !cifraEnTexto(n, cita))
    if (faltan.length) {
      errores.push(
        `la cita no contiene ${faltan.join(' ni ')} — declarando «${incluidas ? 'dentro' : 'aparte'}» el total del TURNO LIBRE ` +
        `sería ${total}, y esa cuenta tiene que estar escrita en el boletín (o el texto tiene que enumerar los dos cupos por separado), no deducida`,
      )
    } else if (!citaSostieneUnDesglose(cita, exigidas)) {
      errores.push('la cita no parece una prueba: ni cláusula en prosa, ni fila de tabla con su desglose (un membrete con un número suelto no vale)')
    }
  }

  if (actual !== undefined && actual !== null) {
    if (actual === incluidas) avisos.push(`ya está declarado como ${actual}: no hay nada que escribir`)
    else errores.push(`ya hay una declaración en BD (${actual}) distinta de la que traes (${incluidas}): revísalo antes de pisarla`)
  }

  return { ok: errores.length === 0, errores, avisos }
}

module.exports = { validarCorreccion, validarDeclaracionReserva, citaPruebaAlgo, CAMPOS, MIN_CITA }
