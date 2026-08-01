'use strict'
/**
 * Dos opciones IDÉNTICAS dentro de la misma pregunta: la pregunta se queda de hecho en tres
 * alternativas y no lo dice.
 *
 * ## Por qué existe (T-406, 31/07/2026)
 *
 * Ningún detector de `health-sweep` miraba la coherencia INTERNA de una pregunta: todos comparan la
 * pregunta con su artículo, con el epígrafe o con la convocatoria — nunca **consigo misma**. Se
 * descubrió por una impugnación (`626059c8`) que decía «la A y la C son idénticas»; allí era FALSO
 * (una decía «denunciantes» y la otra «denunciados», que es justo el eje de la pregunta) y se
 * rechazó, pero al comprobarlo apareció el fenómeno de verdad en otras 33 preguntas activas.
 *
 * ## Las DOS BANDAS no son cosmética
 *
 * - `error` — **la clave está dentro del par**. Da igual cuál de las dos marque el opositor: acierta
 *   y falla a la vez. Eso sí rompe la pregunta. Hoy hay 0, y por eso este detector nace en verde.
 * - `warn`  — el par son dos distractores. La pregunta sigue siendo resoluble (la clave está fuera),
 *   pero el opositor ve dos opciones clonadas y lee descuido.
 *
 * ## LO ÚNICO QUE SE NORMALIZA ES EL ESPACIO EN BLANCO
 *
 * Y no es una elección estética: al medirlo, cada normalización de más inventó falsos positivos.
 * - `lower()` daba por iguales opciones que se distinguen justamente por la mayúscula.
 * - Un `\s+` que llegó a SQL como `s+` **borraba las eses** e igualaba `wardrobes` con `wardrobess`:
 *   8 fantasmas, todos de inglés. Por eso la comparación vive AQUÍ, en JS, y no en una consulta.
 *
 * Nada de minúsculas, nada de quitar tildes, nada de puntuación. Si dos textos difieren en una
 * letra, son opciones distintas y el opositor los lee distintos.
 */

/** Trim + colapso de espacios. Nada más. `null`/vacío se propaga como `null`. */
function normalizarOpcion(s) {
  if (s == null) return null
  const t = String(s).trim().replace(/\s+/g, ' ')
  return t.length ? t : null
}

/**
 * @param {{id?: string, option_a?: string, option_b?: string, option_c?: string, option_d?: string,
 *          correct_option?: number}} pregunta
 * @returns {Array<{i: number, j: number, banda: 'error'|'warn', texto: string}>}
 *   Un elemento por PAR de opciones idénticas (`i` < `j`, índices 0=A…3=D). Vacío = pregunta sana.
 */
function paresDuplicados(pregunta) {
  const p = pregunta || {}
  const opts = [p.option_a, p.option_b, p.option_c, p.option_d].map(normalizarOpcion)
  const clave = p.correct_option
  const out = []
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      // Una opción vacía o NULL NO forma par: si contase, toda pregunta de 3 opciones saltaría.
      // Es el caso REAL de las oposiciones que solo tienen tres alternativas — Policía Nacional
      // sirve 989 de 991 preguntas oficiales con la D vacía (manual de impugnaciones §7.8).
      if (opts[i] === null || opts[j] === null) continue
      if (opts[i] !== opts[j]) continue
      out.push({
        i,
        j,
        banda: clave === i || clave === j ? 'error' : 'warn',
        texto: opts[i],
      })
    }
  }
  return out
}

/** ¿Tiene esta pregunta al menos un par duplicado? Atajo legible para los barridos. */
function tieneOpcionesDuplicadas(pregunta) {
  return paresDuplicados(pregunta).length > 0
}

/**
 * Clasifica un lote y lo separa por banda, que es como lo consume el barrido: la banda `error` se
 * mira hoy y la `warn` es cola. Devuelve también la muestra para el mensaje del finding.
 * @param {Array<object>} preguntas
 */
function clasificarLote(preguntas) {
  const errores = []
  const avisos = []
  for (const q of preguntas || []) {
    for (const par of paresDuplicados(q)) {
      const fila = { id: q && q.id, ...par }
      ;(par.banda === 'error' ? errores : avisos).push(fila)
    }
  }
  return { errores, avisos, total: errores.length + avisos.length }
}

const LETRAS = ['A', 'B', 'C', 'D']

module.exports = { normalizarOpcion, paresDuplicados, tieneOpcionesDuplicadas, clasificarLote, LETRAS }
